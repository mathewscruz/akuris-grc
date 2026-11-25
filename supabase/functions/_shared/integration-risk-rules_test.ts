import { assertEquals } from "jsr:@std/assert";
import { coveredConfigRules, evaluateRiskRules, evaluateSecurity } from "./integration-risk-rules.ts";
import { incidentCategory, type SecurityCollection } from "./integration-security.ts";
import { googleDeviceResource, googleUserResource } from "./google-workspace.ts";
import { intuneDeviceResource } from "./integration-providers.ts";

const NOW = new Date("2026-11-25T00:00:00Z");
const ids = (x: unknown[]) => evaluateRiskRules(x as never, NOW).map((f) => f.regra_id);
// Real collector output (Google Directory user → googleUserResource; Graph managedDevice → intuneDeviceResource).
const gUser = (o: Record<string, unknown>) => googleUserResource({ id: o.primaryEmail, suspended: false, archived: false,
  isAdmin: false, isDelegatedAdmin: false, isEnrolledIn2Sv: true, isEnforcedIn2Sv: false, lastLoginTime: "2026-11-20T00:00:00Z", ...o }, null, null);
const iDev = (o: Record<string, unknown>) => intuneDeviceResource({ id: "d1", deviceName: "PC-1", complianceState: "compliant",
  isEncrypted: true, lastSyncDateTime: "2026-11-24T00:00:00Z", serialNumber: "SN12345", ...o });

Deno.test("Intune real 'noncompliant' fires; compliant/unknown do not", () => {
  assertEquals(ids([iDev({ complianceState: "noncompliant" })]), ["dispositivos_nao_conformes"]);
  assertEquals(ids([iDev({}), iDev({ complianceState: "unknown" })]), []);
});

Deno.test("Intune real lastSyncDateTime older than 30 days fires stale", () => {
  assertEquals(ids([iDev({ lastSyncDateTime: "2026-09-01T00:00:00Z" })]), ["dispositivos_sem_sincronizar"]);
  assertEquals(ids([iDev({ lastSyncDateTime: null })]), []);
});

Deno.test("Intune isEncrypted false fires; null does not", () => {
  assertEquals(ids([iDev({ isEncrypted: false })]), ["dispositivos_sem_criptografia"]);
  assertEquals(ids([iDev({ isEncrypted: null })]), []);
});

Deno.test("Google super admin without 2SV enrolment fires; delegated admin or unknown never", () => {
  assertEquals(ids([gUser({ primaryEmail: "a@x", isAdmin: true, isEnrolledIn2Sv: false })]), ["admin_sem_mfa"]);
  assertEquals(ids([gUser({ primaryEmail: "b@x", isDelegatedAdmin: true, isEnrolledIn2Sv: false })]), []);
  assertEquals(ids([gUser({ primaryEmail: "c@x", isAdmin: true, isEnrolledIn2Sv: undefined })]), []);
});

Deno.test("generalist rules stay off: one user without 2SV, inactive accounts", () => {
  assertEquals(ids([gUser({ primaryEmail: "u@x", isEnrolledIn2Sv: false, lastLoginTime: "2025-01-01T00:00:00Z" })]), []);
});

Deno.test("too many admins counts only global/super admins", () => {
  const supers = Array.from({ length: 5 }, (_, i) => gUser({ primaryEmail: `s${i}@x`, isAdmin: true }));
  assertEquals(ids(supers), ["excesso_admins"]);
  const delegated = Array.from({ length: 8 }, (_, i) => gUser({ primaryEmail: `d${i}@x`, isDelegatedAdmin: true }));
  assertEquals(ids([...supers.slice(1), ...delegated]), []);
  // Microsoft only says "privileged" (any role): never counted as global.
  const ms = Array.from({ length: 6 }, (_, i) => ({ kind: "identity", name: `m${i}`, signals: { privileged: true, mfa_registered: true } }));
  assertEquals(ids(ms), []);
  assertEquals(coveredConfigRules(ms as never).includes("excesso_admins"), false);
});

Deno.test("coverage: unknown fields, Google 'unknown' compliance, empty data never resolve", () => {
  assertEquals(coveredConfigRules([]), []);
  const g = googleDeviceResource("mobile", { resourceId: "m1", model: "Pixel", lastSync: "2026-11-20T00:00:00Z" })!;
  assertEquals(coveredConfigRules([g]).includes("dispositivos_nao_conformes"), false);
  assertEquals(coveredConfigRules([g]).includes("dispositivos_sem_criptografia"), false);
  // One device with an unknown value means the rule was not fully evaluated.
  assertEquals(coveredConfigRules([iDev({}), iDev({ id: "d2", isEncrypted: null })]).includes("dispositivos_sem_criptografia"), false);
  assertEquals(coveredConfigRules([iDev({})]).sort(), ["dispositivos_nao_conformes", "dispositivos_sem_criptografia", "dispositivos_sem_sincronizar"]);
});

Deno.test("coverage: users present but devices module absent does not cover device rules", () => {
  const c = coveredConfigRules([gUser({ primaryEmail: "a@x", isAdmin: true })]);
  assertEquals(c.sort(), ["admin_sem_mfa", "excesso_admins"]);
  assertEquals(coveredConfigRules([gUser({ primaryEmail: "a@x", isAdmin: true, isEnrolledIn2Sv: undefined })]), ["excesso_admins"]);
});

Deno.test("re-evaluation is deterministic (same key, no duplicates)", () => {
  const r = [iDev({ complianceState: "noncompliant" }), iDev({ id: "d2", deviceName: "PC-1", complianceState: "noncompliant" })];
  const a = evaluateRiskRules(r as never, NOW), b = evaluateRiskRules(r as never, NOW);
  assertEquals(a, b);
  assertEquals(a[0].evidencia, { total: 1, itens: ["PC-1"] });
});

Deno.test("defender incidents are grouped by theme, keyed by incident", () => {
  const sec: SecurityCollection = { status: { ms_incidents: "ok" }, signals: [
    { source: "ms_incidents", incidente: "1", category: "malware", alvos: ["pc1", "pc2"] },
    { source: "ms_incidents", incidente: "2", category: "malware", alvos: ["pc2"] },
  ] };
  const r = evaluateSecurity(sec);
  assertEquals(r.findings.map((f) => [f.regra_id, f.chave, f.evidencia.total]), [["alerta_malware", "1,2", 2]]);
  assertEquals(r.covered.includes("alerta_ransomware"), true);
});

Deno.test("partial or forbidden source finds nothing and covers nothing", () => {
  const r = evaluateSecurity({ status: { ms_recommendations: "partial", ms_risky_users: "permission_missing" }, signals: [] });
  assertEquals(r, { findings: [], covered: [] });
});

Deno.test("incident category mapping", () => {
  assertEquals(incidentCategory("Ransomware behavior"), "ransomware");
  assertEquals(incidentCategory("Suspicious sign-in"), "conta_comprometida");
});
