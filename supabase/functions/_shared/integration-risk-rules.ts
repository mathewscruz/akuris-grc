import { ALERT_CATEGORIES, type SecurityCollection } from "./integration-security.ts";
// Pure risk rules over collected resources. Missing data (null/undefined) never fires a rule.
type Res = { kind: string; name?: string; signals: Record<string, unknown> };
export type RiskFinding = { regra_id: string; probabilidade: number; impacto: number; evidencia: { total: number; itens: string[] } };

export const INACTIVE_DAYS = 90;
export const MAX_ADMINS = 4;
export const LOGIN_FAILURE_LIMIT = 10;
export const STALE_DEVICE_DAYS = 30;
const SAMPLE = 20;

const ids = (r: Res[]) => r.map((x) => String(x.signals.email ?? x.name ?? "")).filter(Boolean);
const finding = (regra_id: string, p: number, i: number, hits: Res[]): RiskFinding | null =>
  hits.length ? { regra_id, probabilidade: p, impacto: i, evidencia: { total: hits.length, itens: ids(hits).slice(0, SAMPLE) } } : null;

export function evaluateRiskRules(resources: Res[], now = new Date()): RiskFinding[] {
  const users = resources.filter((r) => r.kind === "identity" && r.signals.type !== "group"
    && r.signals.enabled !== false && r.signals.suspended !== true && r.signals.archived !== true);
  const admins = users.filter((u) => u.signals.privileged === true || u.signals.super_admin === true);
  const noMfa = (u: Res) => u.signals.mfa_registered === false && u.signals.mfa_enforced !== true;
  const devices = resources.filter((r) => r.kind === "device");
  const days = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v)) ? (now.getTime() - Date.parse(v)) / 86400000 : null;

  const out = [
    finding("admin_sem_mfa", 4, 5, admins.filter(noMfa)),
    finding("usuarios_sem_mfa", 4, 4, users.filter((u) => !admins.includes(u) && noMfa(u))),
    admins.length > MAX_ADMINS ? finding("excesso_admins", 3, 4, admins) : null,
    finding("contas_inativas", 3, 3, users.filter((u) => { const d = days(u.signals.last_login_at); return d !== null && d > INACTIVE_DAYS; })),
    finding("falhas_login", 3, 4, users.filter((u) => typeof u.signals.login_failures_window === "number" && (u.signals.login_failures_window as number) >= LOGIN_FAILURE_LIMIT)),
    finding("dispositivos_nao_conformes", 3, 4, devices.filter((d) => d.signals.compliant === false || d.signals.compliance === "non_compliant")),
    finding("dispositivos_sem_criptografia", 3, 5, devices.filter((d) => d.signals.encrypted === false)),
    finding("dispositivos_sem_sincronizar", 2, 3, devices.filter((d) => typeof d.signals.lastCheckinDays === "number" && (d.signals.lastCheckinDays as number) > STALE_DEVICE_DAYS)),
  ];
  return out.filter((x): x is RiskFinding => x !== null);
}

const USER_RULES = ["admin_sem_mfa", "usuarios_sem_mfa", "excesso_admins", "contas_inativas", "falhas_login"];
const DEVICE_RULES = ["dispositivos_nao_conformes", "dispositivos_sem_criptografia", "dispositivos_sem_sincronizar"];
/** Rules whose data was collected this run; only these may be marked as fixed when absent. */
export function coveredRules(resources: Res[]): string[] {
  return [
    ...(resources.some((r) => r.kind === "identity") ? USER_RULES : []),
    ...(resources.some((r) => r.kind === "device") ? DEVICE_RULES : []),
  ];
}

export const MAX_FINDINGS = 10;
const ALERT_WEIGHT: Record<string, [number, number]> = {
  ransomware: [5, 5], conta_comprometida: [4, 5], malware: [4, 5], vazamento_dados: [4, 5], movimento_lateral: [4, 5],
  phishing: [4, 4], dispositivo: [3, 4], configuracao: [3, 4], outros: [3, 3],
};
const ALERT_RULES = ALERT_CATEGORIES.map((c) => `alerta_${c}`);
const SOURCE_RULES: Record<string, string[]> = {
  ms_alerts: ALERT_RULES, google_alerts: ALERT_RULES,
  ms_risky_users: ["usuarios_alto_risco"], ms_secure_score: ["secure_score_recomendacoes"], ms_vulns: ["vulnerabilidades_criticas"],
};
const pack = (regra_id: string, p: number, i: number, itens: string[], total = itens.length): RiskFinding | null =>
  total ? { regra_id, probabilidade: p, impacto: i, evidencia: { total, itens: [...new Set(itens)].slice(0, SAMPLE) } } : null;

/** Grouped, high-severity-only findings from security sources (one finding per theme, never per alert). */
export function evaluateSecurity(sec: SecurityCollection | null): { findings: RiskFinding[]; covered: string[] } {
  if (!sec) return { findings: [], covered: [] };
  const ok = Object.entries(sec.status).filter(([, v]) => v === "ok").map(([k]) => k);
  const findings: (RiskFinding | null)[] = [];
  for (const c of ALERT_CATEGORIES) {
    const hits = sec.signals.filter((s) => (s.source === "ms_alerts" || s.source === "google_alerts") && s.category === c);
    findings.push(pack(`alerta_${c}`, ...ALERT_WEIGHT[c], hits.map((h) => h.target), new Set(hits.map((h) => h.target)).size));
  }
  findings.push(pack("usuarios_alto_risco", 4, 5, sec.signals.filter((s) => s.source === "ms_risky_users").map((s) => s.target)));
  const score = sec.signals.filter((s) => s.source === "ms_secure_score");
  findings.push(pack("secure_score_recomendacoes", 3, 4, score.map((s) => s.target)));
  const vulns = sec.signals.filter((s) => s.source === "ms_vulns") as { target: string; machines: number }[];
  findings.push(pack("vulnerabilidades_criticas", 4, 5, vulns.map((v) => `${v.target} (${v.machines})`)));
  return { findings: findings.filter((f): f is RiskFinding => !!f), covered: [...new Set(ok.flatMap((k) => SOURCE_RULES[k] ?? []))] };
}

/** Keeps only the most relevant findings; rules cut by the cap are removed from coverage so they are never marked fixed. */
export function capFindings(findings: RiskFinding[], covered: string[], max = MAX_FINDINGS) {
  const sorted = [...findings].sort((a, b) => b.probabilidade * b.impacto - a.probabilidade * a.impacto || b.evidencia.total - a.evidencia.total);
  const kept = sorted.slice(0, max), cut = new Set(sorted.slice(max).map((f) => f.regra_id));
  return { findings: kept, covered: covered.filter((r) => !cut.has(r)) };
}

export const RISK_PROVIDERS = ["google_workspace", "microsoft", "microsoft365", "entra_id", "intune"];
