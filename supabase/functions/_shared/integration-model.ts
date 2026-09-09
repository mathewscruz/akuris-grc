export const PROVIDERS = [
  "microsoft365",
  "entra_id",
  "intune",
  "aws",
  "github",
  "sharepoint",
  "onedrive",
  "google_drive",
] as const;
export type Provider = (typeof PROVIDERS)[number];
export type Signals = Record<string, string | number | boolean | null>;
export interface CollectedResource {
  externalId: string;
  kind: "identity" | "device" | "repository" | "document" | "cloud";
  name: string;
  url?: string;
  signals: Signals;
}
export interface CheckResult {
  key: string;
  status: "pass" | "fail" | "unknown";
}
export function evaluateResource(resource: CollectedResource): CheckResult[] {
  const test = (key: string, value: unknown): CheckResult => ({
    key,
    status: value === true ? "pass" : value === false ? "fail" : "unknown",
  });
  switch (resource.kind) {
    case "identity":
      return [test("mfa_registered", resource.signals.mfa_registered)];
    case "device":
      return [
        test(
          "device_compliant",
          resource.signals.compliance === "compliant"
            ? true
            : resource.signals.compliance === "noncompliant"
              ? false
              : null,
        ),
      ];
    case "repository":
      return [test("branch_protected", resource.signals.branch_protected)];
    case "cloud":
      return Object.entries(resource.signals)
        .filter(([key]) =>
          ["root_mfa", "public_access_blocked", "logging_enabled"].includes(
            key,
          ),
        )
        .map(([key, value]) => test(key, value));
    default:
      return [];
  }
}
export function inScope(
  resources: CollectedResource[],
  ids: string[],
): CollectedResource[] {
  // Empty selection means discovery only, never implicit approval of all data.
  const selected = new Set(ids);
  return resources.filter((resource) => selected.has(resource.externalId));
}
export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function nextFrequencyDate(
  frequency: string,
  now = Date.now(),
): string | null {
  return frequency === "daily" || frequency === "weekly"
    ? new Date(now + (frequency === "weekly" ? 7 : 1) * 86400000).toISOString()
    : null;
}
export function retryDelay(
  attempt: number,
  retryAfter?: string | null,
): number {
  const supplied =
    retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
  return Math.min(3600, Math.max(30 * 2 ** Math.max(0, attempt - 1), supplied));
}
export function validRoleArn(value: string): boolean {
  return /^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,512}$/.test(value);
}

/** Registration and operational state are intentionally not compliance decisions. */
export function identityImportRow(
  resource: CollectedResource,
  connectionId: string,
) {
  if (
    resource.kind !== "identity" ||
    typeof resource.signals.privileged !== "boolean"
  )
    return null;
  return {
    nome_usuario: resource.name,
    email_usuario: resource.signals.email,
    departamento: resource.signals.department,
    cargo: resource.signals.job_title,
    tipo_acesso: resource.signals.privileged ? "administracao" : "leitura",
    nivel_privilegio: resource.signals.privileged ? "administrador" : "usuario",
    ativo: resource.signals.enabled !== false,
    origem: "entra_id",
    origem_id: resource.externalId.replace(/^user:/, ""),
    integration_signals: resource.signals,
    integration_connection_id: connectionId,
  };
}
