import { assertEquals } from "jsr:@std/assert";
import { coveredConfigRules, evaluateRiskRules, evaluateSecurity } from "./integration-risk-rules.ts";
import { collectMicrosoftSecurity, incidentCategory } from "./integration-security.ts";
import { ProviderError } from "./integration-providers.ts";
import { riskCoverage } from "./integration-risk-rules.ts";
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
  assertEquals(a[0].evidencia, { total: 1, itens: ["PC-1"], ids: ["PC-1"] });
});


// ---- Full collector mocks with official response shapes (Graph incidents / Secure Score, MDE recommendations).
const INCIDENT = (o: Record<string, unknown> = {}) => ({
  id: "29", status: "active", severity: "high", classification: "truePositive", determination: "multiStagedAttack",
  displayName: "Multi-stage incident involving Execution & Command and control on one endpoint",
  incidentWebUrl: "https://security.microsoft.com/incident2/29/overview?tid=t", createdDateTime: "2025-01-22T12:09:23Z", ...o,
});
const ALERT_WITH_EVIDENCE = { id: "da1", title: "A WMI event filter was bound to a suspicious event consumer", category: "Persistence", evidence: [
  { "@odata.type": "#microsoft.graph.security.deviceEvidence", deviceDnsName: "w11pro-test", hostName: "w11pro-test" },
  { "@odata.type": "#microsoft.graph.security.userEvidence", userAccount: { accountName: "adminlocal", domainName: "W11PRO-TEST", userPrincipalName: null, displayName: null } },
  { "@odata.type": "#microsoft.graph.security.ipEvidence", ipAddress: "fe80::1" },
] };
type Routes = Record<string, unknown | Error>;
const mock = (routes: Routes) => {
  const calls: string[] = [];
  const read = async (url: string) => {
    calls.push(url);
    const k = Object.keys(routes).find((r) => url.includes(r));
    if (!k) throw new ProviderError("not_found");
    const v = routes[k];
    if (v instanceof Error) throw v;
    return typeof v === "function" ? (v as (u: string) => unknown)(url) : v;
  };
  return { read, calls };
};
const PROFILES = { value: [
  { id: "MFARegistrationV2", title: "Ensure all users can complete MFA", maxScore: 9, deprecated: false, actionUrl: "https://security.microsoft.com/securescore?actionId=MFARegistrationV2", controlStateUpdates: [] },
  { id: "AdminMFAV2", title: "Require MFA for administrative roles", maxScore: 10, deprecated: false, actionUrl: "https://x/AdminMFAV2", controlStateUpdates: [{ state: "Default" }] },
  { id: "IgnoredCtl", title: "Ignored", maxScore: 8, deprecated: false, controlStateUpdates: [{ state: "Ignored" }] },
  { id: "OldCtl", title: "Old", maxScore: 8, deprecated: true },
  { id: "NotLicensed", title: "Needs P2", maxScore: 8, deprecated: false },
] };
const SCORE = (scores: { controlName: string; score: unknown }[]) => ({ value: [{ id: "t_2026", controlScores: scores }] });
const REC = (o: Record<string, unknown>) => ({ id: "va-_-microsoft-_-edge", recommendationName: "Update Microsoft Edge", status: "Active",
  publicExploit: true, activeAlert: false, exposedMachinesCount: 193, exposedCriticalDevices: 116, severityScore: 0, ...o });
const ALL_OK = (over: Routes = {}): Routes => ({
  "/security/incidents": { value: [INCIDENT()] },
  "/identityProtection/riskyUsers": { value: [] },
  "/security/secureScores": SCORE([{ controlName: "MFARegistrationV2", score: 4.5 }, { controlName: "AdminMFAV2", score: 10 }, { controlName: "IgnoredCtl", score: 0 }]),
  "/security/secureScoreControlProfiles": PROFILES,
  "/api/recommendations": { value: [REC({})] },
  ...over,
});
const run = async (routes: Routes) => { const m = mock(routes); return { sec: await collectMicrosoftSecurity(m.read, "g", async () => "m"), calls: m.calls }; };

Deno.test("incidents: official response without $expand still yields a suggestion by id/displayName/url, no invented targets", async () => {
  const { sec, calls } = await run(ALL_OK());
  assertEquals(calls[0].includes("$expand=alerts"), true);
  assertEquals(calls[0].includes("createdDateTime"), false, "no date window: old open incidents stay relevant");
  const r = evaluateSecurity(sec);
  const f = r.findings.find((x) => x.regra_id.startsWith("alerta_"))!;
  assertEquals([f.regra_id, f.chave, f.evidencia.total, f.evidencia.ids], ["alerta_malware", "ms_incidents:malware", 1, ["29"]]);
  assertEquals(f.evidencia.refs![0].url, "https://security.microsoft.com/incident2/29/overview?tid=t");
  assertEquals(f.evidencia.alvos, undefined);
});

Deno.test("incidents: real alert evidence maps device and user targets", async () => {
  const { sec } = await run(ALL_OK({ "/security/incidents": { value: [INCIDENT({ alerts: [ALERT_WITH_EVIDENCE] })] } }));
  const f = evaluateSecurity(sec).findings.find((x) => x.regra_id.startsWith("alerta_"))!;
  assertEquals(f.evidencia.alvos, ["W11PRO-TEST\\adminlocal", "w11pro-test"]);
});

Deno.test("incidents: false/benign positive and resolved excluded; unknown classification kept", async () => {
  const { sec } = await run(ALL_OK({ "/security/incidents": { value: [
    INCIDENT({ id: "1", classification: "falsePositive" }), INCIDENT({ id: "2", classification: "informationalExpectedActivity" }),
    INCIDENT({ id: "3", status: "resolved" }), INCIDENT({ id: "4", classification: "unknown" }), INCIDENT({ id: "5", severity: "medium" }),
  ] } }));
  const f = evaluateSecurity(sec).findings.filter((x) => x.regra_id.startsWith("alerta_"));
  assertEquals(f.flatMap((x) => x.evidencia.ids), ["4"]);
});

Deno.test("stable key: reordering or changing members keeps the same key", async () => {
  const a = evaluateSecurity((await run(ALL_OK({ "/security/incidents": { value: [INCIDENT({ id: "7" }), INCIDENT({ id: "3" })] } }))).sec);
  const b = evaluateSecurity((await run(ALL_OK({ "/security/incidents": { value: [INCIDENT({ id: "3" }), INCIDENT({ id: "9" })] } }))).sec);
  const ka = a.findings.find((x) => x.regra_id === "alerta_malware")!, kb = b.findings.find((x) => x.regra_id === "alerta_malware")!;
  assertEquals(ka.chave, kb.chave);
  assertEquals(ka.evidencia.ids, ["3", "7"]);
});

Deno.test("secure score: explicit finite scores only; ignored/deprecated/unlicensed never a gap; gap stays numeric", async () => {
  const { sec } = await run(ALL_OK());
  const f = evaluateSecurity(sec).findings.find((x) => x.regra_id === "secure_score_recomendacoes")!;
  assertEquals(f.evidencia.ids, ["MFARegistrationV2"]);
  assertEquals(f.relevancia, 5, "4.5 gap rounds to an int, never a '4.5'::int cast");
  assertEquals(f.evidencia.refs![0].url, "https://security.microsoft.com/securescore?actionId=MFARegistrationV2");
  assertEquals(sec.status.ms_secure_score, "ok");
});

Deno.test("secure score: null score is not evaluated and source is partial (no coverage)", async () => {
  const { sec } = await run(ALL_OK({ "/security/secureScores": SCORE([{ controlName: "MFARegistrationV2", score: null }, { controlName: "AdminMFAV2", score: 10 }]) }));
  assertEquals(sec.status.ms_secure_score, "partial");
  assertEquals(evaluateSecurity(sec).covered.includes("secure_score_recomendacoes"), false);
  assertEquals(evaluateSecurity(sec).findings.some((x) => x.regra_id === "secure_score_recomendacoes"), false);
});

Deno.test("secure score: control leaving the top keeps the aggregate open (same key, still listed)", async () => {
  const many = { value: Array.from({ length: 8 }, (_, i) => ({ id: `C${i}`, title: `C${i}`, maxScore: 10, deprecated: false })) };
  const { sec } = await run(ALL_OK({ "/security/secureScoreControlProfiles": many,
    "/security/secureScores": SCORE(Array.from({ length: 8 }, (_, i) => ({ controlName: `C${i}`, score: i }))) }));
  const f = evaluateSecurity(sec).findings.find((x) => x.regra_id === "secure_score_recomendacoes")!;
  assertEquals(f.chave, "ms_secure_score");
  assertEquals(f.evidencia.total, 8, "all gaps are kept in ids; display is trimmed");
});

Deno.test("defender recommendations: official fields, relevance by alert/exploit/critical exposure", async () => {
  const { sec } = await run(ALL_OK({ "/api/recommendations": { value: [
    REC({ id: "a", publicExploit: false, activeAlert: false, exposedCriticalDevices: 0 }),
    REC({ id: "b", publicExploit: false, activeAlert: true, exposedCriticalDevices: 0, exposedMachinesCount: 2 }),
    REC({ id: "c", exposedMachinesCount: 0 }), REC({ id: "d", status: "Exception" }), REC({ id: "e" }),
  ] } }));
  const f = evaluateSecurity(sec).findings.find((x) => x.regra_id === "recomendacoes_defender")!;
  assertEquals(f.evidencia.ids, ["b", "e"]);
  assertEquals(f.evidencia.refs!.map((r) => r.id), ["b", "e"], "active alert ranks first");
});

Deno.test("defender recommendations: remaining nextLink or full page = partial, never ok", async () => {
  const { sec } = await run(ALL_OK({ "/api/recommendations": { value: [REC({})], "@odata.nextLink": "https://api.securitycenter.microsoft.com/api/recommendations?$skip=1" } }));
  assertEquals(sec.status.ms_recommendations, "partial");
  assertEquals(evaluateSecurity(sec).covered.includes("recomendacoes_defender"), false);
});

Deno.test("403, missing license and timeout never cover and never count as success", async () => {
  const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
  const { sec } = await run(ALL_OK({
    "/security/incidents": new ProviderError("permission_missing"),
    "/identityProtection/riskyUsers": new ProviderError("provider_http_4xx"),
    "/api/recommendations": timeout,
  }));
  assertEquals([sec.status.ms_incidents, sec.status.ms_risky_users, sec.status.ms_recommendations], ["permission_missing", "unavailable", "unavailable"]);
  assertEquals(sec.detalhes!.ms_recommendations!.motivo, "timeout");
  const r = evaluateSecurity(sec);
  assertEquals(r.covered.some((x) => x.startsWith("alerta_") || x === "usuarios_alto_risco" || x === "recomendacoes_defender"), false);
  const cov = riskCoverage("microsoft", [], true, sec);
  assertEquals(cov.alerta_malware.status, "permission_missing");
  assertEquals(cov.recomendacoes_defender, { status: "unavailable", motivo: "timeout" });
});

Deno.test("google coverage lists not-collected checks explicitly", () => {
  const cov = riskCoverage("google_workspace", [gUser({ primaryEmail: "a@x", isAdmin: true })], true, null);
  assertEquals(cov.google_alert_center, { status: "not_evaluated", motivo: "nao_coletado" });
  assertEquals(cov.admin_sem_mfa.status, "ok");
  assertEquals(cov.dispositivos_sem_sincronizar.status, "not_evaluated");
  assertEquals(riskCoverage("google_workspace", [], false, null).admin_sem_mfa.status, "partial");
});

Deno.test("incident category mapping", () => {
  assertEquals(incidentCategory("Ransomware behavior"), "ransomware");
  assertEquals(incidentCategory("Suspicious sign-in"), "conta_comprometida");
});
