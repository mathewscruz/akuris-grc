import { supabase } from "@/integrations/supabase/client";

export const COLLECTION_PROVIDERS = [
  {
    id: "microsoft365",
    name: "Microsoft 365",
    logo: "microsoft365.svg",
    family: "identity",
  },
  {
    id: "entra_id",
    name: "Microsoft Entra ID",
    logo: "entra.svg",
    family: "identity",
  },
  {
    id: "intune",
    name: "Microsoft Intune",
    logo: "intune.svg",
    family: "devices",
  },
  { id: "aws", name: "Amazon Web Services", logo: "aws.png", family: "cloud" },
  { id: "github", name: "GitHub", logo: "github.svg", family: "development" },
  {
    id: "sharepoint",
    name: "SharePoint",
    logo: "sharepoint.svg",
    family: "documents",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    logo: "onedrive.svg",
    family: "documents",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    logo: "google-drive.png",
    family: "documents",
  },
] as const;
export type CollectionProvider = (typeof COLLECTION_PROVIDERS)[number]["id"];
export interface CollectionConnection {
  id: string;
  name: string;
  provider: CollectionProvider;
  status:
    "pending" | "authorized" | "connected" | "partial" | "error" | "paused";
  frequency: "manual" | "daily" | "weekly";
  scope_ids: string[];
  settings: { system_id?: string; role_arn?: string; region?: string };
  last_success_at: string | null;
  next_run_at: string | null;
  error_code: string | null;
}
export interface CollectionRun {
  id: string;
  status: "queued" | "running" | "success" | "partial" | "error";
  resource_count: number;
  error_code: string | null;
  evidence_id: string | null;
  created_at: string;
  finished_at: string | null;
}
export interface CollectionResource {
  id: string;
  external_id: string;
  name: string;
  kind: string;
  source_url: string | null;
  signals: Record<string, string | number | boolean | null>;
  collected_at: string;
  last_run_id: string;
  checks: { key: string; status: "pass" | "fail" | "unknown" }[];
}
export interface CollectionList {
  connections: CollectionConnection[];
  availability: Partial<Record<CollectionProvider, boolean>>;
  scheduler_ready: boolean;
}
export interface CollectionDetails {
  resources: CollectionResource[];
  count: number;
  runs: CollectionRun[];
}

export async function integrationRequest<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "integration-connect",
    { body },
  );
  if (error) {
    let code = "service_unavailable";
    try {
      const response = await error.context?.json();
      if (typeof response?.error === "string") code = response.error;
    } catch {
      /* Non-JSON gateway response. */
    }
    throw new Error(code);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function connectionNeedsAttention(
  connection: CollectionConnection,
  now = Date.now(),
): boolean {
  if (connection.status === "paused") return false;
  if (connection.status === "error" || connection.status === "partial")
    return true;
  if (!connection.last_success_at || connection.frequency === "manual")
    return false;
  return (
    now - Date.parse(connection.last_success_at) >
    (connection.frequency === "weekly" ? 8 : 2) * 86400000
  );
}

export function integrationErrorKey(code: string): string {
  const known = [
    "authorization_required",
    "authorization_expired",
    "platform_setup_required",
    "scheduler_setup_required",
    "permission_missing",
    "consent_denied",
    "mfa_permission_missing",
    "roles_permission_missing",
    "intune_permission_missing",
    "branch_unavailable",
    "bucket_policy_unavailable",
    "collection_limit",
    "scope_unavailable",
    "lease_exhausted",
    "rate_limited",
    "invalid_aws_account",
    "aws_assume_role_failed",
    "aws_role_required",
    "storage_write_failed",
    "service_unavailable",
    "worker_not_ready",
    "connection_busy",
  ];
  if (code === "provider_http_429") return "collectionHub.errors.rate_limited";
  return `collectionHub.errors.${known.includes(code) ? code : "collection_failed"}`;
}
