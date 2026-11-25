// Optional per-connection delegated service account, used ONLY for Cloud Identity computers.
// Fixed token endpoint, fixed single read-only scope, mandatory delegated subject. The key
// material never leaves this module in errors, logs or responses.
import type { CollectedResource } from "./integration-model.ts";
import { googleDeviceResource, googlePages } from "./google-workspace.ts";

export const CLOUD_IDENTITY_SCOPE = "https://www.googleapis.com/auth/cloud-identity.devices.readonly";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_ORIGIN = "https://cloudidentity.googleapis.com";
export const CLOUD_VIEWS = ["USER_ASSIGNED_DEVICES", "COMPANY_INVENTORY"] as const;
const MAX_JSON = 16384;

export class DelegatedError extends Error {
  constructor(public code: string) { super(code); }
}
export interface ServiceAccountKey {
  client_email: string; private_key: string; private_key_id: string; project_id: string; client_id: string;
}

const EMAIL = /^[a-z][a-z0-9-]{4,29}@([a-z][a-z0-9-]{4,28}[a-z0-9])\.iam\.gserviceaccount\.com$/;
export const ADMIN_EMAIL = /^[^\s@]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;

/** Validates the uploaded JSON shape without echoing any of its content. */
export function parseServiceAccount(text: unknown): ServiceAccountKey {
  if (typeof text !== "string" || text.length < 100 || text.length > MAX_JSON) throw new DelegatedError("invalid_key_file");
  let j: any;
  try { j = JSON.parse(text); } catch { throw new DelegatedError("invalid_key_file"); }
  if (!j || j.type !== "service_account") throw new DelegatedError("invalid_key_file");
  const email = typeof j.client_email === "string" ? j.client_email.toLowerCase() : "";
  const m = EMAIL.exec(email);
  if (!m || j.project_id !== m[1]) throw new DelegatedError("invalid_key_file");
  if (j.token_uri !== undefined && j.token_uri !== GOOGLE_TOKEN_URL) throw new DelegatedError("invalid_key_file");
  if (typeof j.private_key_id !== "string" || !/^[a-f0-9]{20,64}$/.test(j.private_key_id)) throw new DelegatedError("invalid_key_file");
  if (typeof j.client_id !== "string" || !/^\d{10,30}$/.test(j.client_id)) throw new DelegatedError("invalid_key_file");
  if (typeof j.private_key !== "string" || !/^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n?$/.test(j.private_key))
    throw new DelegatedError("invalid_key_file");
  return { client_email: email, private_key: j.private_key, private_key_id: j.private_key_id, project_id: j.project_id, client_id: j.client_id };
}

const b64url = (b: Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : b;
  let s = ""; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function importKey(pem: string) {
  try {
    const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
    const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    // RS256 only; any other key type fails import.
    return await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new DelegatedError("invalid_key_file");
  }
}

/** JWT assertion: RS256, fixed audience and scope, delegated subject mandatory. */
export async function signAssertion(key: ServiceAccountKey, subject: string, nowSec = Math.floor(Date.now() / 1000)) {
  if (!ADMIN_EMAIL.test(subject)) throw new DelegatedError("invalid_admin");
  const header = { alg: "RS256", typ: "JWT", kid: key.private_key_id };
  const claims = { iss: key.client_email, sub: subject, scope: CLOUD_IDENTITY_SCOPE, aud: GOOGLE_TOKEN_URL, iat: nowSec, exp: nowSec + 600 };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importKey(key.private_key), new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

type Fetch = typeof fetch;
/** Short-lived token for the single read-only scope; Google error bodies are mapped, never relayed. */
export async function delegatedToken(key: ServiceAccountKey, subject: string, f: Fetch = fetch): Promise<string> {
  const assertion = await signAssertion(key, subject);
  let res: Response;
  try {
    res = await f(GOOGLE_TOKEN_URL, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
  } catch { throw new DelegatedError("provider_unavailable"); }
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const err = typeof data?.error === "string" ? data.error : "";
    // unauthorized_client = Client ID not delegated (or scope missing) in the Admin console.
    if (err === "unauthorized_client" || err === "access_denied") throw new DelegatedError("delegation_missing");
    if (err === "invalid_grant") {
      const d = typeof data?.error_description === "string" ? data.error_description.toLowerCase() : "";
      throw new DelegatedError(d.includes("invalid email") || d.includes("subject") ? "invalid_admin" : "invalid_credential");
    }
    if (err === "invalid_client") throw new DelegatedError("invalid_credential");
    throw new DelegatedError("provider_unavailable");
  }
  if (typeof data?.access_token !== "string") throw new DelegatedError("provider_unavailable");
  if (typeof data.scope === "string" && data.scope.split(/\s+/).some((s: string) => s && s !== CLOUD_IDENTITY_SCOPE))
    throw new DelegatedError("unexpected_scope");
  return data.access_token;
}

type Read = (url: string, token: string, origin: string) => Promise<any>;
/**
 * Cloud Identity rejects customers/<id> for DWD calls (INVALID_ARGUMENT); my_customer resolves to the
 * impersonated admin's organization. Tenant binding stays: the connection's customer_id must be valid
 * and the admin was validated against it (OAuth) before the credential was saved.
 */
const customerOf = (id: string) => {
  if (!/^[A-Za-z0-9]{4,40}$/.test(id)) throw new DelegatedError("organization_changed");
  return "customers/my_customer";
};

/** One-page probe used before enabling the credential. */
export async function probeDevices(read: Read, token: string, customerId: string) {
  const url = new URL("/v1/devices", CLOUD_ORIGIN);
  url.search = new URLSearchParams({ customer: customerOf(customerId), pageSize: "1", view: "COMPANY_INVENTORY" }).toString();
  await read(url.href, token, CLOUD_ORIGIN);
}

/** Both views, all pages, deduplicated by device name; customer is fixed by the connection. */
export async function collectCloudDevices(read: Read, token: string, customerId: string) {
  const customer = customerOf(customerId);
  const seen = new Map<string, any>();
  let partial = false;
  for (const view of CLOUD_VIEWS) {
    const r = await googlePages(read, token, CLOUD_ORIGIN, "/v1/devices", { customer, view, pageSize: "100" }, "devices");
    if (r.partial) partial = true;
    for (const d of r.items) if (d?.name && !seen.has(d.name)) seen.set(d.name, d);
  }
  const resources = [...seen.values()].map((d) => googleDeviceResource("cloud", d)).filter(Boolean) as CollectedResource[];
  return { resources, partial };
}

export function delegatedErrorCode(e: unknown): string {
  if (e instanceof DelegatedError) return e.code;
  const c = (e as { code?: string })?.code;
  if (c === "permission_missing") return "license_or_permission";
  if (c === "authorization_expired") return "delegation_missing";
  return typeof c === "string" && /^[a-z_0-9]{3,40}$/.test(c) ? c : "provider_error";
}
