import { assertEquals } from "jsr:@std/assert";
import { evaluateRiskRules } from "./integration-risk-rules.ts";
const now = new Date("2026-11-25T00:00:00Z");
const u = (s: Record<string, unknown>) => ({ kind: "identity", signals: { enabled: true, ...s } });
const r = (x: unknown[]) => evaluateRiskRules(x as never, now).map((f) => f.regra_id);

Deno.test("admin without MFA fires, unknown MFA does not", () => {
  assertEquals(r([u({ email: "a", super_admin: true, mfa_registered: false })]), ["admin_sem_mfa"]);
  assertEquals(r([u({ email: "a", super_admin: true, mfa_registered: null })]), []);
});
Deno.test("enforced MFA or suspended accounts do not fire", () => {
  assertEquals(r([u({ mfa_registered: false, mfa_enforced: true }), u({ mfa_registered: false, suspended: true })]), []);
});
Deno.test("more than 4 admins fires", () => {
  const a = Array.from({ length: 5 }, (_, i) => u({ email: `a${i}`, privileged: true, mfa_registered: true }));
  assertEquals(r(a), ["excesso_admins"]);
  assertEquals(r(a.slice(1)), []);
});
Deno.test("inactive over 90 days fires", () => {
  assertEquals(r([u({ mfa_registered: true, last_login_at: "2026-08-01T00:00:00Z" })]), ["contas_inativas"]);
  assertEquals(r([u({ mfa_registered: true, last_login_at: "2026-10-01T00:00:00Z" })]), []);
});
Deno.test("devices: non compliant, unencrypted, stale", () => {
  assertEquals(r([{ kind: "device", signals: { compliant: false, encrypted: false, lastCheckinDays: 40 } }]),
    ["dispositivos_nao_conformes", "dispositivos_sem_criptografia", "dispositivos_sem_sincronizar"]);
  assertEquals(r([{ kind: "device", signals: { compliance: "unknown" } }]), []);
});
