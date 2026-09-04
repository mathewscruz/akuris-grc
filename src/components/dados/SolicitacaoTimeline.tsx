import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconAdd, IconHistory } from "@/components/icons";
import { formatDateTime } from "@/lib/date-utils";
import { toast } from "@/lib/toast";
import { exigirEscrita } from "@/lib/supabase-write";
import { useLanguage } from "@/contexts/LanguageContext";

export function SolicitacaoTimeline({
  solicitacaoId,
  readOnly = false,
}: {
  solicitacaoId: string;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const key = ["solicitacao-eventos", solicitacaoId];
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!empresaId && !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dados_solicitacao_eventos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("solicitacao_id", solicitacaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const adicionar = async () => {
    if (!nota.trim() || !empresaId) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      await exigirEscrita(
        (supabase as any).from("dados_solicitacao_eventos").insert({
          empresa_id: empresaId,
          solicitacao_id: solicitacaoId,
          tipo: "nota",
          descricao: nota.trim(),
          created_by: auth.user?.id ?? null,
        }),
      );
      setNota("");
      await qc.invalidateQueries({ queryKey: key });
    } catch (error: any) {
      toast.error(t("privacidadePrograma.timeline.erro"), {
        description: error?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <IconHistory className="h-4 w-4 text-primary" />
          {t("privacidadePrograma.timeline.titulo")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("privacidadePrograma.timeline.descricao")}
        </p>
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={t("privacidadePrograma.timeline.placeholder")}
            onKeyDown={(e) => e.key === "Enter" && void adicionar()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || !nota.trim()}
            onClick={() => void adicionar()}
          >
            <IconAdd className="mr-1.5 h-4 w-4" />
            {t("privacidadePrograma.timeline.adicionar")}
          </Button>
        </div>
      )}
      <div className="max-h-48 space-y-3 overflow-y-auto pr-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("privacidadePrograma.timeline.vazio")}
          </p>
        ) : (
          eventos.map((evento: any) => (
            <div
              key={evento.id}
              className="relative border-l-2 border-border pl-3 text-sm"
            >
              <p className="font-medium">{evento.descricao}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(evento.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
