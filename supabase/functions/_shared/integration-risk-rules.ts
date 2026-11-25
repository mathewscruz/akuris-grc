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

export const INACTIVE_DAYS = 90;
export const MAX_ADMINS = 4;
export const STALE_DEVICE_DAYS = 30;
const SAMPLE = 20;
const WINDOW_DAYS = 30;

const ids = (r: Res[]) => r.map((x) => String(x.signals.email ?? x.name ?? x.signals.serial_number ?? x.signals.target ?? x.signals.id ?? "").trim()).filter(Boolean);
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
const adminsOf = (u: Res[]) => u.filter((x) => x.signals.privileged === true || x.signals.super_admin === true);
/** True only when the provider states a second factor is registered; unknown (null) is never "no MFA". */
const noMfa = (u: Res) => u.signals.mfa_registered === false && u.signals.mfa_enforced !== true;
const daysSince = (v: unknown, now: Date) => typeof v === "string" && !Number.isNaN(Date.parse(v))
  ? (now.getTime() - Date.parse(v)) / 86400000 : null;

const CONFIG_RULES = [
  "admin_sem_mfa", "usuarios_sem_mfa", "excesso_admins", "contas_inativas",
  "dispositivos_nao_conformes", "dispositivos_sem_criptografia", "dispositivos_sem_sincronizar",
];

/** A configuration rule is covered only when the field it needs was really collected for this tenant. */
export function coveredConfigRules(resources: Res[]): string[] {
  const users = activeUsers(resources);
  const devices = resources.filter((r) => r.kind === "device");
  const has = (xs: Res[], k: string) => xs.some((x) => x.signals[k] !== undefined && x.signals[k] !== null);
  return [
    ...(has(users, "mfa_registered") ? ["admin_sem_mfa", "usuarios_sem_mfa"] : []),
    ...(has(users, "privileged") || has(users, "super_admin") ? ["excesso_admins"] : []),
    ...(has(users, "last_login_at") ? ["contas_inativas"] : []),
    ...(has(devices, "compliant") || has(devices, "compliance") ? ["dispositivos_nao_conformes"] : []),
    ...(has(devices, "encrypted") ? ["dispositivos_sem_criptografia"] : []),
    ...(has(devices, "lastCheckinDays") || has(devices, "provider_last_sync") ? ["dispositivos_sem_sincronizar"] : []),
  ].filter((r) => CONFIG_RULES.includes(r));
}

export function evaluateRiskRules(resources: Res[], now = new Date()): RiskFinding[] {
  const users = activeUsers(resources);
  const admins = adminsOf(users);
  const devices = resources.filter((r) => r.kind === "device");
  const stale = (d: Res) => d.signals.lastCheckinDays !== undefined && d.signals.lastCheckinDays !== null
    ? (d.signals.lastCheckinDays as number) : daysSince(d.signals.provider_last_sync, now);
  const out: (RiskFinding | null)[] = [
    pack("admin_sem_mfa", 4, 5, admins.filter(noMfa)),
    pack("usuarios_sem_mfa", 4, 4, users.filter((u) => !admins.includes(u) && noMfa(u))),
    admins.length > MAX_ADMINS ? pack("excesso_admins", 3, 4, admins) : null,
    pack("contas_inativas", 3, 3, users.filter((u) => { const d = daysSince(u.signals.last_login_at, now); return d !== null && d > INACTIVE_DAYS; })),
    pack("dispositivos_nao_conformes", 3, 4, devices.filter((d) => d.signals.compliant === false || d.signals.compliance === "non_compliant").map((d) => String(d.name ?? d.signals.serial_number ?? ""))),
    pack("dispositivos_sem_criptografia", 3, 5, devices.filter((d) => d.signals.encrypted === false).map((d) => String(d.name ?? d.signals.serial_number ?? ""))),
    pack("dispositivos_sem_sincronizar", 2, 3, devices.filter((d) => { const s = stale(d); return s !== null && s > STALE_DEVICE_DAYS; }).map((d) => String(d.name ?? ""))),
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
