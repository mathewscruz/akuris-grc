import { assertEquals } from "jsr:@std/assert";
import { configFixed, coveredConfigRules, decideLifecycle, evaluateRiskRules, evaluateSecurity, provenRules } from "./integration-risk-rules.ts";
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
  assertEquals([a[0].evidencia.total, a[0].evidencia.itens, a[0].evidencia.ids], [2, ["PC-1"], ["device:d1", "device:d2"]], "ids are stable externalIds, not names");
  assertEquals(a[0].evidencia.refs!.map((r) => r.nome), ["PC-1 · SN SN12345", "PC-1 · SN SN12345"]);
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
  assertEquals(sec.status.ms_secure_score, "partial", "a control absent from the tenant score is unknown, not 'not applicable'");
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


// ---- Lifecycle authorisation: read coverage never resolves; only per-id remediation proof does (collector + decision).
const msDecide = async (routes: Routes, open: { regra_id: string; ids: string[] | null }[]) => {
  const { sec, calls } = await run(routes);
  const achados = evaluateSecurity(sec).findings;
  return { resolved: await provenRules(open, achados, (r, id) => sec.proveFixed!(r, id)), calls, sec };
};
const PROFILES_NO_UNLICENSED = { value: PROFILES.value.filter((p) => p.id !== "NotLicensed") };
const byIncident = (one: unknown) => (u: string) => u.includes("/security/incidents/") ? one : { value: [] };

Deno.test("secure score gap -> controlScores [] with profiles present never resolves", async () => {
  const { resolved, sec } = await msDecide(ALL_OK({ "/security/secureScores": SCORE([]), "/security/secureScoreControlProfiles": PROFILES_NO_UNLICENSED }),
    [{ regra_id: "secure_score_recomendacoes", ids: ["MFARegistrationV2"] }]);
  assertEquals(sec.status.ms_secure_score, "partial");
  assertEquals(resolved, []);
});
Deno.test("secure score: same control now at max with explicit score resolves", async () => {
  const { resolved } = await msDecide(ALL_OK({ "/security/secureScoreControlProfiles": PROFILES_NO_UNLICENSED,
    "/security/secureScores": SCORE([{ controlName: "MFARegistrationV2", score: 9 }, { controlName: "AdminMFAV2", score: 10 }, { controlName: "IgnoredCtl", score: 0 }]) }),
    [{ regra_id: "secure_score_recomendacoes", ids: ["MFARegistrationV2"] }]);
  assertEquals(resolved, ["secure_score_recomendacoes"]);
});
Deno.test("incident gone from filter (retention/severity/category change) is not fixed unless GET says resolved", async () => {
  const open = [{ regra_id: "alerta_malware", ids: ["29"] }];
  const gone404 = await msDecide(ALL_OK({ "/security/incidents": byIncident(new ProviderError("not_found")) }), open);
  assertEquals(gone404.resolved, [], "404/retention never proves");
  const medium = await msDecide(ALL_OK({ "/security/incidents": byIncident(INCIDENT({ severity: "medium" })) }), open);
  assertEquals(medium.resolved, [], "severity changed but still active");
  const forbidden = await msDecide(ALL_OK({ "/security/incidents": byIncident(new ProviderError("permission_missing")) }), open);
  assertEquals(forbidden.resolved, []);
  const fixed = await msDecide(ALL_OK({ "/security/incidents": byIncident(INCIDENT({ status: "resolved" })) }), open);
  assertEquals(fixed.resolved, ["alerta_malware"]);
  assertEquals(fixed.calls.some((c) => c.includes("/security/incidents/29")), true);
});
Deno.test("incident list 403: source not ok, nothing resolves", async () => {
  const r = await msDecide(ALL_OK({ "/security/incidents": new ProviderError("permission_missing") }), [{ regra_id: "alerta_malware", ids: ["29"] }]);
  assertEquals(r.resolved, []);
});
Deno.test("defender recommendation resolves only with exposedMachinesCount explicitly 0", async () => {
  const open = [{ regra_id: "recomendacoes_defender", ids: ["va-_-microsoft-_-edge"] }];
  const rec = (one: unknown) => (u: string) => u.includes("/api/recommendations/") ? one : { value: [] };
  assertEquals((await msDecide(ALL_OK({ "/api/recommendations": rec(REC({ exposedMachinesCount: null })) }), open)).resolved, []);
  assertEquals((await msDecide(ALL_OK({ "/api/recommendations": rec(new ProviderError("not_found")) }), open)).resolved, []);
  assertEquals((await msDecide(ALL_OK({ "/api/recommendations": rec(REC({ exposedMachinesCount: 0 })) }), open)).resolved, ["recomendacoes_defender"]);
});
Deno.test("legacy suggestion without ids never auto-resolves; current finding blocks resolution", async () => {
  assertEquals(await provenRules([{ regra_id: "alerta_malware", ids: null }], [], () => true), []);
  const f = evaluateRiskRules([iDev({ complianceState: "noncompliant" })] as never, NOW);
  assertEquals(await provenRules([{ regra_id: "dispositivos_nao_conformes", ids: ["device:d1"] }], f, () => true), []);
});
Deno.test("config: only problematic device vanishes while another is healthy -> not fixed", async () => {
  const now = [iDev({ id: "d2", deviceName: "PC-2" })];
  const open = [{ regra_id: "dispositivos_nao_conformes", ids: ["device:d1"] }];
  assertEquals(coveredConfigRules(now as never).includes("dispositivos_nao_conformes"), true, "read coverage stays visible");
  assertEquals(await provenRules(open, evaluateRiskRules(now as never, NOW), (r, id) => configFixed(now as never, r, id, NOW)), []);
});
Deno.test("config: scope change (old ids absent) not fixed; all old ids present and remediated -> fixed", async () => {
  const open = [{ regra_id: "dispositivos_sem_criptografia", ids: ["device:d1", "device:d2"] }];
  const partial = [iDev({ id: "d1" })];
  assertEquals(await provenRules(open, [], (r, id) => configFixed(partial as never, r, id, NOW)), []);
  const unknown = [iDev({ id: "d1" }), iDev({ id: "d2", isEncrypted: null })];
  assertEquals(await provenRules(open, evaluateRiskRules(unknown as never, NOW), (r, id) => configFixed(unknown as never, r, id, NOW)), []);
  const fixed = [iDev({ id: "d1" }), iDev({ id: "d2" })];
  assertEquals(await provenRules(open, evaluateRiskRules(fixed as never, NOW), (r, id) => configFixed(fixed as never, r, id, NOW)), ["dispositivos_sem_criptografia"]);
});


// ---- Multi-scan lifecycle through decideLifecycle (the function the runner uses) + a store mirroring integracao_registrar_riscos.
type Row = { regra_id: string; chave: string; estado: string; evidencia: Record<string, unknown> };
const scanStore = () => {
  const rows = new Map<string, Row>(); let avisos = 0;
  const scan = async (resources: unknown[]) => {
    const open = [...rows.values()].filter((r) => ["aberta", "aceita", "descartada"].includes(r.estado)).map((r) => ({
      regra_id: r.regra_id, chave: r.chave, estado: r.estado, ids: (r.evidencia.ids as string[]) ?? null,
      prova_ids: (r.evidencia.prova_ids as string[]) ?? null, sem_prova: r.evidencia.sem_prova === true }));
    const achados = evaluateRiskRules(resources as never, NOW);
    const d = await decideLifecycle(open, achados, (r, id) => configFixed(resources as never, r, id, NOW));
    const keys = new Set<string>();
    for (const f of d.findings) {
      const k = `${f.regra_id}|${f.chave}`; keys.add(k); const prev = rows.get(k);
      if (!prev) { rows.set(k, { regra_id: f.regra_id, chave: f.chave, estado: "aberta", evidencia: f.evidencia }); avisos++; continue; }
      if (prev.estado === "corrigida") { prev.estado = "aberta"; avisos++; }
      prev.evidencia = f.evidencia;
    }
    for (const r of rows.values()) if (["aberta", "aceita"].includes(r.estado) && d.resolved.includes(r.regra_id) && !keys.has(`${r.regra_id}|${r.chave}`)) r.estado = "corrigida";
    return [...rows.values()];
  };
  return { scan, rows, avisos: () => avisos };
};
const A = (o: Record<string, unknown> = {}) => iDev({ id: "A", deviceName: "PC-A", complianceState: "noncompliant", ...o });
const B = (o: Record<string, unknown> = {}) => iDev({ id: "B", deviceName: "PC-B", complianceState: "noncompliant", ...o });

Deno.test("3 scans: A+B bad -> A vanishes/B bad -> B fixed/A absent keeps the suggestion open", async () => {
  const st = scanStore();
  await st.scan([A(), B()]);
  let r = await st.scan([B()]);
  assertEquals(r[0].evidencia.ids, ["device:B"], "UI shows current members");
  assertEquals(r[0].evidencia.prova_ids, ["device:A", "device:B"], "A not forgotten");
  r = await st.scan([B({ complianceState: "compliant" })]);
  assertEquals(r[0].estado, "aberta");
  r = await st.scan([B({ complianceState: "compliant" })]);
  assertEquals(r[0].estado, "aberta", "repeating never resolves without A");
  assertEquals(st.avisos(), 1, "no renotification");
});
Deno.test("A+B proven fixed resolves once; repeat neither duplicates nor renotifies; new cycle starts fresh", async () => {
  const st = scanStore();
  await st.scan([A(), B()]);
  await st.scan([B()]);
  let r = await st.scan([A({ complianceState: "compliant" }), B({ complianceState: "compliant" })]);
  assertEquals([r.length, r[0].estado], [1, "corrigida"]);
  r = await st.scan([A({ complianceState: "compliant" }), B({ complianceState: "compliant" })]);
  assertEquals([r.length, r[0].estado, st.avisos()], [1, "corrigida", 1]);
  r = await st.scan([B()]);
  assertEquals([r[0].estado, r[0].evidencia.prova_ids, st.avisos()], ["aberta", ["device:B"], 2], "reopened cycle uses current ids only");
  r = await st.scan([B({ complianceState: "compliant" })]);
  assertEquals(r[0].estado, "corrigida");
});
Deno.test("A proven fixed while B still bad drops A from the pending set", async () => {
  const st = scanStore();
  await st.scan([A(), B()]);
  const r = await st.scan([A({ complianceState: "compliant" }), B()]);
  assertEquals(r[0].evidencia.prova_ids, ["device:B"]);
});
Deno.test("legacy row without ids is never promoted to provable by a later finding", async () => {
  const st = scanStore();
  st.rows.set("dispositivos_nao_conformes|", { regra_id: "dispositivos_nao_conformes", chave: "", estado: "aberta", evidencia: { total: 1, itens: ["PC-A"] } });
  let r = await st.scan([B()]);
  assertEquals(r[0].evidencia.sem_prova, true);
  r = await st.scan([B({ complianceState: "compliant" })]);
  assertEquals(r[0].estado, "aberta");
});
Deno.test("grouped incidents: member vanishing from the filter stays pending until GET proves resolved", async () => {
  const open = [{ regra_id: "alerta_malware", chave: "ms_incidents:malware", estado: "aberta", ids: ["29", "30"], prova_ids: ["29", "30"] }];
  const { sec } = await run(ALL_OK({ "/security/incidents": (u: string) => u.includes("/incidents/30") ? new ProviderError("not_found") : { value: [INCIDENT()] } }));
  const d = await decideLifecycle(open, evaluateSecurity(sec).findings, (r, id) => sec.proveFixed!(r, id));
  assertEquals(d.findings.find((f) => f.regra_id === "alerta_malware")!.evidencia.prova_ids, ["29", "30"]);
});


// ---- Google Cloud Identity encryptionState (same authorised devices.readonly read).
const gCloud = (o: Record<string, unknown>) => googleDeviceResource("cloud", { name: "devices/c1", model: "Pixel", deviceType: "ANDROID", lastSyncTime: "2026-11-24T00:00:00Z", ...o })!;
Deno.test("google cloud encryptionState maps only explicit values", () => {
  assertEquals(gCloud({ encryptionState: "ENCRYPTED" }).signals.encrypted, true);
  assertEquals(gCloud({ encryptionState: "NOT_ENCRYPTED" }).signals.encrypted, false);
  for (const v of [undefined, "ENCRYPTION_STATE_UNSPECIFIED", "UNSUPPORTED_BY_DEVICE"]) assertEquals(gCloud({ encryptionState: v }).signals.encrypted, null);
});
Deno.test("google encryption feeds the existing rule; unknown never fires", () => {
  assertEquals(ids([gCloud({ encryptionState: "NOT_ENCRYPTED" })]), ["dispositivos_sem_criptografia"]);
  assertEquals(ids([gCloud({ encryptionState: "UNSUPPORTED_BY_DEVICE" })]), []);
  assertEquals(gCloud({ encryptionState: "ENCRYPTED" }).signals.compliance, "unknown", "no Intune-style compliance invented");
});
Deno.test("google encryption coverage: all known ok, some known partial, none not evaluated (not permission)", () => {
  const cov = (r: unknown[]) => riskCoverage("google_workspace", r as never, true, null).dispositivos_sem_criptografia;
  assertEquals(cov([gCloud({ encryptionState: "ENCRYPTED" })]), { status: "ok" });
  assertEquals(cov([gCloud({ encryptionState: "ENCRYPTED" }), gCloud({ name: "devices/c2" })]), { status: "partial", motivo: "campos_parciais" });
  assertEquals(cov([gCloud({})]), { status: "not_evaluated", motivo: "campos_nao_coletados" });
  assertEquals("google_criptografia" in riskCoverage("google_workspace", [], true, null), false);
});
Deno.test("google encryption resolution needs explicit ENCRYPTED on the same device", () => {
  const id = gCloud({}).externalId;
  assertEquals(configFixed([gCloud({ encryptionState: "ENCRYPTED" })] as never, "dispositivos_sem_criptografia", id), true);
  for (const v of [undefined, "ENCRYPTION_STATE_UNSPECIFIED", "UNSUPPORTED_BY_DEVICE", "NOT_ENCRYPTED"])
    assertEquals(configFixed([gCloud({ encryptionState: v })] as never, "dispositivos_sem_criptografia", id), false);
  assertEquals(configFixed([gCloud({ name: "devices/other", encryptionState: "ENCRYPTED" })] as never, "dispositivos_sem_criptografia", id), false);
});
Deno.test("google cloud name prefers hostname, then model/serial; id unchanged", () => {
  const d = googleDeviceResource("cloud", { name: "devices/c9", hostname: "LAPTOP-FIN-07", model: "Windows", serialNumber: "5CD123XYZ" })!;
  assertEquals([d.name, d.externalId], ["LAPTOP-FIN-07", "device:google:cloud:devices/c9"]);
  assertEquals(googleDeviceResource("cloud", { name: "devices/c9", model: "Windows" })!.name, "Windows");
  const f = evaluateRiskRules([googleDeviceResource("cloud", { name: "devices/c9", hostname: "LAPTOP-FIN-07", serialNumber: "5CD123XYZ", encryptionState: "NOT_ENCRYPTED" })] as never, NOW)[0];
  assertEquals(f.evidencia.refs, [{ id: "device:google:cloud:devices/c9", nome: "LAPTOP-FIN-07 · SN 5CD123XYZ", url: null }]);
});
