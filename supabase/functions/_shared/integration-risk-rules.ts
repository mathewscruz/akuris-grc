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

export const RISK_PROVIDERS = ["google_workspace", "microsoft", "microsoft365", "entra_id", "intune"];
