import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { integrationRequest, integrationErrorKey } from "@/lib/integration-platform";

interface Fonte { provider: string; module: string; logo: string; nome: string }
/** Akuris page → connected tools (and their module) that can feed it. */
const FONTES: Record<string, Fonte[]> = {
  ativos: [
    { provider: "microsoft", module: "intune", logo: "/integrations/microsoft365.svg", nome: "Microsoft Intune" },
    { provider: "google_workspace", module: "dispositivos", logo: "/integrations/google-workspace.svg", nome: "Google Workspace" },
  ],
  acessos: [
    { provider: "google_workspace", module: "usuarios", logo: "/integrations/google-workspace.svg", nome: "Google Workspace" },
  ],
  documentos: [
    { provider: "google_workspace", module: "drive", logo: "/integrations/google-workspace.svg", nome: "Google Drive" },
  ],
};
type Conn = { id: string; provider: string; settings: { modules?: string[]; imported_modules?: string[] } };

/**
 * Shows each connected tool's logo on a module page. While its data has not
 * been imported, a rotating ring invites the user; a click imports and turns
 * on periodic sync. Connecting alone never imports.
 */
export function ImportarIntegracaoBadge({ pagina }: { pagina: keyof typeof FONTES }) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id as string | undefined;
  const fontes = FONTES[pagina];
  const { data } = useQuery({
    queryKey: ["integracao-modulo", empresaId, pagina],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_connections")
        .select("id, provider, settings")
        .eq("empresa_id", empresaId!)
        .in("provider", [...new Set(fontes.map((f) => f.provider))])
        .in("status", ["connected", "authorized", "partial"]);
      return (data || []) as Conn[];
    },
  });
  if (!data?.length) return null;
  return (
    <>
      {fontes.map((f) => {
        const conn = data.find((c) => c.provider === f.provider);
        if (!conn) return null;
        const mods = conn.settings?.modules ?? (f.provider === "microsoft" ? ["intune"] : [f.module]);
        if (!mods.includes(f.module)) return null;
        return <Badge key={f.provider} fonte={f} conn={conn} empresaId={empresaId!} pagina={pagina} />;
      })}
    </>
  );
}

function Badge({ fonte, conn, empresaId, pagina }: { fonte: Fonte; conn: Conn; empresaId: string; pagina: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const importado = (conn.settings?.imported_modules ?? []).includes(fonte.module);
  const label = importado
    ? t("integracaoImport.sincronizado", { fonte: fonte.nome })
    : t("integracaoImport.disponivel", { fonte: fonte.nome });
  async function importar() {
    if (importado || busy) return;
    setBusy(true);
    try {
      await integrationRequest({ action: "import_module", connection_id: conn.id, module: fonte.module });
      toast.success(t("integracaoImport.iniciado", { fonte: fonte.nome }));
      await qc.invalidateQueries({ queryKey: ["integracao-modulo", empresaId, pagina] });
    } catch (e) {
      toast.error(t(integrationErrorKey((e as Error).message)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={importar}
          disabled={busy}
          aria-label={label}
          className={`akuris-import-badge ${importado ? "is-synced" : "is-pending"}`}
        >
          <span className="akuris-import-ring" aria-hidden />
          <img src={fonte.logo} alt="" width={20} height={20} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
