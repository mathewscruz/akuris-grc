// Microsoft security posture sources: Defender XDR incidents, Entra ID Protection, Secure Score and
// Defender for Endpoint recommendations. Read-only; each source reports its own status, and a source
// that is unlicensed, forbidden, partial or timed out produces no coverage (never "resolved").
import { ProviderError } from "./integration-providers.ts";

export type SecuritySource = "ms_incidents" | "ms_risky_users" | "ms_secure_score" | "ms_recommendations";
export type AlertCategory = "ransomware" | "malware" | "phishing" | "conta_comprometida" | "movimento_lateral"
  | "vazamento_dados" | "configuracao" | "dispositivo" | "outros";
export const ALERT_CATEGORIES: AlertCategory[] = ["ransomware", "malware", "phishing", "conta_comprometida",
  "movimento_lateral", "vazamento_dados", "configuracao", "dispositivo", "outros"];
export type IncidentSignal = { source: "ms_incidents"; id: string; nome: string; url: string | null; category: AlertCategory;
  classificacao: string; alvos: string[] };
export type ScoreSignal = { source: "ms_secure_score"; id: string; nome: string; url: string | null; gap: number; max: number; atual: number };
export type RecSignal = { source: "ms_recommendations"; id: string; nome: string; activeAlert: boolean; publicExploit: boolean;
  criticos: number; expostos: number };
export type SecuritySignal = IncidentSignal | ScoreSignal | RecSignal | { source: "ms_risky_users"; id: string; nome: string };
export type SourceStatus = "ok" | "partial" | "permission_missing" | "unavailable" | "not_evaluated";
export type SourceReport = { status: SourceStatus; motivo?: string; total?: number };
export type SecurityCollection = { signals: SecuritySignal[]; status: Partial<Record<SecuritySource, SourceStatus>>;
  detalhes?: Partial<Record<SecuritySource, SourceReport>>;
  /** Explicit Secure Score per control (finite score, known max), for remediation proof. */
  scores?: Record<string, { atual: number; max: number }>;
  /** Positive remediation proof for one previously affected id; any error, 404 or unknown returns false. */
  proveFixed?: (regra: string, id: string) => Promise<boolean> };

/** Minimum new application permissions per source (never granted automatically). */
export const SECURITY_PERMISSIONS: Record<SecuritySource, { api: string; permissao: string }> = {
  ms_incidents: { api: "Microsoft Graph", permissao: "SecurityIncident.Read.All" },
  ms_secure_score: { api: "Microsoft Graph", permissao: "SecurityEvents.Read.All" },
  ms_risky_users: { api: "Microsoft Graph", permissao: "IdentityRiskyUser.Read.All" },
  ms_recommendations: { api: "Microsoft Defender for Endpoint (WindowsDefenderATP)", permissao: "SecurityRecommendation.Read.All" },
};
export const MDE_BASE = "https://api.securitycenter.microsoft.com";
export const MDE_SCOPE = "https://api.securitycenter.microsoft.com/.default";
const GRAPH = "https://graph.microsoft.com";
// deno-lint-ignore no-explicit-any
type Read = (url: string, token: string, origin: string, headers?: Record<string, string>) => Promise<any>;

const DETERMINATION: Record<string, AlertCategory> = {
  malware: "malware", unwantedSoftware: "malware", phishing: "phishing", compromisedUser: "conta_comprometida",
  maliciousUserActivity: "conta_comprometida", multiStagedAttack: "malware", apt: "malware",
};
export function incidentCategory(text: string): AlertCategory {
  const c = text.toLowerCase();
  if (c.includes("ransom")) return "ransomware";
  if (c.includes("phish")) return "phishing";
  if (/exfil|data loss|dlp|collection/.test(c)) return "vazamento_dados";
  if (c.includes("lateral")) return "movimento_lateral";
  if (/malware|trojan|virus|worm|execution|command and control/.test(c)) return "malware";
  if (/credential|password|sign-in|login|account|privilege|initialaccess/.test(c)) return "conta_comprometida";
  if (/device|endpoint/.test(c)) return "dispositivo";
  if (/policy|configuration|setting/.test(c)) return "configuracao";
  return "outros";
}
/** Application roles granted in an app-only token (payload claim only; the token is never stored or logged). */
export function tokenRoles(token: string | null | undefined): string[] | null {
  try {
    const p = token?.split(".")[1];
    if (!p) return null;
    const roles = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "=")))?.roles;
    return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === "string") : null;
  } catch { return null; }
}
/**
 * 403 is never assumed to mean "missing permission": consent is missing only when the token proves the role is absent;
 * license only when the provider says so; otherwise an unexplained refusal. 401 is an expired authorisation.
 */
export const statusOf = (e: unknown, roles: string[] | null = null, permissao?: string): SourceReport => {
  if (e instanceof ProviderError && e.code === "authorization_expired") return { status: "unavailable", motivo: "authorization_expired" };
  if (e instanceof ProviderError && e.code === "permission_missing") {
    if (e.reason === "license_missing") return { status: "unavailable", motivo: "licenca_ausente" };
    if (roles && permissao && !roles.includes(permissao)) return { status: "permission_missing", motivo: "consentimento_ausente" };
    return { status: "unavailable", motivo: "acesso_recusado" };
  }
  const code = e instanceof ProviderError ? e.code : e instanceof Error && e.name === "TimeoutError" ? "timeout" : "erro";
  return { status: "unavailable", motivo: code };
};

/** Follows nextLink up to max pages; a remaining link means the read is explicitly partial. */
async function pages(read: Read, url: string, token: string, origin: string, max = 10, headers?: Record<string, string>) {
  // deno-lint-ignore no-explicit-any
  const items: any[] = [];
  let next: string | undefined = url;
  for (let page = 0; next && page < max; page++) {
    // deno-lint-ignore no-explicit-any
    const d: any = headers ? await read(next, token, origin, headers) : await read(next, token, origin);
    items.push(...(Array.isArray(d?.value) ? d.value : []));
    next = d?.["@odata.nextLink"];
  }
  return { items, complete: !next };
}

async function source(out: SecurityCollection, id: SecuritySource,
  fn: () => Promise<{ items: SecuritySignal[]; complete: boolean; motivo?: string }>, token: () => string | null = () => null) {
  out.detalhes ??= {};
  try {
    const r = await fn();
    out.signals.push(...r.items);
    out.status[id] = r.complete ? "ok" : "partial";
    out.detalhes[id] = { status: out.status[id]!, total: r.items.length, ...(r.motivo ? { motivo: r.motivo } : {}) };
  } catch (e) {
    const rep = statusOf(e, tokenRoles(token()), SECURITY_PERMISSIONS[id].permissao);
    out.status[id] = rep.status;
    out.detalhes[id] = rep;
  }
}

const BENIGN = new Set(["falsepositive", "informationalexpectedactivity", "benignpositive"]);
const OPEN = new Set(["active", "inprogress", "awaitingaction"]);
// deno-lint-ignore no-explicit-any
const evidenceTarget = (e: any): string | null => {
  const t = String(e?.["@odata.type"] ?? "");
  if (t.endsWith("deviceEvidence")) return e.deviceDnsName || e.hostName || null;
  if (t.endsWith("userEvidence")) {
    const u = e.userAccount ?? {};
    return u.userPrincipalName || u.displayName || (u.accountName ? (u.domainName ? `${u.domainName}\\${u.accountName}` : u.accountName) : null);
  }
  return null;
};

// deno-lint-ignore no-explicit-any
export function incidentSignal(i: any): IncidentSignal | null {
  if (String(i?.severity) !== "high" || !OPEN.has(String(i?.status ?? "").toLowerCase())) return null;
  if (BENIGN.has(String(i?.classification ?? "").toLowerCase())) return null;
  // deno-lint-ignore no-explicit-any
  const alerts: any[] = Array.isArray(i.alerts) ? i.alerts : [];
  const det = DETERMINATION[String(i.determination ?? "")];
  const text = `${i.displayName ?? ""} ${alerts.map((a) => `${a.category ?? ""} ${a.title ?? ""}`).join(" ")}`;
  const textual = incidentCategory(text);
  return {
    source: "ms_incidents", id: String(i.id), nome: String(i.displayName ?? `Incidente ${i.id}`),
    url: typeof i.incidentWebUrl === "string" ? i.incidentWebUrl : null,
    category: textual === "ransomware" || !det ? textual : det,
    classificacao: String(i.classification ?? "unknown"),
    alvos: [...new Set(alerts.flatMap((a) => (Array.isArray(a.evidence) ? a.evidence : []).map(evidenceTarget)).filter((x): x is string => !!x))].sort(),
  };
}

const IGNORED_STATES = new Set(["ignored", "thirdparty", "reviewed"]);
/** Secure Score gaps: only controls with an explicit finite score, applicable and not accepted/handled elsewhere. */
// deno-lint-ignore no-explicit-any
export function secureScoreSignals(score: any, profiles: any[]): { items: ScoreSignal[]; complete: boolean; motivo?: string; scores: Record<string, { atual: number; max: number }> } {
  const scores: Record<string, { atual: number; max: number }> = {};
  if (!score || !Array.isArray(score.controlScores)) return { items: [], complete: false, motivo: "sem_pontuacao", scores };
  const explicit = new Map<string, number | null>();
  for (const c of score.controlScores) {
    const v = typeof c?.score === "number" && Number.isFinite(c.score) ? c.score : null;
    if (c?.controlName) explicit.set(String(c.controlName), v);
  }
  let unknown = 0;
  const items: ScoreSignal[] = [];
  for (const p of profiles) {
    const max = typeof p?.maxScore === "number" ? p.maxScore : Number(p?.maxScore);
    if (p?.deprecated === true || !Number.isFinite(max) || max <= 0) continue;
    const updates = Array.isArray(p.controlStateUpdates) ? p.controlStateUpdates : [];
    const state = String(updates[updates.length - 1]?.state ?? "default").toLowerCase();
    if (IGNORED_STATES.has(state)) continue;
    // Absent from the tenant score is unknown (not "not applicable"): no gap is inferred and no fix is proven.
    const atual = explicit.get(String(p.id));
    if (atual === null || atual === undefined) { unknown++; continue; }
    scores[String(p.id)] = { atual, max };
    const gap = Math.round((max - atual) * 100) / 100;
    if (gap > 0 && max >= 5) items.push({ source: "ms_secure_score", id: String(p.id), nome: String(p.title ?? p.id),
      url: typeof p.actionUrl === "string" && p.actionUrl ? p.actionUrl : null, gap, max, atual });
  }
  items.sort((a, b) => b.gap - a.gap || a.id.localeCompare(b.id));
  return { items, scores, complete: unknown === 0, ...(unknown ? { motivo: `controles_sem_pontuacao:${unknown}` } : {}) };
}

/** Defender for Endpoint: active recommendations with an active alert, public exploit on exposed machines, or exposed critical devices. */
// deno-lint-ignore no-explicit-any
export function recommendationSignals(items: any[]): RecSignal[] {
  return items.filter((r) => String(r?.status) === "Active").map((r) => ({
    source: "ms_recommendations" as const, id: String(r.id), nome: String(r.recommendationName ?? r.id),
    activeAlert: r.activeAlert === true, publicExploit: r.publicExploit === true,
    criticos: Number.isFinite(Number(r.exposedCriticalDevices)) ? Number(r.exposedCriticalDevices) : 0,
    expostos: Number.isFinite(Number(r.exposedMachinesCount)) ? Number(r.exposedMachinesCount) : 0,
  })).filter((r) => r.expostos > 0 && (r.activeAlert || r.publicExploit || r.criticos > 0))
    .sort((a, b) => Number(b.activeAlert) - Number(a.activeAlert) || b.criticos - a.criticos
      || Number(b.publicExploit) - Number(a.publicExploit) || b.expostos - a.expostos || a.id.localeCompare(b.id));
}

export async function collectMicrosoftSecurity(read: Read, graphToken: string, mdeToken: () => Promise<string>) {
  const out: SecurityCollection = { signals: [], status: {}, detalhes: {} };
  await source(out, "ms_incidents", async () => {
    // No date window: an incident still open stays relevant however old it is.
    const f = encodeURIComponent("severity eq 'high' and (status eq 'active' or status eq 'inProgress' or status eq 'awaitingAction')");
    // awaitingAction is an evolvable enum member: Graph only returns it with this Prefer header.
    const { items, complete } = await pages(read, `${GRAPH}/v1.0/security/incidents?$expand=alerts&$top=50&$filter=${f}`, graphToken, GRAPH, 10, PREFER);
    return { items: items.map(incidentSignal).filter((x): x is IncidentSignal => !!x), complete };
  }, () => graphToken);
  await source(out, "ms_risky_users", async () => {
    const f = encodeURIComponent("riskLevel eq 'high' and riskState eq 'atRisk'");
    const { items, complete } = await pages(read, `${GRAPH}/v1.0/identityProtection/riskyUsers?$top=200&$filter=${f}`, graphToken, GRAPH);
    return { items: items.filter((u) => u.riskLevel === "high" && u.riskState === "atRisk")
      .map((u) => ({ source: "ms_risky_users" as const, id: String(u.id), nome: String(u.userPrincipalName ?? u.userDisplayName ?? u.id) })), complete };
  }, () => graphToken);
  await source(out, "ms_secure_score", async () => {
    const score = (await read(`${GRAPH}/v1.0/security/secureScores?$top=1`, graphToken, GRAPH))?.value?.[0];
    const { items: profiles, complete } = await pages(read, `${GRAPH}/v1.0/security/secureScoreControlProfiles?$top=200`, graphToken, GRAPH);
    const r = secureScoreSignals(score, profiles);
    if (complete) out.scores = r.scores;
    return { items: r.items, complete: complete && r.complete, motivo: !complete ? "paginacao_parcial" : r.motivo };
  }, () => graphToken);
  let mde: string | null = null;
  await source(out, "ms_recommendations", async () => {
    const token = mde = await mdeToken();
    const { items, complete } = await pages(read, `${MDE_BASE}/api/recommendations?$filter=${encodeURIComponent("status eq 'Active'")}&$top=10000`, token, MDE_BASE, 5);
    // A full page with no continuation link cannot prove the list ended.
    const ambiguous = complete && items.length > 0 && items.length % 10000 === 0;
    return { items: recommendationSignals(items), complete: complete && !ambiguous, motivo: complete && !ambiguous ? undefined : "paginacao_parcial" };
  }, () => mde);
  out.proveFixed = (regra, id) => proveFixed(read, graphToken, mdeToken, out, regra, id);
  return out;
}

const PREFER = { Prefer: "include-unknown-enum-members" };
const safeId = (id: string) => /^[A-Za-z0-9._:-]{1,200}$/.test(id);
/**
 * Remediation proof per previously affected id, looked up by id (never inferred from absence in a filtered list):
 * incident status resolved; risky user riskState remediated; Secure Score control at its maximum with an explicit
 * score; Defender recommendation with exposedMachinesCount explicitly 0. Anything else is "not proven".
 */
export async function proveFixed(read: Read, graphToken: string, mdeToken: () => Promise<string>, sec: SecurityCollection, regra: string, id: string): Promise<boolean> {
  if (!safeId(id)) return false;
  try {
    if (regra.startsWith("alerta_")) {
      if (sec.status.ms_incidents !== "ok") return false;
      const i = await read(`${GRAPH}/v1.0/security/incidents/${encodeURIComponent(id)}`, graphToken, GRAPH, PREFER);
      return String(i?.id) === id && String(i?.status) === "resolved";
    }
    if (regra === "usuarios_alto_risco") {
      if (sec.status.ms_risky_users !== "ok") return false;
      const u = await read(`${GRAPH}/v1.0/identityProtection/riskyUsers/${encodeURIComponent(id)}`, graphToken, GRAPH);
      return String(u?.id) === id && String(u?.riskState) === "remediated";
    }
    if (regra === "secure_score_recomendacoes") {
      const s = sec.scores?.[id];
      return sec.status.ms_secure_score === "ok" && !!s && s.atual >= s.max;
    }
    if (regra === "recomendacoes_defender") {
      if (sec.status.ms_recommendations !== "ok") return false;
      const r = await read(`${MDE_BASE}/api/recommendations/${encodeURIComponent(id)}`, await mdeToken(), MDE_BASE);
      return String(r?.id) === id && typeof r?.exposedMachinesCount === "number" && r.exposedMachinesCount === 0;
    }
  } catch { return false; }
  return false;
}
