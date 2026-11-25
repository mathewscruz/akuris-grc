import { ALERT_CATEGORIES, type IncidentSignal, type RecSignal, type ScoreSignal, type SecurityCollection, type SecuritySignal } from "./integration-security.ts";
// Pure risk rules over collected resources and security sources. Missing data never fires a rule and
// never marks an earlier finding as fixed: coverage is granted per rule, only when the field the rule
// needs was actually collected.
type Res = { kind: string; name?: string; externalId?: string; signals: Record<string, unknown> };
export type RiskFinding = {
  regra_id: string; chave: string; fonte: string; severidade: string | null; relevancia: number;
  probabilidade: number; impacto: number; alcance: Record<string, unknown>;
  evidencia: { total: number; itens: string[]; ids?: string[]; prova_ids?: string[]; sem_prova?: boolean; refs?: { id: string; nome: string; url: string | null }[]; alvos?: string[] };
};

export const MAX_ADMINS = 4;
export const STALE_DEVICE_DAYS = 30;
const SAMPLE = 20;

const uniq = (v: string[]) => [...new Set(v)];
const label = (x: Res) => String(x.signals.email ?? x.name ?? x.signals.serial_number ?? x.signals.target ?? x.signals.id ?? "").trim();
/** Evidence ids are the collector's stable externalId (never names/e-mails); an item without one makes the finding unprovable later. */
const pack = (regra_id: string, p: number, i: number, itens: Res[], opts: Partial<RiskFinding> = {}): RiskFinding | null => {
  if (!itens.length) return null;
  const ids = itens.every((x) => x.externalId) ? uniq(itens.map((x) => x.externalId!)).sort() : undefined;
  return { regra_id, chave: opts.chave ?? "", fonte: opts.fonte ?? "coleta", severidade: opts.severidade ?? null,
    relevancia: opts.relevancia ?? 0, probabilidade: p, impacto: i, alcance: opts.alcance ?? {},
    evidencia: { total: ids?.length ?? itens.length, itens: uniq(itens.map(label).filter(Boolean)).slice(0, SAMPLE), ...(ids ? { ids } : {}) } };
};

/** Users that are usable today: enabled, not suspended, not archived. */
const activeUsers = (r: Res[]) => r.filter((x) => x.kind === "identity" && x.signals.type !== "group"
  && x.signals.enabled !== false && x.signals.suspended !== true && x.signals.archived !== true);
/** Only global/super administrators; any other privileged role is not counted as "admin". */
const globalAdmins = (u: Res[]) => u.filter((x) => x.signals.super_admin === true);
/** MFA not registered (enrolment). Not enforced is a different fact and is never reported as this. */
const mfaNotRegistered = (u: Res) => u.signals.mfa_registered === false;
const daysSince = (v: unknown, now: Date) => typeof v === "string" && !Number.isNaN(Date.parse(v))
  ? (now.getTime() - Date.parse(v)) / 86400000 : null;
/** Intune complianceState as delivered by the collector ("noncompliant"); unknown/other states never fire. */
const NONCOMPLIANT = new Set(["noncompliant"]);
const KNOWN_COMPLIANCE = new Set(["compliant", "noncompliant", "ingraceperiod", "conflict", "error"]);
const compliance = (d: Res) => String(d.signals.compliance ?? "").toLowerCase();

/**
 * First automatic version: strong findings only. Generalist checks (all users without MFA, inactive
 * accounts, login failures) stay off until triage; technical priority never overrides the company matrix.
 */
export const ACTIVE_CONFIG_RULES = [
  "admin_sem_mfa", "excesso_admins", "dispositivos_nao_conformes", "dispositivos_sem_criptografia", "dispositivos_sem_sincronizar",
] as const;

const known = (v: unknown) => v !== undefined && v !== null;
/** True only when every item has the field: one unknown value means the rule was not fully evaluated. */
const complete = (xs: Res[], ok: (x: Res) => boolean) => xs.length > 0 && xs.every(ok);

/**
 * Coverage per rule: granted only when every relevant item carries a known value for the exact field
 * the rule reads. Unknown fields, absent modules or empty populations keep earlier suggestions open.
 */
export function coveredConfigRules(resources: Res[]): string[] {
  const users = activeUsers(resources);
  const admins = globalAdmins(users);
  const devices = resources.filter((r) => r.kind === "device");
  const out: string[] = [];
  if (complete(users, (u) => known(u.signals.super_admin)) && complete(admins, (u) => known(u.signals.mfa_registered))) out.push("admin_sem_mfa");
  if (complete(users, (u) => known(u.signals.super_admin))) out.push("excesso_admins");
  if (complete(devices, (d) => KNOWN_COMPLIANCE.has(compliance(d)))) out.push("dispositivos_nao_conformes");
  if (complete(devices, (d) => typeof d.signals.encrypted === "boolean")) out.push("dispositivos_sem_criptografia");
  if (complete(devices, (d) => daysSince(d.signals.provider_last_sync, new Date(0)) !== null)) out.push("dispositivos_sem_sincronizar");
  return out;
}

export function evaluateRiskRules(resources: Res[], now = new Date()): RiskFinding[] {
  const users = activeUsers(resources);
  const admins = globalAdmins(users);
  const devices = resources.filter((r) => r.kind === "device");
  const out: (RiskFinding | null)[] = [
    pack("admin_sem_mfa", 4, 5, admins.filter(mfaNotRegistered), { fonte: "coleta", severidade: "alta" }),
    admins.length > MAX_ADMINS ? pack("excesso_admins", 3, 4, admins, { fonte: "coleta", severidade: "media" }) : null,
    pack("dispositivos_nao_conformes", 3, 4, devices.filter((d) => NONCOMPLIANT.has(compliance(d))), { fonte: "coleta", severidade: "media" }),
    pack("dispositivos_sem_criptografia", 3, 5, devices.filter((d) => d.signals.encrypted === false), { fonte: "coleta", severidade: "alta" }),
    pack("dispositivos_sem_sincronizar", 2, 3, devices.filter((d) => { const s = daysSince(d.signals.provider_last_sync, now); return s !== null && s > STALE_DEVICE_DAYS; }), { fonte: "coleta", severidade: "baixa" }),
  ];
  return out.filter((x): x is RiskFinding => x !== null);
}

const ALERT_WEIGHT: Record<string, [number, number]> = {
  ransomware: [5, 5], conta_comprometida: [4, 5], malware: [4, 5], vazamento_dados: [4, 5], movimento_lateral: [4, 5],
  phishing: [4, 4], dispositivo: [3, 4], configuracao: [3, 4], outros: [3, 3],
};
const ALERT_RULES = ALERT_CATEGORIES.map((c) => `alerta_${c}`);
export const SOURCE_RULES: Record<string, string[]> = {
  ms_incidents: ALERT_RULES, ms_risky_users: ["usuarios_alto_risco"],
  ms_secure_score: ["secure_score_recomendacoes"], ms_recommendations: ["recomendacoes_defender"],
};
const TOP = 10;
type Ref = { id: string; nome: string; url?: string | null; detalhe?: string };
/** Stable key per source/theme; evidence ids kept separately and sorted, so order or membership changes never create a new suggestion. */
const agg = (regra_id: string, chave: string, fonte: string, p: number, i: number, refs: Ref[], extra: Partial<RiskFinding> & { alvos?: string[] } = {}): RiskFinding | null => {
  if (!refs.length) return null;
  const ids = [...new Set(refs.map((r) => r.id))].sort();
  return {
    regra_id, chave, fonte, severidade: extra.severidade ?? "alta", relevancia: Math.max(0, Math.round(extra.relevancia ?? refs.length)),
    probabilidade: p, impacto: i, alcance: extra.alcance ?? {},
    evidencia: { total: ids.length, itens: refs.slice(0, TOP).map((r) => r.detalhe ? `${r.nome} (${r.detalhe})` : r.nome),
      ids, refs: refs.slice(0, TOP).map(({ id, nome, url }) => ({ id, nome, url: url ?? null })),
      ...(extra.alvos?.length ? { alvos: extra.alvos.slice(0, 50) } : {}) } as RiskFinding["evidencia"],
  };
};

/**
 * One finding per theme (stable key), never one per alert. Technical severity stays apart from the suggested
 * probability/impact, which the company validates in its own matrix when accepting.
 */
export function evaluateSecurity(sec: SecurityCollection | null): { findings: RiskFinding[]; covered: string[] } {
  if (!sec) return { findings: [], covered: [] };
  const ok = Object.entries(sec.status).filter(([, v]) => v === "ok").map(([k]) => k);
  const findings: (RiskFinding | null)[] = [];
  const inc = sec.signals.filter((s): s is IncidentSignal => s.source === "ms_incidents");
  for (const c of ALERT_CATEGORIES) {
    const hits = inc.filter((h) => h.category === c).sort((a, b) => a.id.localeCompare(b.id));
    findings.push(agg(`alerta_${c}`, `ms_incidents:${c}`, "Microsoft Defender XDR", ALERT_WEIGHT[c][0], ALERT_WEIGHT[c][1],
      hits.map((h) => ({ id: h.id, nome: h.nome, url: h.url })),
      { alvos: [...new Set(hits.flatMap((h) => h.alvos))].sort(), alcance: { escopo: "incidentes alta severidade em aberto" } }));
  }
  const risky = sec.signals.filter((s): s is Extract<SecuritySignal, { source: "ms_risky_users" }> => s.source === "ms_risky_users")
    .sort((a, b) => a.nome.localeCompare(b.nome));
  findings.push(agg("usuarios_alto_risco", "ms_risky_users", "Microsoft Entra ID Protection", 4, 5,
    risky.map((r) => ({ id: r.id, nome: r.nome })), { alcance: { escopo: "risco alto, em risco" } }));
  const score = sec.signals.filter((s): s is ScoreSignal => s.source === "ms_secure_score");
  findings.push(agg("secure_score_recomendacoes", "ms_secure_score", "Microsoft Secure Score", 3, 4,
    score.map((s) => ({ id: s.id, nome: s.nome, url: s.url, detalhe: `${s.atual}/${s.max}` })),
    { severidade: "media", relevancia: Math.max(0, ...score.map((s) => s.gap)), alcance: { controles_com_lacuna: score.length } }));
  const recs = sec.signals.filter((s): s is RecSignal => s.source === "ms_recommendations");
  findings.push(agg("recomendacoes_defender", "ms_recommendations", "Microsoft Defender for Endpoint", 4, 5,
    recs.map((r) => ({ id: r.id, nome: r.nome, detalhe: [r.activeAlert ? "alerta ativo" : "", r.publicExploit ? "exploração pública" : "",
      r.criticos ? `${r.criticos} críticos` : "", `${r.expostos} expostos`].filter(Boolean).join(", ") })),
    { relevancia: Math.max(0, ...recs.map((r) => r.criticos)), alcance: { recomendacoes: recs.length } }));
  return { findings: findings.filter((f): f is RiskFinding => !!f), covered: [...new Set(ok.flatMap((k) => SOURCE_RULES[k] ?? []))] };
}

export type CoverageEntry = { status: "ok" | "partial" | "permission_missing" | "unavailable" | "not_evaluated"; motivo?: string };
/** Checks Akuris never collects for Google (no read-only scope authorised): always shown as not evaluated. */
export const GOOGLE_NOT_COLLECTED = ["google_alert_center", "google_drive_compartilhamento", "google_politicas"];

/** Per-rule coverage shown in the UI: what was evaluated, what was not and why. No result never means "no risk". */
export function riskCoverage(provider: string, resources: Res[], clean: boolean, sec: SecurityCollection | null): Record<string, CoverageEntry> {
  const out: Record<string, CoverageEntry> = {};
  const covered = new Set(coveredConfigRules(resources));
  const rules = provider === "google_workspace" ? ["admin_sem_mfa", "excesso_admins", "dispositivos_sem_sincronizar", "dispositivos_sem_criptografia"]
    : ["dispositivos_nao_conformes", "dispositivos_sem_criptografia", "dispositivos_sem_sincronizar", "admin_sem_mfa", "excesso_admins"];
  for (const r of rules) out[r] = !clean ? { status: "partial", motivo: "coleta_com_avisos" }
    : covered.has(r) ? { status: "ok" }
    // Encryption: some devices with an explicit value = partial (known fields only); none = data not provided, not a permission gap.
    : r === "dispositivos_sem_criptografia" && resources.some((x) => x.kind === "device" && typeof x.signals.encrypted === "boolean")
      ? { status: "partial", motivo: "campos_parciais" } : { status: "not_evaluated", motivo: "campos_nao_coletados" };
  if (provider === "google_workspace") for (const r of GOOGLE_NOT_COLLECTED) out[r] = { status: "not_evaluated", motivo: "nao_coletado" };
  if (provider === "microsoft") for (const [src, regras] of Object.entries(SOURCE_RULES)) {
    const d = sec?.detalhes?.[src as keyof NonNullable<SecurityCollection["detalhes"]>];
    const e: CoverageEntry = d ? { status: d.status, ...(d.motivo ? { motivo: d.motivo } : {}) } : { status: "not_evaluated", motivo: "fonte_nao_consultada" };
    for (const r of regras) out[r] = e;
  }
  return out;
}

/** Providers whose collected data may be analysed for configuration risks. */
export const RISK_PROVIDERS = ["google_workspace", "microsoft", "microsoft365", "entra_id", "intune"];

/**
 * Config remediation proof for one previously affected id: the same resource (by externalId) was collected
 * again in a warning-free run with a known value that now passes the rule. A vanished target is never "fixed".
 */
export function configFixed(resources: Res[], regra: string, id: string, now = new Date()): boolean {
  const r = resources.find((x) => x.externalId === id);
  if (!r) return false;
  const s = r.signals;
  switch (regra) {
    case "admin_sem_mfa": return s.super_admin === false || s.mfa_registered === true;
    case "excesso_admins": return coveredConfigRules(resources).includes("excesso_admins") && globalAdmins(activeUsers(resources)).length <= MAX_ADMINS;
    case "dispositivos_nao_conformes": return compliance(r) === "compliant";
    case "dispositivos_sem_criptografia": return s.encrypted === true;
    case "dispositivos_sem_sincronizar": { const d = daysSince(s.provider_last_sync, now); return d !== null && d <= STALE_DEVICE_DAYS; }
  }
  return false;
}

export type OpenSuggestion = { regra_id: string; chave?: string; estado?: string; ids: string[] | null; prova_ids?: string[] | null; sem_prova?: boolean };
type Prove = (regra: string, id: string) => Promise<boolean> | boolean;
/** Ids still awaiting remediation proof in a stored row's open cycle; null = no reliable ids (legacy). */
const pending = (o: OpenSuggestion) => o.sem_prova ? null
  : Array.isArray(o.prova_ids) && o.prova_ids.length ? o.prova_ids : o.ids?.length ? o.ids : null;

/**
 * Lifecycle authorisation (separate from read coverage). Per stored open/accepted/dismissed row:
 * - with a current finding (same rule+key): the proof set becomes current ids ∪ old pending ids not yet proven
 *   fixed, so a member that merely vanished is never forgotten; legacy rows without ids carry sem_prova forever
 *   in this cycle and can never be resolved automatically;
 * - without a current finding in the rule: the rule resolves only when every pending id of every row is proven.
 * Corrected rows are not passed in, so a reopened cycle starts from the current ids only.
 */
export async function decideLifecycle(open: OpenSuggestion[], findings: RiskFinding[], prove: Prove): Promise<{ findings: RiskFinding[]; resolved: string[] }> {
  const key = (r: string, c?: string) => `${r}|${c ?? ""}`;
  const stored = new Map(open.map((o) => [key(o.regra_id, o.chave), o]));
  const out: RiskFinding[] = [];
  for (const f of findings) {
    const prev = stored.get(key(f.regra_id, f.chave));
    const cur = f.evidencia.ids ?? [];
    const legacy = !!prev && pending(prev) === null;
    const carry: string[] = [];
    if (prev && !legacy) for (const id of pending(prev)!) if (!cur.includes(id) && !(await prove(f.regra_id, id))) carry.push(id);
    const prova = [...new Set([...cur, ...carry])].sort();
    out.push({ ...f, evidencia: { ...f.evidencia, prova_ids: prova, ...(legacy || !f.evidencia.ids ? { sem_prova: true } : {}) } });
  }
  const active = new Set(findings.map((f) => f.regra_id));
  const byRule = new Map<string, OpenSuggestion[]>();
  for (const o of open) if (o.estado !== "descartada") byRule.set(o.regra_id, [...(byRule.get(o.regra_id) ?? []), o]);
  const resolved: string[] = [];
  for (const [regra, rows] of byRule) {
    if (active.has(regra) || rows.some((r) => pending(r) === null)) continue;
    let ok = true;
    for (const id of new Set(rows.flatMap((r) => pending(r)!))) if (!(await prove(regra, id))) { ok = false; break; }
    if (ok) resolved.push(regra);
  }
  return { findings: out, resolved };
}
/** Rules allowed to resolve (see decideLifecycle). */
export const provenRules = async (open: OpenSuggestion[], findings: RiskFinding[], prove: Prove) =>
  (await decideLifecycle(open, findings, prove)).resolved;
