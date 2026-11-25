import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CLOUD_IDENTITY_SCOPE, GOOGLE_TOKEN_URL, DelegatedError, collectCloudDevices, delegatedToken,
  parseServiceAccount, signAssertion,
} from "./google-delegated.ts";
import { collectCloudIdentity, type Collection } from "./integration-providers.ts";
import { ativoDoGoogle, googleDeviceResource } from "./google-workspace.ts";

async function keyJson(over: Record<string, unknown> = {}) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let b = ""; for (const x of der) b += String.fromCharCode(x);
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(b).match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
  return {
    pub: pair.publicKey, pem,
    text: JSON.stringify({
      type: "service_account", project_id: "akuris-integrations", private_key_id: "a1b2c3d4e5f6a1b2c3d4e5f6",
      private_key: pem, client_email: "akuris-devices-readonly@akuris-integrations.iam.gserviceaccount.com",
      client_id: "110121051822981322395", token_uri: GOOGLE_TOKEN_URL, ...over,
    }),
  };
}
const SECRET_MARK = "MII";

Deno.test("rejects malformed or foreign key files without echoing content", async () => {
  const k = await keyJson();
  for (const bad of [
    "x", "{}".padEnd(200), (await keyJson({ project_id: "other-project" })).text,
    (await keyJson({ token_uri: "https://evil.example/token" })).text,
    (await keyJson({ client_email: "someone@gmail.com" })).text,
    (await keyJson({ type: "authorized_user" })).text, k.text.padEnd(20000),
  ]) {
    try { parseServiceAccount(bad); throw new Error("accepted"); }
    catch (e) { assert(e instanceof DelegatedError); assertEquals(e.message, "invalid_key_file"); assert(!String(e.stack).includes(SECRET_MARK)); }
  }
  assertEquals(parseServiceAccount(k.text).client_email, "akuris-devices-readonly@akuris-integrations.iam.gserviceaccount.com");
});

Deno.test("assertion is RS256, single read-only scope, fixed audience, delegated subject", async () => {
  const k = await keyJson();
  const jwt = await signAssertion(parseServiceAccount(k.text), "admin@cliente.com", 1000);
  const [h, c, s] = jwt.split(".");
  const dec = (x: string) => JSON.parse(atob(x.replace(/-/g, "+").replace(/_/g, "/")));
  assertEquals(dec(h).alg, "RS256");
  const claims = dec(c);
  assertEquals(claims.scope, CLOUD_IDENTITY_SCOPE);
  assertEquals(claims.aud, GOOGLE_TOKEN_URL);
  assertEquals(claims.sub, "admin@cliente.com");
  assert(!claims.scope.includes("cloud-platform") && !claims.scope.includes(" "));
  const sig = Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - s.length % 4) % 4)), (x) => x.charCodeAt(0));
  assert(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", k.pub, sig, new TextEncoder().encode(`${h}.${c}`)));
  await assertRejects(() => signAssertion(parseServiceAccount(k.text), ""), DelegatedError, "invalid_admin");
});

Deno.test("token errors map to codes; missing delegation and bad credential never leak the body", async () => {
  const key = parseServiceAccount((await keyJson()).text);
  const fake = (status: number, body: unknown) => (async (url: string | URL | Request, init?: RequestInit) => {
    assertEquals(String(url), GOOGLE_TOKEN_URL);
    assert(String(init?.body).includes("jwt-bearer"));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  await assertRejects(() => delegatedToken(key, "a@c.com", fake(401, { error: "unauthorized_client", error_description: "Client is unauthorized " + key.private_key })), DelegatedError, "delegation_missing");
  await assertRejects(() => delegatedToken(key, "a@c.com", fake(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." })), DelegatedError, "invalid_credential");
  await assertRejects(() => delegatedToken(key, "a@c.com", fake(400, { error: "invalid_grant", error_description: "Invalid email or User ID" })), DelegatedError, "invalid_admin");
  await assertRejects(() => delegatedToken(key, "a@c.com", fake(200, { access_token: "t", scope: CLOUD_IDENTITY_SCOPE + " https://www.googleapis.com/auth/cloud-platform" })), DelegatedError, "unexpected_scope");
  assertEquals(await delegatedToken(key, "a@c.com", fake(200, { access_token: "tok", scope: CLOUD_IDENTITY_SCOPE })), "tok");
});

Deno.test("collects both views with pagination, fixed customer and dedup by device id", async () => {
  const urls: string[] = [];
  const read = async (url: string) => {
    urls.push(url);
    const u = new URL(url);
    assertEquals(u.origin, "https://cloudidentity.googleapis.com");
    assertEquals(u.searchParams.get("customer"), "customers/my_customer");
    const view = u.searchParams.get("view");
    if (view === "USER_ASSIGNED_DEVICES")
      return u.searchParams.get("pageToken") ? { devices: [{ name: "devices/2", serialNumber: "SER-2", deviceType: "WINDOWS" }] }
        : { devices: [{ name: "devices/1", serialNumber: "SER-1", osVersion: "Windows 11", managementState: "APPROVED", lastSyncTime: "2026-11-20T00:00:00Z" }], nextPageToken: "p2" };
    return { devices: [{ name: "devices/1" }, { name: "devices/3", serialNumber: "SER-3" }] };
  };
  const r = await collectCloudDevices(read, "tok", "C0abc123");
  assertEquals(r.resources.map((x) => x.externalId).sort(), ["device:google:cloud:devices/1", "device:google:cloud:devices/2", "device:google:cloud:devices/3"]);
  assertEquals(urls.length, 3);
  assertEquals(urls.map((x) => new URL(x).searchParams.get("view")).sort(), ["COMPANY_INVENTORY", "USER_ASSIGNED_DEVICES", "USER_ASSIGNED_DEVICES"]);
  assertEquals(urls.filter((x) => new URL(x).searchParams.get("pageToken") === "p2").length, 1);
  const a = ativoDoGoogle(r.resources.find((x) => x.externalId.endsWith("/1"))!)!;
  assertEquals(a.google_device_id, "cloud:devices/1");
  assertEquals(a.atributos.numero_serie, "SER-1");
  assertEquals(a.atributos.google_estado, "APPROVED");
  await assertRejects(() => collectCloudDevices(read, "tok", "my_customer/../x"), DelegatedError, "organization_changed");
});

Deno.test("cloud namespace never collides with mobile/ChromeOS ids", () => {
  const cloud = ativoDoGoogle(googleDeviceResource("cloud", { name: "abc" })!)!;
  const mobile = ativoDoGoogle(googleDeviceResource("mobile", { resourceId: "abc" })!)!;
  assert(cloud.google_device_id !== mobile.google_device_id);
});

// Fake Google: userinfo + Directory per OAuth token; Cloud Identity for the DWD token.
const ADMIN = { email: "admin@a.com", sub: "1111111", customer_id: "C0abc1" };
function google(opts: { userinfo?: any; user?: any; revoked?: boolean } = {}) {
  const calls: string[] = [];
  const read = async (url: string, token: string) => {
    calls.push(url);
    const u = new URL(url);
    if (u.origin === "https://openidconnect.googleapis.com") {
      if (opts.revoked) { const e: any = new Error("x"); e.code = "authorization_expired"; throw e; }
      return opts.userinfo ?? { email: "admin@a.com", email_verified: true, sub: "1111111" };
    }
    if (u.origin === "https://admin.googleapis.com")
      return opts.user ?? { id: "1111111", customerId: "C0abc1", isAdmin: true, suspended: false };
    assertEquals(token, "dwd");
    return u.searchParams.get("view") === "USER_ASSIGNED_DEVICES"
      ? (u.searchParams.get("pageToken") ? { devices: [{ name: "devices/2" }] } : { devices: [{ name: "devices/1" }], nextPageToken: "n" })
      : { devices: [{ name: "devices/1" }, { name: "devices/3" }] };
  };
  return { read, calls };
}
const base = (): Collection => ({ resources: [{ externalId: "device:google:mobile:1", kind: "device", name: "Pixel", signals: {} }], warnings: [] });

Deno.test("platform credential: missing secret is unavailable, never zero devices", async () => {
  const g = google(); const out = base();
  assertEquals(await collectCloudIdentity(g.read, { key: null, identity: ADMIN, oauthToken: "o" }, "C0abc1", out), { status: "unavailable" });
  assertEquals(out.resources.length, 1); assertEquals(g.calls.length, 0);
});

Deno.test("platform secret must be the fixed Akuris account", async () => {
  const { platformServiceAccount } = await import("./google-delegated.ts");
  assertEquals(platformServiceAccount(undefined), null);
  assertEquals(platformServiceAccount((await keyJson({ client_id: "999999999999" })).text), null);
  assertEquals(platformServiceAccount((await keyJson()).text)?.client_id, "110121051822981322395");
});

Deno.test("old connection without validated identity asks to re-authorise and never impersonates", async () => {
  let called = false; const g = google();
  const r = await collectCloudIdentity(g.read, { key: {} as any, identity: null, oauthToken: "o" }, "C0abc1", base(), async () => { called = true; return "dwd"; });
  assertEquals(r, { status: "reauthorization_required" }); assert(!called);
});

Deno.test("admin moved to another tenant, forged subject or revoked OAuth block DWD", async () => {
  for (const [g, expected] of [
    [google({ user: { id: "1111111", customerId: "C0OTHER", isAdmin: true } }), { status: "error", error: "organization_changed" }],
    [google({ user: { id: "1111111", customerId: "C0abc1", isAdmin: false } }), { status: "error", error: "admin_required" }],
    [google({ user: { id: "2222222", customerId: "C0abc1", isAdmin: true } }), { status: "error", error: "invalid_admin" }],
    [google({ userinfo: { email: "admin@a.com", email_verified: false, sub: "1111111" } }), { status: "error", error: "invalid_admin" }],
    [google({ revoked: true }), { status: "reauthorization_required" }],
  ] as const) {
    let called = false;
    const r = await collectCloudIdentity(g.read, { key: {} as any, identity: ADMIN, oauthToken: "o" }, "C0abc1", base(), async () => { called = true; return "dwd"; });
    assertEquals(r, expected); assert(!called);
  }
  // Saved identity from company B can never be used on company A's connection.
  let called = false;
  const r = await collectCloudIdentity(google().read, { key: {} as any, identity: { ...ADMIN, customer_id: "C0bbb2" }, oauthToken: "o" }, "C0abc1", base(),
    async () => { called = true; return "dwd"; });
  assertEquals(r, { status: "error", error: "organization_changed" }); assert(!called);
  // A different admin than the one validated at consent requires re-authorisation.
  const other = await collectCloudIdentity(google().read, { key: {} as any, identity: { ...ADMIN, sub: "3333333" }, oauthToken: "o" }, "C0abc1", base(), async () => "dwd");
  assertEquals(other, { status: "reauthorization_required" });
});

Deno.test("delegation not authorised yet is pending, other modules intact", async () => {
  const out = base();
  const r = await collectCloudIdentity(google().read, { key: {} as any, identity: ADMIN, oauthToken: "o" }, "C0abc1", out,
    async () => { throw new DelegatedError("delegation_missing"); });
  assertEquals(r, { status: "delegation_pending" }); assertEquals(out.resources.length, 1);
});

Deno.test("authorised: subject is the verified admin, both views paginated, idempotent ids", async () => {
  let subject = "";
  const run = async () => { const out = base();
    const r = await collectCloudIdentity(google().read, { key: {} as any, identity: ADMIN, oauthToken: "o" }, "C0abc1", out, async (_k, s) => { subject = s; return "dwd"; });
    return { r, ids: out.resources.map((x) => x.externalId).sort() }; };
  const a = await run(), b = await run();
  assertEquals(subject, "admin@a.com");
  assertEquals(a.r, { status: "active", count: 3 });
  assertEquals(a.ids, b.ids);
  assertEquals(a.ids.length, 4);
});

Deno.test("identity scopes: openid + email only; partial grant detected", async () => {
  const { identityGranted, GOOGLE_IDENTITY_SCOPES } = await import("./google-workspace.ts");
  assertEquals(GOOGLE_IDENTITY_SCOPES, ["openid", "email"]);
  assert(identityGranted("openid https://www.googleapis.com/auth/userinfo.email"));
  assert(!identityGranted("https://www.googleapis.com/auth/userinfo.email"));
  assert(!identityGranted("openid"));
});

Deno.test("probe uses my_customer, one page, company inventory, and still validates the tenant customer id", async () => {
  const { probeDevices } = await import("./google-delegated.ts");
  const urls: string[] = [];
  await probeDevices(async (u: string) => { urls.push(u); return {}; }, "tok", "C01e4o1h0");
  const u = new URL(urls[0]);
  assertEquals(u.searchParams.get("customer"), "customers/my_customer");
  assertEquals(u.searchParams.get("pageSize"), "1");
  assertEquals(u.searchParams.get("view"), "COMPANY_INVENTORY");
  await assertRejects(() => probeDevices(async () => ({}), "tok", ""), DelegatedError, "organization_changed");
});
