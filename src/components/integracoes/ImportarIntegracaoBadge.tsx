import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { integrationRequest, integrationErrorKey } from "@/lib/integration-platform";

/** Module → connected source (logo) that can feed it. */
const FONTES: Record<string, { provider: string; logo: string; nome: string }> = {
  intune: { provider: "microsoft", logo: "/integrations/microsoft365.svg", nome: "Microsoft Intune" },
};

/**
 * Shows the connected tool's logo on a module page. While its data has not
 * been imported, a rotating ring invites the user; a click imports and turns
 * on periodic sync.
 */
export function ImportarIntegracaoBadge({ modulo, onImported }: { modulo: keyof typeof FONTES; onImported?: () => void }) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id as string | undefined;
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const fonte = FONTES[modulo];
  const { data: conn } = useQuery({
    queryKey: ["integracao-modulo", empresaId, modulo],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_connections")
        .select("id, settings, status")
        .eq("empresa_id", empresaId!)
        .eq("provider", fonte.provider)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      return data as { id: string; settings: { modules?: string[]; imported_modules?: string[] } } | null;
    },
  });
  if (!conn || !(conn.settings?.modules ?? ["intune"]).includes(modulo)) return null;
  const importado = (conn.settings?.imported_modules ?? []).includes(modulo);

  async function importar() {
    if (importado || busy) return;
    setBusy(true);
    try {
      await integrationRequest({ action: "import_module", connection_id: conn!.id, module: modulo });
      toast.success(t("integracaoImport.iniciado", { fonte: fonte.nome }));
      await qc.invalidateQueries({ queryKey: ["integracao-modulo", empresaId, modulo] });
      onImported?.();
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
          aria-label={importado ? t("integracaoImport.sincronizado", { fonte: fonte.nome }) : t("integracaoImport.disponivel", { fonte: fonte.nome })}
          className={`akuris-import-badge ${importado ? "is-synced" : "is-pending"}`}
        >
          <span className="akuris-import-ring" aria-hidden />
          <img src={fonte.logo} alt="" width={20} height={20} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {importado ? t("integracaoImport.sincronizado", { fonte: fonte.nome }) : t("integracaoImport.disponivel", { fonte: fonte.nome })}
      </TooltipContent>
    </Tooltip>
  );
}
