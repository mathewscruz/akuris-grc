import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  GOOGLE_WORKSPACE_SCOPES, missingScopes, customerChange, googlePages, googleUserResource,
  summarizeLogins, googleDeviceResource, collectGoogleWorkspace, ativoDoGoogle,
} from "./google-workspace.ts";
import { identityImportRow } from "./integration-model.ts";

Deno.test("only the 8 read-only scopes, no write/gmail/cloud-platform", () => {
  assertEquals(GOOGLE_WORKSPACE_SCOPES.length, 8);
  for (const s of GOOGLE_WORKSPACE_SCOPES) {
    assert(s.startsWith("https://www.googleapis.com/auth/"));
    assert(s.endsWith(".readonly"), s);
    assert(!/gmail|cloud-platform|user\.security/.test(s));
  }
});
Deno.test("missing scopes detected on partial grant", () => {
  assertEquals(missingScopes(GOOGLE_WORKSPACE_SCOPES.join(" ")), []);
  assertEquals(missingScopes(GOOGLE_WORKSPACE_SCOPES.slice(1).join(" ")).length, 1);
  assertEquals(missingScopes(undefined).length, 8);
});
Deno.test("reconnect refuses silent organisation change", () => {
  assertEquals(customerChange(undefined, "C01"), "ok");
  assertEquals(customerChange("C01", "C01"), "ok");
  assertEquals(customerChange("C01", "C02"), "changed");
});
Deno.test("pagination follows pageToken and stays on origin", async () => {
  const calls: string[] = [];
  const read = async (url: string, _t: string, origin: string) => {
    calls.push(url); assert(url.startsWith(origin));
    const p = new URL(url).searchParams.get("pageToken");
    return p ? { users: [{ id: "2" }] } : { users: [{ id: "1" }], nextPageToken: "x" };
  };
  const r = await googlePages(read, "t", "https://admin.googleapis.com", "/admin/directory/v1/users", {}, "users");
  assertEquals(r.items.length, 2); assertEquals(r.partial, false); assertEquals(calls.length, 2);
});
Deno.test("endless pagination becomes partial, not complete", async () => {
  const read = async () => ({ items: [{}], nextPageToken: "again" });
  const r = await googlePages(read, "t", "https://admin.googleapis.com", "/x", {}, "items");
  assertEquals(r.partial, true);
});
Deno.test("user signals: google origin, MFA, suspended, admin; unknown stays null", () => {
  const u = googleUserResource({ id: "9", primaryEmail: "a@x.com", suspended: true, isAdmin: false, isDelegatedAdmin: true,
    isEnrolledIn2Sv: true, isEnforcedIn2Sv: false, lastLoginTime: "1970-01-01T00:00:00.000Z" }, null, null);
  assertEquals(u.signals.enabled, false);
  assertEquals(u.signals.privileged, true);
  assertEquals(u.signals.admin_roles, null);
  assertEquals(u.signals.last_login_at, null);
  assertEquals(u.signals.login_window_days, null);
  assertEquals(identityImportRow(u, "c")?.origem, "google_workspace");
  const bare = googleUserResource({ id: "1", primaryEmail: "b@x.com" }, null, null);
  assertEquals(bare.signals.privileged, null);
  assertEquals(identityImportRow(bare, "c"), null);
});
Deno.test("Microsoft identities still import as entra_id", () => {
  const row = identityImportRow({ externalId: "user:1", kind: "identity", name: "x", signals: { privileged: false } }, "c");
  assertEquals(row?.origem, "entra_id");
});
Deno.test("login summary keeps last success and failures per user", () => {
  const m = summarizeLogins([
    { actor: { email: "A@x.com" }, id: { time: "2026-01-02" }, events: [{ name: "login_success" }] },
    { actor: { email: "a@x.com" }, id: { time: "2026-01-03" }, events: [{ name: "login_failure" }] },
  ]);
  assertEquals(m.get("a@x.com"), { last: "2026-01-02", failures: 1 });
});
Deno.test("devices: stable id, untrusted serial dropped, no compliance claim", () => {
  const d = googleDeviceResource("chromeos", { deviceId: "abc", serialNumber: "0000", model: "CB", osVersion: "120" })!;
  assertEquals(d.externalId, "device:google:chromeos:abc");
  assertEquals(d.signals.serial_number, null);
  assertEquals(d.signals.compliance, "unknown");
  assertEquals(ativoDoGoogle(d)?.google_device_id, "chromeos:abc");
  assertEquals(googleDeviceResource("mobile", {}), null);
});
Deno.test("one module failing never drops the others", async () => {
  const read = async (url: string) => {
    if (url.includes("/chromeos")) { const e: any = new Error("x"); e.code = "permission_missing"; throw e; }
    if (url.includes("/mobile")) return { mobiledevices: [{ resourceId: "m1", model: "P" }] };
    return {};
  };
  const r = await collectGoogleWorkspace(read, "t", "C01", ["dispositivos"]);
  assertEquals(r.resources.length, 1);
  assert(r.warnings.includes("module:dispositivos:chromeos_permission_missing"));
});
Deno.test("partial role listing never means 'no privileges'", async () => {
  const read = async (url: string) => {
    if (url.includes("/roleassignments")) return { items: [], nextPageToken: "n" };
    if (url.includes("/roles")) return { items: [] };
    if (url.includes("/users")) return { users: [{ id: "u", primaryEmail: "u@x", isAdmin: true }] };
    return {};
  };
  const r = await collectGoogleWorkspace(read, "t", "C01", ["usuarios"]);
  const u = r.resources.find((x) => x.externalId === "user:u")!;
  assertEquals(u.signals.admin_roles, null);
  assertEquals(u.signals.privileged, true);
  assert(r.warnings.includes("module:usuarios:roles_partial"));
});

Deno.test("Cloud Identity is never requested via OAuth nor called", async () => {
  assert(!GOOGLE_WORKSPACE_SCOPES.some((x) => x.includes("cloud-identity") || x.includes("cloud-platform")));
  const urls: string[] = [];
  const r = await collectGoogleWorkspace(async (u: string) => { urls.push(u); return {}; }, "t", "C01", ["dispositivos"]);
  assert(!urls.some((u) => u.includes("cloudidentity")));
  assert(!r.warnings.some((w) => w.startsWith("module:dispositivos")));
});
