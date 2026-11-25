// Google Workspace (read-only, admin OAuth). Pure mapping + paginated collector.
// Signals never infer compliance: missing data stays null ("unknown").
import type { CollectedResource } from "./integration-model.ts";
import { safeSourceUrl } from "./integration-model.ts";

const S = "https://www.googleapis.com/auth/";
export const GOOGLE_WORKSPACE_SCOPES = [
  "admin.directory.user.readonly",
  "admin.directory.group.readonly",
  "admin.directory.rolemanagement.readonly",
  "admin.directory.customer.readonly",
  "admin.directory.device.mobile.readonly",
  "admin.directory.device.chromeos.readonly",
  "admin.reports.audit.readonly",
  "drive.metadata.readonly",
].map((s) => S + s);
export const GOOGLE_MODULES = ["usuarios", "dispositivos", "auditoria", "drive"] as const;
export type GoogleModule = (typeof GOOGLE_MODULES)[number];
const ADMIN = "https://admin.googleapis.com";
const WWW = "https://www.googleapis.com";
// Cloud Identity computers (cloud-identity.devices.readonly) is not a public OAuth scope; it needs
// a tenant-scoped delegated service account, not configured yet. Reported as a capability, never as 0 devices.
export const GOOGLE_CLOUD_IDENTITY_STATUS = "delegation_required" as const;
export const LOGIN_WINDOW_DAYS = 30;
const MAX_PAGES = 40;
export const MEMBERS_LIST_LIMIT = 500;

/** Identity only, to derive the connecting admin server-side (no extra data access). */
export const GOOGLE_IDENTITY_SCOPES = ["openid", "email"];
/** True when openid + email were granted (Google may echo email as userinfo.email). */
export function identityGranted(granted: string | undefined): boolean {
  const have = new Set((granted || "").split(/\s+/).filter(Boolean));
  return have.has("openid") && (have.has("email") || have.has(S + "userinfo.email"));
}
/** Scopes granted on the token response must include every requested one. */
export function missingScopes(granted: string | undefined): string[] {
  const have = new Set((granted || "").split(/\s+/).filter(Boolean));
  return GOOGLE_WORKSPACE_SCOPES.filter((s) => !have.has(s));
}
/** Reconnect must keep the same Workspace organisation. */
export function customerChange(saved: unknown, discovered: string): "ok" | "changed" {
  return typeof saved === "string" && saved && saved !== discovered ? "changed" : "ok";
}

type Read = (url: string, token: string, origin: string) => Promise<any>;
interface Paged { items: any[]; partial: boolean; incomplete?: boolean }

/** Follows pageToken within the same origin; stops at MAX_PAGES as partial. */
export async function googlePages(
  read: Read, token: string, origin: string, base: string, params: Record<string, string>, key: string,
): Promise<Paged> {
  const items: any[] = [];
  let next = "";
  let incomplete = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(base, origin);
    url.search = new URLSearchParams({ ...params, ...(next ? { pageToken: next } : {}) }).toString();
    const data = await read(url.href, token, origin);
    items.push(...(data?.[key] || []));
    // Drive reports incompleteSearch when some drives could not be searched.
    if (data?.incompleteSearch === true) incomplete = true;
    next = data?.nextPageToken || "";
    if (!next) return { items, partial: incomplete, incomplete };
  }
  return { items, partial: true, incomplete };
}

export function googleUserResource(u: any, roles: Map<string, string[]> | null, login: Map<string, LoginSummary> | null): CollectedResource {
  const l = login?.get((u.primaryEmail || "").toLowerCase());
  return {
    externalId: `user:${u.id}`,
    kind: "identity",
    name: u.name?.fullName || u.primaryEmail,
    signals: {
      source: "google_workspace",
      email: u.primaryEmail ?? null,
      enabled: typeof u.suspended === "boolean" ? !u.suspended : null,
      suspended: u.suspended ?? null,
      archived: u.archived ?? null,
      // isAdmin/isDelegatedAdmin come with each user, so privilege is known even if role listing is partial.
      privileged: typeof u.isAdmin === "boolean" || typeof u.isDelegatedAdmin === "boolean"
        ? !!(u.isAdmin || u.isDelegatedAdmin) : null,
      super_admin: u.isAdmin ?? null,
      delegated_admin: u.isDelegatedAdmin ?? null,
      admin_roles: roles ? (roles.get(u.id) || []).join(", ") || null : null,
      mfa_registered: u.isEnrolledIn2Sv ?? null,
      mfa_enforced: u.isEnforcedIn2Sv ?? null,
      last_login_at: u.lastLoginTime && !u.lastLoginTime.startsWith("1970") ? u.lastLoginTime : null,
      last_login_event_at: l?.last ?? null,
      login_failures_window: l ? l.failures : null,
      login_window_days: login ? LOGIN_WINDOW_DAYS : null,
      department: u.organizations?.[0]?.department ?? null,
      job_title: u.organizations?.[0]?.title ?? null,
    },
  };
}

export interface LoginSummary { last: string | null; failures: number }
/** Reports API covers explicit/SAML logins only; absence means unknown, not safe. */
export function summarizeLogins(activities: any[]): Map<string, LoginSummary> {
  const out = new Map<string, LoginSummary>();
  for (const a of activities) {
    const email = (a.actor?.email || "").toLowerCase();
    if (!email) continue;
    const s = out.get(email) || { last: null, failures: 0 };
    const time = a.id?.time ?? null;
    for (const e of a.events || []) {
      if (e.name === "login_success" && time && (!s.last || time > s.last)) s.last = time;
      if (e.name === "login_failure") s.failures++;
    }
    out.set(email, s);
  }
  return out;
}

const trusted = (v: unknown) => typeof v === "string" && v.trim().length >= 4 &&
  !/^(0+|n\/?a|unknown|default string|to be filled.*|none|serial)$/i.test(v.trim()) ? v.trim() : null;

export function googleDeviceResource(kind: "mobile" | "chromeos" | "cloud", d: any): CollectedResource | null {
  const id = kind === "mobile" ? d.resourceId : kind === "chromeos" ? d.deviceId : d.name;
  if (!id) return null;
  return {
    externalId: `device:google:${kind}:${id}`,
    kind: "device",
    name: (kind === "mobile" ? d.model || d.name?.[0] : kind === "chromeos" ? d.annotatedAssetId || d.model : d.model) || id,
    signals: {
      source: "google_workspace",
      google_kind: kind,
      // No compliance claim: Google lists devices, it does not attest compliance here.
      compliance: "unknown",
      os: (kind === "mobile" ? d.os : kind === "chromeos" ? "ChromeOS " + (d.osVersion || "") : d.osVersion || d.deviceType) ?? null,
      version: (kind === "chromeos" ? d.osVersion : kind === "mobile" ? d.os : d.osVersion) ?? null,
      model: d.model ?? null,
      manufacturer: d.manufacturer ?? null,
      serial_number: trusted(d.serialNumber),
      owner_email: (kind === "mobile" ? d.email?.[0] : kind === "chromeos" ? d.annotatedUser : null) ?? null,
      provider_last_sync: (kind === "mobile" ? d.lastSync : kind === "chromeos" ? d.lastSync : d.lastSyncTime) ?? null,
      device_status: (kind === "mobile" ? d.status : kind === "chromeos" ? d.status : d.managementState) ?? null,
      ...(kind === "cloud" ? { device_type: d.deviceType ?? null, owner_type: d.ownerType ?? null,
        // Cloud Identity encryptionState: only explicit values count; unspecified/unsupported/absent stay unknown.
        encrypted: d.encryptionState === "ENCRYPTED" ? true : d.encryptionState === "NOT_ENCRYPTED" ? false : null } : {}),
    },
  };
}

export function googleFileResource(f: any): CollectedResource {
  return {
    externalId: `file:${f.id}`,
    kind: "document",
    name: f.name,
    url: safeSourceUrl(f.webViewLink),
    signals: {
      source: "google_workspace",
      metadata_only: true,
      mime_type: f.mimeType ?? null,
      modified_at: f.modifiedTime ?? null,
      created_at: f.createdTime ?? null,
      version: f.version ?? null,
      size: Number(f.size) || null,
      provider_hash: f.md5Checksum ?? null,
      shared_drive_id: f.driveId ?? null,
    },
  };
}

function code(e: unknown) {
  return (e as { code?: string })?.code || "provider_error";
}

/** Each module is independent: one failing (no licence/permission/limit) never drops the others. */
export async function collectGoogleWorkspace(read: Read, token: string, customerId: string, modules: string[], now = Date.now()) {
  const resources: CollectedResource[] = [];
  const warnings: string[] = [];
  const want = (m: GoogleModule) => modules.includes(m);
  const customer = "my_customer";
  if (want("usuarios") || want("auditoria")) {
    let roles: Map<string, string[]> | null = null;
    let login: Map<string, LoginSummary> | null = null;
    if (want("usuarios")) {
      try {
        const [defs, asg] = await Promise.all([
          googlePages(read, token, ADMIN, `/admin/directory/v1/customer/${customer}/roles`, { maxResults: "100" }, "items"),
          googlePages(read, token, ADMIN, `/admin/directory/v1/customer/${customer}/roleassignments`, { maxResults: "200" }, "items"),
        ]);
        const names = new Map(defs.items.map((r: any) => [String(r.roleId), r.roleName]));
        roles = new Map();
        for (const a of asg.items) {
          if (a.assigneeType && a.assigneeType !== "user") continue;
          const list = roles.get(a.assignedTo) || [];
          list.push(names.get(String(a.roleId)) || String(a.roleId));
          roles.set(a.assignedTo, list);
        }
        // Partial role list: never present missing roles as "no privileges".
        if (defs.partial || asg.partial) { roles = null; warnings.push("module:usuarios:roles_partial"); }
      } catch (e) {
        warnings.push(`module:usuarios:roles_${code(e)}`);
      }
    }
    if (want("auditoria")) {
      try {
        const start = new Date(now - LOGIN_WINDOW_DAYS * 86400000).toISOString();
        const acts = await googlePages(read, token, ADMIN, "/admin/reports/v1/activity/users/all/applications/login",
          { startTime: start, maxResults: "1000" }, "items");
        login = summarizeLogins(acts.items);
        if (acts.partial) warnings.push("module:auditoria:collection_limit");
      } catch (e) {
        warnings.push(`module:auditoria:${code(e)}`);
      }
    }
    try {
      const users = await googlePages(read, token, ADMIN, "/admin/directory/v1/users",
        { customer, maxResults: "500", projection: "full", orderBy: "email" }, "users");
      if (users.partial) warnings.push("module:usuarios:collection_limit");
      resources.push(...users.items.map((u) => googleUserResource(u, roles, login)));
    } catch (e) {
      warnings.push(`module:usuarios:${code(e)}`);
    }
    if (want("usuarios")) {
      try {
        const groups = await googlePages(read, token, ADMIN, "/admin/directory/v1/groups", { customer, maxResults: "200" }, "groups");
        if (groups.partial) warnings.push("module:usuarios:groups_partial");
        for (const g of groups.items.slice(0, 300)) {
          let members: Paged = { items: [], partial: true };
          try {
            members = await googlePages(read, token, ADMIN, `/admin/directory/v1/groups/${encodeURIComponent(g.id)}/members`, { maxResults: "200" }, "members");
          } catch (e) {
            warnings.push(`module:usuarios:members_${code(e)}`);
          }
          if (members.partial) warnings.push("module:usuarios:members_partial");
          else if (members.items.length > MEMBERS_LIST_LIMIT) warnings.push("module:usuarios:members_list_limit");
          resources.push({
            externalId: `group:${g.id}`,
            kind: "identity",
            name: g.name || g.email,
            signals: {
              source: "google_workspace", type: "group", email: g.email ?? null,
              // Count stays correct even when the stored list is truncated or partial.
              members_count: !members.partial ? members.items.length
                : (Number.isFinite(Number(g.directMembersCount)) ? Number(g.directMembersCount) : null),
              members: members.partial ? null : members.items.map((m: any) => m.email).filter(Boolean).slice(0, MEMBERS_LIST_LIMIT).join(", "),
              members_partial: members.partial || members.items.length > MEMBERS_LIST_LIMIT,
              privileged: null,
            },
          });
        }
        if (groups.items.length > 300) warnings.push("module:usuarios:groups_partial");
      } catch (e) {
        warnings.push(`module:usuarios:groups_${code(e)}`);
      }
    }
  }
  if (want("dispositivos")) {
    const parts: [string, () => Promise<Paged>, "mobile" | "chromeos"][] = [
      ["mobile", () => googlePages(read, token, ADMIN, `/admin/directory/v1/customer/${customer}/devices/mobile`, { maxResults: "100", projection: "FULL" }, "mobiledevices"), "mobile"],
      ["chromeos", () => googlePages(read, token, ADMIN, `/admin/directory/v1/customer/${customer}/devices/chromeos`, { maxResults: "200", projection: "FULL" }, "chromeosdevices"), "chromeos"],
    ];
    for (const [label, run, kind] of parts) {
      try {
        const r = await run();
        if (r.partial) warnings.push(`module:dispositivos:${label}_limit`);
        resources.push(...r.items.map((d) => googleDeviceResource(kind, d)).filter(Boolean) as CollectedResource[]);
      } catch (e) {
        warnings.push(`module:dispositivos:${label}_${code(e)}`);
      }
    }
  }
  if (want("drive")) {
    try {
      // Metadata only: files visible to the authorising admin plus shared drives they can see.
      const r = await googlePages(read, token, WWW, "/drive/v3/files", {
        pageSize: "100", q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
        corpora: "allDrives", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
        fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,createdTime,modifiedTime,version,webViewLink,size,md5Checksum,driveId)",
      }, "files");
      if (r.incomplete) warnings.push("module:drive:incomplete_search");
      else if (r.partial) warnings.push("module:drive:collection_limit");
      resources.push(...r.items.map(googleFileResource));
    } catch (e) {
      warnings.push(`module:drive:${code(e)}`);
    }
  }
  return { resources, warnings: [...new Set(warnings)] };
}

/** Pure asset mapping for Gestão de Ativos. */
export function ativoDoGoogle(r: CollectedResource) {
  if (r.kind !== "device") return null;
  const s = r.signals;
  return {
    google_device_id: r.externalId.replace(/^device:google:/, ""),
    nome: String(r.name).slice(0, 200),
    tipo: "Hardware",
    versao: (s.version as string) ?? null,
    atributos: {
      numero_serie: s.serial_number ?? null,
      sistema_operacional: s.os ?? null,
      modelo: s.model ?? null,
      fabricante: s.manufacturer ?? null,
      usuario: s.owner_email ?? null,
      google_origem: s.google_kind,
      google_ultimo_sync: s.provider_last_sync ?? null,
      google_estado: s.device_status ?? null,
    },
  };
}

/** Module a Google resource feeds, or null when it never feeds a module directly. */
export function googleModuleOf(r: CollectedResource): GoogleModule | null {
  return r.kind === "document" ? "drive" : r.kind === "identity" ? "usuarios" : r.kind === "device" ? "dispositivos" : null;
}
/**
 * Resources allowed into Akuris modules: only explicitly imported modules, and within each
 * module either "all" or the explicitly selected ids. Connecting alone selects nothing.
 */
export function googleSelected(resources: CollectedResource[], settings: { imported_modules?: string[]; module_scope?: Record<string, unknown> }) {
  const imported = new Set(settings.imported_modules ?? []);
  const scope = settings.module_scope ?? {};
  return resources.filter((r) => {
    const m = googleModuleOf(r);
    if (!m || m === "dispositivos" || !imported.has(m)) return false;
    const s = scope[m];
    return s === "all" || (Array.isArray(s) && s.includes(r.externalId));
  });
}
