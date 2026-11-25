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

Deno.test("Cloud Identity failure or foreign organisation leaves other modules intact", async () => {
  const base = (): Collection => ({ resources: [{ externalId: "device:google:mobile:1", kind: "device", name: "Pixel", signals: {} }], warnings: [] });
  const read = async () => ({ devices: [] });
  let out = base();
  assertEquals((await collectCloudIdentity(read, null, "C0abc1", out)).status, "not_configured");
  assertEquals(out.resources.length, 1);
  let called = false;
  out = base();
  const foreign = await collectCloudIdentity(read, { key: {}, admin_email: "a@b.com", customer_id: "C0abc2" }, "C0abc1", out, async () => { called = true; return "t"; });
  assertEquals(foreign, { status: "error", error: "organization_changed" });
  assert(!called);
  out = base();
  const failed = await collectCloudIdentity(read, { key: {}, admin_email: "a@b.com", customer_id: "C0abc1" }, "C0abc1", out,
    async () => { throw new DelegatedError("delegation_missing"); });
  assertEquals(failed, { status: "error", error: "delegation_missing" });
  assertEquals(out.resources.length, 1);
  assertEquals(out.warnings, ["cloud_identity:delegation_missing"]);
  out = base();
  const ok = await collectCloudIdentity(async () => ({ devices: [{ name: "devices/9" }] }), { key: {}, admin_email: "a@b.com", customer_id: "C0abc1" }, "C0abc1", out, async () => "t");
  assertEquals(ok, { status: "active", count: 1 });
  assertEquals(out.resources.length, 2);
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
