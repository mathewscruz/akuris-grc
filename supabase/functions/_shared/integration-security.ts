// Microsoft security posture sources: Defender XDR incidents, Entra ID Protection, Secure Score and
// Defender for Endpoint recommendations. Read-only; each source reports its own status, and a source
// that is unlicensed, forbidden, partial or timed out produces no finding and no coverage.
import { ProviderError } from "./integration-providers.ts";

export type SecuritySource = "ms_incidents" | "ms_risky_users" | "ms_secure_score" | "ms_recommendations";
export type AlertCategory = "ransomware" | "malware" | "phishing" | "conta_comprometida" | "movimento_lateral"
  | "vazamento_dados" | "configuracao" | "dispositivo" | "outros";
export const ALERT_CATEGORIES: AlertCategory[] = ["ransomware", "malware", "phishing", "conta_comprometida",
  "movimento_lateral", "vazamento_dados", "configuracao", "dispositivo", "outros"];
export type SecuritySignal =
  | { source: "ms_incidents"; incidente: string; category: AlertCategory; alvos: string[] }
  | { source: "ms_risky_users"; target: string }
  | { source: "ms_secure_score"; target: string; gap: number }
  | { source: "ms_recommendations"; target: string; devices: number };
export type SourceStatus = "ok" | "partial" | "permission_missing" | "unavailable";
export type SecurityCollection = { signals: SecuritySignal[]; status: Partial<Record<SecuritySource, SourceStatus>> };

export const WINDOW_DAYS = 30;
const GRAPH = "https://graph.microsoft.com";
const MDE = "https://api.securitycenter.microsoft.com";
type Read = (url: string, token: string, origin: string) => Promise<any>;

export function incidentCategory(text: string): AlertCategory {
  const c = text.toLowerCase();
  if (c.includes("ransom")) return "ransomware";
  if (c.includes("phish")) return "phishing";
  if (/exfil|data loss|dlp|collection/.test(c)) return "vazamento_dados";
  if (c.includes("lateral")) return "movimento_lateral";
  if (/malware|trojan|virus|execution/.test(c)) return "malware";
  if (/credential|password|sign-in|login|account|privilege|initialaccess/.test(c)) return "conta_comprometida";
  if (/device|endpoint/.test(c)) return "dispositivo";
  if (/policy|configuration|setting/.test(c)) return "configuracao";
  return "outros";
}
const statusOf = (e: unknown): SourceStatus =>
  e instanceof ProviderError && (e.code === "permission_missing" || e.code === "authorization_expired") ? "permission_missing" : "unavailable";

async function pages(read: Read, url: string, token: string, origin: string, max = 10) {
  const items: any[] = [];
  let next: string | undefined = url;
  let page = 0;
  for (; next && page < max; page++) {
    const d = await read(next, token, origin);
    items.push(...(d.value || []));
    next = d["@odata.nextLink"];
  }
  // A page limit reached means the source was not read completely: never "ok".
  return { items, complete: !next };
}
const since = (now: Date) => new Date(now.getTime() - WINDOW_DAYS * 86400000).toISOString().replace(".000Z", "Z");

async function source(out: SecurityCollection, id: SecuritySource, fn: () => Promise<{ items: SecuritySignal[]; complete: boolean }>) {
  try {
    const r = await fn();
    out.signals.push(...r.items);
    out.status[id] = r.complete ? "ok" : "partial";
  } catch (e) { out.status[id] = statusOf(e); }
}

export async function collectMicrosoftSecurity(read: Read, graphToken: string, mdeToken: () => Promise<string>, now = new Date()) {
  const out: SecurityCollection = { signals: [], status: {} };
  await source(out, "ms_incidents", async () => {
    // High severity, still active, classification not yet determined counts too; false positives and
    // benign positives are excluded from triage.
    const f = encodeURIComponent(`severity eq 'high' and status eq 'active' and classification ne 'falsePositive' and classification ne 'benignPositive' and createdDateTime ge ${since(now)}`);
    const { items, complete } = await pages(read, `${GRAPH}/v1.0/security/incidents?$top=50&$filter=${f}`, graphToken, GRAPH);
    const signals = items.filter((i) => i.severity === "high" && i.status === "active"
      && i.classification !== "falsePositive" && i.classification !== "benignPositive")
      .map((i) => ({
        source: "ms_incidents" as const, incidente: String(i.id),
        category: incidentCategory(`${(i.alerts ?? []).map((a: any) => `${a.category ?? ""} ${a.title ?? ""}`).join(" ")} ${i.title ?? ""}`),
        alvos: (i.alerts ?? []).flatMap((a: any) => (a.alertEvidence ?? []).map((e: any) => e.entityPath ?? e.user?.name ?? "")).filter(Boolean),
      }));
    return { items: signals, complete };
  });
  await source(out, "ms_risky_users", async () => {
    const f = encodeURIComponent("riskLevel eq 'high' and riskState eq 'atRisk'");
    const { items, complete } = await pages(read, `${GRAPH}/v1.0/identityProtection/riskyUsers?$top=200&$filter=${f}`, graphToken, GRAPH);
    return { items: items.filter((u) => u.riskLevel === "high" && u.riskState === "atRisk")
      .map((u) => ({ source: "ms_risky_users" as const, target: u.userPrincipalName ?? u.id })), complete };
  });
  await source(out, "ms_secure_score", async () => {
    const score = (await read(`${GRAPH}/v1.0/security/secureScores?$top=1`, graphToken, GRAPH)).value?.[0];
    if (!score) return { items: [], complete: true };
    const { items: profiles, complete } = await pages(read, `${GRAPH}/v1.0/security/secureScoreControlProfiles?$top=200`, graphToken, GRAPH);
    const current = new Map<string, number>((score.controlScores || []).map((c: any) => [c.controlName, Number(c.score) || 0]));
    return { items: profiles.filter((p) => !p.deprecated && Number(p.maxScore) >= 5)
      .map((p) => ({ source: "ms_secure_score" as const, target: p.title ?? p.id, gap: Number(p.maxScore) - (current.get(p.id) ?? 0) }))
      .filter((p) => p.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 5), complete };
  });
  await source(out, "ms_recommendations", async () => {
    const token = await mdeToken();
    const { items, complete } = await pages(read, `${MDE}/api/recommendations?$filter=status eq 'Active'&$top=500`, token, MDE, 4);
    const relevant = items.filter((r) => r.publicExploit === true || Number(r.exposedCriticalDevices) > 0 || r.severity === "High")
      .sort((a, b) => (b.exposedCriticalDevices ?? 0) - (a.exposedCriticalDevices ?? 0));
    return { items: relevant.map((r) => ({ source: "ms_recommendations" as const, target: r.recommendationName ?? r.id, devices: Number(r.exposedDevices ?? r.exposedCriticalDevices ?? 0) })), complete };
  });
  return out;
}
