import { ALERT_CATEGORIES, type SecurityCollection, type SecuritySignal } from "./integration-security.ts";
// Pure risk rules over collected resources and security sources. Missing data never fires a rule and
// never marks an earlier finding as fixed: coverage is granted per rule, only when the field the rule
// needs was actually collected.
type Res = { kind: string; name?: string; signals: Record<string, unknown> };
export type RiskFinding = {
  regra_id: string; chave: string; fonte: string; severidade: string | null; relevancia: number;
  probabilidade: number; impacto: number; alcance: Record<string, unknown>;
  evidencia: { total: number; itens: string[] };
};

export const MAX_ADMINS = 4;
export const STALE_DEVICE_DAYS = 30;
const SAMPLE = 20;
const WINDOW_DAYS = 30;

const uniq = (v: string[]) => [...new Set(v)];
const pack = (regra_id: string, p: number, i: number, itens: (string | Res)[], opts: Partial<RiskFinding> = {}): RiskFinding | null => {
  const list = itens.map((x) => typeof x === "string" ? x
    : String(x.signals.email ?? x.name ?? x.signals.serial_number ?? x.signals.target ?? x.signals.id ?? "").trim()).filter(Boolean);
  const total = opts.evidencia?.total ?? uniq(list).length;
  return total ? { regra_id, chave: opts.chave ?? "", fonte: opts.fonte ?? "coleta", severidade: opts.severidade ?? null,
    relevancia: opts.relevancia ?? 0, probabilidade: p, impacto: i, alcance: opts.alcance ?? {},
    evidencia: { total, itens: uniq(list).slice(0, SAMPLE) } } : null;
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
  const name = (d: Res) => String(d.name ?? d.signals.serial_number ?? "");
  const out: (RiskFinding | null)[] = [
    pack("admin_sem_mfa", 4, 5, admins.filter(mfaNotRegistered), { fonte: "coleta", severidade: "alta" }),
    admins.length > MAX_ADMINS ? pack("excesso_admins", 3, 4, admins, { fonte: "coleta", severidade: "media" }) : null,
    pack("dispositivos_nao_conformes", 3, 4, devices.filter((d) => NONCOMPLIANT.has(compliance(d))).map(name), { fonte: "coleta", severidade: "media" }),
    pack("dispositivos_sem_criptografia", 3, 5, devices.filter((d) => d.signals.encrypted === false).map(name), { fonte: "coleta", severidade: "alta" }),
    pack("dispositivos_sem_sincronizar", 2, 3, devices.filter((d) => { const s = daysSince(d.signals.provider_last_sync, now); return s !== null && s > STALE_DEVICE_DAYS; }).map(name), { fonte: "coleta", severidade: "baixa" }),
  ];
  return out.filter((x): x is RiskFinding => x !== null);
}

const ALERT_WEIGHT: Record<string, [number, number]> = {
  ransomware: [5, 5], conta_comprometida: [4, 5], malware: [4, 5], vazamento_dados: [4, 5], movimento_lateral: [4, 5],
  phishing: [4, 4], dispositivo: [3, 4], configuracao: [3, 4], outros: [3, 3],
};
const ALERT_RULES = ALERT_CATEGORIES.map((c) => `alerta_${c}`);
const SOURCE_RULES: Record<string, string[]> = {
  ms_incidents: ALERT_RULES, ms_risky_users: ["usuarios_alto_risco"],
  ms_secure_score: ["secure_score_recomendacoes"], ms_recommendations: ["recomendacoes_defender"],
};
const sourceOf = (s: SecuritySignal) => s.source;

/**
 * One finding per theme, never one per alert. Technical severity is kept apart from the suggested
 * probability/impact, which the user validates before accepting.
 */
export function evaluateSecurity(sec: SecurityCollection | null): { findings: RiskFinding[]; covered: string[] } {
  if (!sec) return { findings: [], covered: [] };
  const ok = Object.entries(sec.status).filter(([, v]) => v === "ok").map(([k]) => k);
  const findings: (RiskFinding | null)[] = [];
  for (const c of ALERT_CATEGORIES) {
    const hits = sec.signals.filter((s): s is Extract<SecuritySignal, { source: "ms_incidents" }> => s.source === "ms_incidents" && s.category === c);
    findings.push(pack(`alerta_${c}`, ALERT_WEIGHT[c][0], ALERT_WEIGHT[c][1],
      hits.flatMap((h) => h.alvos), {
        chave: hits.map((h) => h.incidente).join(","), fonte: "Microsoft Defender",
        severidade: "alta", relevancia: hits.length,
        alcance: { janela_dias: WINDOW_DAYS, incidentes: uniq(hits.map((h) => h.incidente)) },
      }));
  }
  const risky = sec.signals.filter((s) => s.source === "ms_risky_users");
  findings.push(pack("usuarios_alto_risco", 4, 5, risky.map((s) => s.target), {
    chave: risky.map((s) => s.target).join(","), fonte: "Microsoft Entra ID Protection", severidade: "alta",
    relevancia: risky.length, alcance: { janela_dias: WINDOW_DAYS },
  }));
  const score = sec.signals.filter((s): s is Extract<SecuritySignal, { source: "ms_secure_score" }> => s.source === "ms_secure_score");
  findings.push(pack("secure_score_recomendacoes", 3, 4, score.map((s) => s.target), {
    chave: score.map((s) => s.target).join(","), fonte: "Microsoft Secure Score", severidade: "alta",
    relevancia: Math.max(0, ...score.map((s) => s.gap)), alcance: { controles: score.length },
  }));
  const recs = sec.signals.filter((s): s is Extract<SecuritySignal, { source: "ms_recommendations" }> => s.source === "ms_recommendations");
  findings.push(pack("recomendacoes_defender", 4, 5, recs.map((r) => `${r.target} (${r.devices})`), {
    chave: recs.map((r) => r.target).join(","), fonte: "Microsoft Defender for Endpoint", severidade: "alta",
    relevancia: Math.max(0, ...recs.map((r) => r.devices)), alcance: { recomendacoes: recs.length },
  }));
  return { findings: findings.filter((f): f is RiskFinding => !!f), covered: [...new Set(ok.flatMap((k) => SOURCE_RULES[k] ?? []))] };
}

/** Providers whose collected data may be analysed for configuration risks. */
export const RISK_PROVIDERS = ["google_workspace", "microsoft", "microsoft365", "entra_id", "intune"];
