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
import { capFindings, evaluateSecurity } from "./integration-risk-rules.ts";
import { googleAlertCategory, msAlertCategory } from "./integration-security.ts";

Deno.test("alerts are grouped by theme, one finding per category", () => {
  const sec = { status: { ms_alerts: "ok" as const }, signals: [
    { source: "ms_alerts" as const, severity: "high" as const, category: "malware" as const, target: "pc1" },
    { source: "ms_alerts" as const, severity: "high" as const, category: "malware" as const, target: "pc2" },
    { source: "ms_alerts" as const, severity: "high" as const, category: "malware" as const, target: "pc1" },
  ] };
  const r = evaluateSecurity(sec);
  assertEquals(r.findings.map((f) => [f.regra_id, f.evidencia.total]), [["alerta_malware", 2]]);
  assertEquals(r.covered.includes("alerta_ransomware"), true);
});
Deno.test("unlicensed source covers nothing and finds nothing", () => {
  const r = evaluateSecurity({ status: { ms_vulns: "permission_missing", ms_risky_users: "unavailable" }, signals: [] });
  assertEquals(r, { findings: [], covered: [] });
});
Deno.test("cap keeps the 10 most relevant and uncovers the rest", () => {
  const f = Array.from({ length: 12 }, (_, i) => ({ regra_id: `r${i}`, probabilidade: i < 2 ? 1 : 5, impacto: 5, evidencia: { total: 1, itens: [] } }));
  const r = capFindings(f, f.map((x) => x.regra_id));
  assertEquals(r.findings.length, 10);
  assertEquals(r.covered.includes("r0") || r.covered.includes("r1"), false);
});
Deno.test("category mapping", () => {
  assertEquals(msAlertCategory("Ransomware", "x"), "ransomware");
  assertEquals(msAlertCategory("InitialAccess", "Phishing email delivered"), "phishing");
  assertEquals(googleAlertCategory("Suspicious login"), "conta_comprometida");
  assertEquals(googleAlertCategory("Government-backed attack"), "conta_comprometida");
  assertEquals(googleAlertCategory("DLP rule triggered"), "vazamento_dados");
});
