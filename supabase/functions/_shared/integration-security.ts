// Security posture signals (Microsoft Defender / Entra ID Protection / Secure Score, Google Alert Center).
// Read-only. Each source reports its own status; a failing or unlicensed source never produces findings
// and never marks earlier findings as fixed.
import { ProviderError } from "./integration-providers.ts";

export type SecuritySource = "ms_alerts" | "ms_risky_users" | "ms_secure_score" | "ms_vulns" | "google_alerts";
export type SecuritySignal =
  | { source: "ms_alerts" | "google_alerts"; category: AlertCategory; severity: "high"; target: string }
  | { source: "ms_risky_users"; target: string }
  | { source: "ms_secure_score"; target: string; gap: number }
  | { source: "ms_vulns"; target: string; machines: number };
export type SourceStatus = "ok" | "permission_missing" | "unavailable";
export type SecurityCollection = { signals: SecuritySignal[]; status: Partial<Record<SecuritySource, SourceStatus>> };

export const ALERT_CATEGORIES = ["ransomware", "malware", "phishing", "conta_comprometida", "movimento_lateral",
  "vazamento_dados", "configuracao", "dispositivo", "outros"] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];
export const WINDOW_DAYS = 30;

type Read = (url: string, token: string, origin: string) => Promise<any>;
const GRAPH = "https://graph.microsoft.com";
const MDE = "https://api.securitycenter.microsoft.com";
const ALERTS = "https://alertcenter.googleapis.com";

export function msAlertCategory(category: string, title: string): AlertCategory {
  const c = `${category} ${title}`.toLowerCase();
  if (c.includes("ransom")) return "ransomware";
  if (c.includes("phish")) return "phishing";
  if (/exfil|collection|data loss|dlp/.test(c)) return "vazamento_dados";
  if (c.includes("lateral")) return "movimento_lateral";
  if (/credential|initialaccess|privilege|account|sign-in|password/.test(c)) return "conta_comprometida";
  if (/malware|execution|trojan|virus/.test(c)) return "malware";
  return "outros";
}
export function googleAlertCategory(type: string): AlertCategory {
  const c = type.toLowerCase();
  if (c.includes("phish")) return "phishing";
  if (c.includes("malware")) return "malware";
  if (/login|password|government|state-sponsored|hijack|account|suspended|user granted/.test(c)) return "conta_comprometida";
  if (/dlp|data loss|exfil|drive|leak/.test(c)) return "vazamento_dados";
  if (/device/.test(c)) return "dispositivo";
  if (/setting|configuration|admin|domain/.test(c)) return "configuracao";
  return "outros";
}

const since = (now: Date) => new Date(now.getTime() - WINDOW_DAYS * 86400000).toISOString();
const statusOf = (e: unknown): SourceStatus =>
  e instanceof ProviderError && (e.code === "permission_missing" || e.code === "authorization_expired") ? "permission_missing" : "unavailable";

async function pages(read: Read, url: string, token: string, origin: string, max = 10) {
  const items: any[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < max; i++) {
    const d = await read(next, token, origin);
    items.push(...(d.value || d.alerts || []));
    next = d["@odata.nextLink"] ?? (d.nextPageToken ? withToken(url, d.nextPageToken) : undefined);
  }
  return items;
}
const withToken = (url: string, t: string) => { const u = new URL(url); u.searchParams.set("pageToken", t); return u.href; };

async function source<T>(out: SecurityCollection, id: SecuritySource, fn: () => Promise<SecuritySignal[]>) {
  try { out.signals.push(...await fn()); out.status[id] = "ok"; }
  catch (e) { out.status[id] = statusOf(e); }
}

export async function collectMicrosoftSecurity(read: Read, graphToken: string, mdeToken: () => Promise<string>, now = new Date()) {
  const out: SecurityCollection = { signals: [], status: {} };
  await source(out, "ms_alerts", async () => {
    const f = encodeURIComponent(`severity eq 'high' and status ne 'resolved' and createdDateTime ge ${since(now)}`);
    const alerts = await pages(read, `${GRAPH}/v1.0/security/alerts_v2?$top=200&$filter=${f}`, graphToken, GRAPH);
    return alerts.filter((a) => a.severity === "high" && a.status !== "resolved").map((a) => {
      const ev = (a.evidence || []).find((x: any) => x.deviceDnsName || x.userAccount?.userPrincipalName);
      return { source: "ms_alerts" as const, severity: "high" as const, category: msAlertCategory(a.category ?? "", a.title ?? ""),
        target: ev?.deviceDnsName ?? ev?.userAccount?.userPrincipalName ?? a.title ?? a.id };
    });
  });
  await source(out, "ms_risky_users", async () => {
    const f = encodeURIComponent("riskLevel eq 'high' and riskState eq 'atRisk'");
    const users = await pages(read, `${GRAPH}/v1.0/identityProtection/riskyUsers?$top=200&$filter=${f}`, graphToken, GRAPH);
    return users.filter((u) => u.riskLevel === "high" && u.riskState === "atRisk")
      .map((u) => ({ source: "ms_risky_users" as const, target: u.userPrincipalName ?? u.id }));
  });
  await source(out, "ms_secure_score", async () => {
    const score = (await read(`${GRAPH}/v1.0/security/secureScores?$top=1`, graphToken, GRAPH)).value?.[0];
    if (!score) return [];
    const profiles = await pages(read, `${GRAPH}/v1.0/security/secureScoreControlProfiles?$top=200`, graphToken, GRAPH);
    const current = new Map<string, number>((score.controlScores || []).map((c: any) => [c.controlName, Number(c.score) || 0]));
    return profiles.filter((p) => !p.deprecated && Number(p.maxScore) > 0)
      .map((p) => ({ source: "ms_secure_score" as const, target: p.title ?? p.id, gap: Number(p.maxScore) - (current.get(p.id) ?? 0) }))
      .filter((p) => p.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 5);
  });
  await source(out, "ms_vulns", async () => {
    const token = await mdeToken();
    const f = encodeURIComponent("severity eq 'Critical'");
    const vulns = await pages(read, `${MDE}/api/vulnerabilities?$top=500&$filter=${f}`, token, MDE, 4);
    return vulns.filter((v) => v.severity === "Critical" && v.publicExploit === true && Number(v.exposedMachines) > 0)
      .sort((a, b) => b.exposedMachines - a.exposedMachines)
      .map((v) => ({ source: "ms_vulns" as const, target: v.id, machines: Number(v.exposedMachines) }));
  });
  return out;
}

export async function collectGoogleSecurity(read: Read, token: string, now = new Date()) {
  const out: SecurityCollection = { signals: [], status: {} };
  await source(out, "google_alerts", async () => {
    const f = encodeURIComponent(`createTime >= "${since(now)}"`);
    const alerts = await pages(read, `${ALERTS}/v1beta1/alerts?customerId=my_customer&pageSize=100&filter=${f}`, token, ALERTS);
    return alerts
      .filter((a) => !a.deleted && a.metadata?.severity === "HIGH" && a.metadata?.status !== "CLOSED")
      .map((a) => ({ source: "google_alerts" as const, severity: "high" as const, category: googleAlertCategory(a.type ?? ""),
        target: a.data?.email ?? a.data?.loginDetails?.ipAddress ?? a.data?.messages?.[0]?.recipient ?? a.type ?? a.alertId }));
  });
  return out;
}
