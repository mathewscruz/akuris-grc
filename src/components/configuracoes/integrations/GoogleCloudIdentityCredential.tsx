import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/date-utils";
import { integrationErrorKey, integrationRequest, type CollectionConnection } from "@/lib/integration-platform";

/** Public identifiers of the Akuris platform service account (no secret). */
export const GOOGLE_DEVICES_CLIENT_ID = "110121051822981322395";
export const GOOGLE_DEVICES_SCOPE = "https://www.googleapis.com/auth/cloud-identity.devices.readonly";
const DWD_HELP = "https://support.google.com/a/answer/162106";
const KNOWN_ERR = ["admin_required", "invalid_admin", "organization_changed", "license_or_permission", "provider_query_failed",
  "provider_unavailable", "invalid_credential", "unexpected_scope", "collection_limit"];

/** Computers (Cloud Identity): status only. No file or key is ever requested from customers. */
export function GoogleCloudIdentityCredential({ connection, onChange, onReauthorize }: {
  connection: CollectionConnection; onChange: () => void; onReauthorize: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const ci = connection.settings.cloud_identity;
  const status = ci?.status ?? "reauthorization_required";
  const k = (s: string) => t(`collectionHub.cloudIdentity.${s}`);
  async function verify() {
    setBusy(true);
    try {
      const r = await integrationRequest<{ cloud_identity?: { status: string }; run_id?: string }>({ action: "verify_devices", connection_id: connection.id });
      if (r.run_id || r.cloud_identity?.status === "active") toast.success(k("verifiedOk"));
      else toast.info(k(`state.${r.cloud_identity?.status ?? "error"}`));
      onChange();
    } catch (e) { toast.error(t(integrationErrorKey((e as Error).message))); } finally { setBusy(false); }
  }
  const dot = status === "active" ? "bg-success" : status === "error" ? "bg-destructive" : "bg-warning";
  return (
    <section className="space-y-3 text-sm">
      <p className="text-muted-foreground">{k("help")}</p>
      <p className="flex items-center gap-2 font-medium">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
        {status === "error"
          ? t(`collectionHub.cloudIdentity.err.${ci?.error && KNOWN_ERR.includes(ci.error) ? ci.error : "generic"}`)
          : k(`state.${["unavailable", "reauthorization_required", "delegation_pending", "active"].includes(status) ? status : "unavailable"}`)}
      </p>
      {status === "active" && typeof ci?.count === "number" && <p className="text-muted-foreground">{t("collectionHub.cloudIdentity.count").replace("{n}", String(ci.count))}</p>}
      {connection.settings.admin_identity?.email && (
        <p className="text-xs text-muted-foreground">
          {k("admin")}: {connection.settings.admin_identity.email}
          {connection.settings.admin_identity.validated_at ? ` · ${formatDateTime(connection.settings.admin_identity.validated_at)}` : ""}
        </p>
      )}
      {status === "delegation_pending" && (
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>{k("step1")}</li>
          <li>{k("step2")} <code className="rounded bg-muted px-1 text-xs">{GOOGLE_DEVICES_CLIENT_ID}</code></li>
          <li>{k("step3")} <code className="break-all rounded bg-muted px-1 text-xs">{GOOGLE_DEVICES_SCOPE}</code></li>
          <li><a className="text-primary underline" href={DWD_HELP} target="_blank" rel="noopener noreferrer">{k("helpLink")}</a></li>
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "reauthorization_required" || !connection.settings.admin_identity?.email ? (
          <Button size="sm" onClick={onReauthorize}>{k("reauthorize")}</Button>
        ) : status !== "unavailable" && (
          <Button size="sm" variant="outline" loading={busy} onClick={() => void verify()}>{k("verify")}</Button>
        )}
      </div>
    </section>
  );
}
