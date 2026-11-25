import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/date-utils";
import { integrationRequest } from "@/lib/integration-platform";

interface DelegatedMeta {
  client_email: string; project_id: string; key_id_suffix: string | null; admin_email: string;
  status: "active" | "error"; error_code: string | null; validated_at: string | null; last_used_at: string | null;
}
const KNOWN = ["invalid_key_file", "invalid_admin", "admin_required", "organization_changed", "delegation_missing",
  "invalid_credential", "license_or_permission", "unexpected_scope", "connection_not_authorized", "provider_unavailable"];
const MAX_FILE = 16384;

/** Admin-only: delegated service account for Cloud Identity computers. The key file is read in memory,
 *  sent once to the authenticated endpoint and never displayed, stored locally or logged. */
export function GoogleCloudIdentityCredential({ connectionId, onChange }: { connectionId: string; onChange: () => void }) {
  const { t } = useLanguage();
  const [meta, setMeta] = useState<DelegatedMeta | null | undefined>(undefined);
  const [admin, setAdmin] = useState("");
  const [fileName, setFileName] = useState("");
  const keyText = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errText = (c: string | null) => t(`collectionHub.cloudIdentity.err.${c && KNOWN.includes(c) ? c : "generic"}`);

  useEffect(() => {
    integrationRequest<{ delegated: DelegatedMeta | null }>({ action: "delegated_status", connection_id: connectionId })
      .then((r) => setMeta(r.delegated)).catch(() => setMeta(null));
  }, [connectionId]);

  const clearFile = () => { keyText.current = null; setFileName(""); if (fileInput.current) fileInput.current.value = ""; };

  async function pick(file: File | undefined) {
    clearFile(); setError("");
    if (!file) return;
    if (file.size > MAX_FILE || !/\.json$/i.test(file.name)) { setError(errText("invalid_key_file")); return; }
    keyText.current = await file.text();
    setFileName(file.name);
  }
  async function save() {
    if (!keyText.current || !admin.trim()) return;
    setBusy(true); setError("");
    try {
      const r = await integrationRequest<{ delegated: DelegatedMeta }>({
        action: "delegated_save", connection_id: connectionId, service_account: keyText.current, admin_email: admin.trim(),
      });
      setMeta(r.delegated); setAdmin("");
      toast.success(t("collectionHub.cloudIdentity.saved"));
      onChange();
    } catch (e) {
      setError(errText(e instanceof Error ? e.message : null));
    } finally {
      clearFile(); setBusy(false);
    }
  }
  async function remove() {
    setBusy(true); setError("");
    try {
      await integrationRequest({ action: "delegated_remove", connection_id: connectionId });
      setMeta(null); onChange();
      toast.success(t("collectionHub.cloudIdentity.removed"));
    } catch { setError(errText(null)); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h4 className="font-semibold">{t("collectionHub.cloudIdentity.title")}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{t("collectionHub.cloudIdentity.help")}</p>
      </div>
      {meta === undefined ? null : meta ? (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <span aria-hidden className={`h-2 w-2 rounded-full ${meta.status === "active" ? "bg-success" : "bg-destructive"}`} />
            {meta.status === "active" ? t("collectionHub.cloudIdentity.active") : errText(meta.error_code)}
          </p>
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{t("collectionHub.cloudIdentity.account")}</dt><dd className="truncate">{meta.client_email}{meta.key_id_suffix ? ` · …${meta.key_id_suffix}` : ""}</dd></div>
            <div><dt className="text-muted-foreground">{t("collectionHub.cloudIdentity.admin")}</dt><dd className="truncate">{meta.admin_email}</dd></div>
            <div><dt className="text-muted-foreground">{t("collectionHub.cloudIdentity.validated")}</dt><dd>{meta.validated_at ? formatDateTime(meta.validated_at) : "—"}</dd></div>
            <div><dt className="text-muted-foreground">{t("collectionHub.cardLastRun")}</dt><dd>{meta.last_used_at ? formatDateTime(meta.last_used_at) : "—"}</dd></div>
          </dl>
          <Button variant="outline" size="sm" loading={busy} onClick={() => void remove()}>{t("collectionHub.cloudIdentity.remove")}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("collectionHub.errors.cloud_identity_pending")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="block font-medium">{t("collectionHub.cloudIdentity.file")}</span>
              <input ref={fileInput} type="file" accept="application/json,.json" autoComplete="off"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
                onChange={(e) => void pick(e.target.files?.[0])} />
              {fileName && <span className="block text-xs text-muted-foreground">{t("collectionHub.cloudIdentity.fileReady")}</span>}
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-medium">{t("collectionHub.cloudIdentity.admin")}</span>
              <Input type="email" autoComplete="off" value={admin} onChange={(e) => setAdmin(e.target.value)} placeholder="admin@empresa.com" />
            </label>
          </div>
          <Button size="sm" loading={busy} disabled={!fileName || !admin.trim()} onClick={() => void save()}>
            {t("collectionHub.cloudIdentity.validate")}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
