import { assertEquals } from "jsr:@std/assert";
import { coveredConfigRules, evaluateRiskRules, evaluateSecurity } from "./integration-risk-rules.ts";
import { incidentCategory, type SecurityCollection } from "./integration-security.ts";

const NOW = new Date("2026-11-25T00:00:00Z");
const u = (s: Record<string, unknown>) => ({ kind: "identity", signals: { enabled: true, ...s } });
const ids = (x: unknown[]) => evaluateRiskRules(x as never, NOW).map((f) => f.regra_id);

Deno.test("admin without MFA fires; unknown MFA never fires", () => {
  assertEquals(ids([u({ email: "a", super_admin: true, mfa_registered: false })]), ["admin_sem_mfa"]);
  assertEquals(ids([u({ email: "a", super_admin: true, mfa_registered: null })]), []);
});

Deno.test("enforced MFA or suspended accounts do not fire", () => {
  assertEquals(ids([u({ mfa_registered: false, mfa_enforced: true }), u({ mfa_registered: false, suspended: true })]), []);
});

Deno.test("more than 4 admins fires", () => {
  const a = Array.from({ length: 5 }, (_, i) => u({ email: `a${i}`, privileged: true, mfa_registered: true }));
  assertEquals(ids(a), ["excesso_admins"]);
  assertEquals(ids(a.slice(1)), []);
});

Deno.test("inactivity needs an explicit last login", () => {
  assertEquals(ids([u({ email: "old@x.com", mfa_registered: true, last_login_at: "2026-01-05T00:00:00Z" })]), ["contas_inativas"], "a login 10 months ago is inactive");
  assertEquals(ids([u({ email: "new@x.com", mfa_registered: true, last_login_at: "2026-11-01T00:00:00Z" })]), [], "a recent login is not inactive");
  assertEquals(ids([u({ email: "none@x.com", mfa_registered: true })]), [], "no last-login data cannot prove inactivity");
});

Deno.test("coverage only for fields really collected", () => {
  assertEquals(coveredConfigRules([u({ mfa_registered: false, privileged: true })]), ["admin_sem_mfa", "usuarios_sem_mfa", "excesso_admins"]);
  assertEquals(coveredConfigRules([u({}), { kind: "device", signals: { compliance: "unknown" } }]), ["dispositivos_nao_conformes"]);
  assertEquals(coveredConfigRules([{ kind: "device", signals: { model: "x" } }]), []);
});

Deno.test("defender incidents are grouped by theme, keyed by incident", () => {
  const sec: SecurityCollection = { status: { ms_incidents: "ok" }, signals: [
    { source: "ms_incidents", incidente: "1", category: "malware", alvos: ["pc1", "pc2"] },
    { source: "ms_incidents", incidente: "2", category: "malware", alvos: ["pc2"] },
  ] };
  const r = evaluateSecurity(sec);
  assertEquals(r.findings.map((f) => [f.regra_id, f.chave, f.evidencia.total]), [["alerta_malware", "1,2", 2]]);
  assertEquals(r.findings[0].fonte, "Microsoft Defender");
  assertEquals(r.covered.includes("alerta_ransomware"), true);
});

Deno.test("partial or forbidden source finds nothing and covers nothing", () => {
  const r = evaluateSecurity({ status: { ms_recommendations: "partial", ms_risky_users: "permission_missing" }, signals: [] });
  assertEquals(r, { findings: [], covered: [] });
});

Deno.test("secure score and defender recommendations are grouped", () => {
  const r = evaluateSecurity({ status: { ms_secure_score: "ok", ms_recommendations: "ok" }, signals: [
    { source: "ms_secure_score", target: "MFA for admins", gap: 10 },
    { source: "ms_recommendations", target: "Block untrusted", devices: 7 },
  ] });
  assertEquals(r.findings.map((f) => [f.regra_id, f.evidencia.total, f.severidade]), [["secure_score_recomendacoes", 1, "alta"], ["recomendacoes_defender", 1, "alta"]]);
});

Deno.test("incident category mapping", () => {
  assertEquals(incidentCategory("Ransomware behavior"), "ransomware");
  assertEquals(incidentCategory("Phishing email delivered"), "phishing");
  assertEquals(incidentCategory("Credential harvesting"), "conta_comprometida");
  assertEquals(incidentCategory("Suspicious sign-in"), "conta_comprometida");
  assertEquals(incidentCategory("Data exfiltration"), "vazamento_dados");
});
