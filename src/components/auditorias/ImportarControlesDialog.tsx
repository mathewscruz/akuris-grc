import { useState } from "react";
import { IconSearch, IconShield } from '@/components/icons';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveCriticidadeTone, resolveControleStatusTone, resolveControleTipoTone } from "@/lib/status-tone";
import { criticidadeControle } from "@/lib/metrics/controles";
import { norm } from "@/lib/metrics/core";
import { Checkbox as ToggleInativos } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from "@/contexts/LanguageContext";
interface ImportarControlesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoriaId: string;
  auditoriaNome: string;
  onSuccess: () => void;
}

export function ImportarControlesDialog({
  open,
  onOpenChange,
  auditoriaId,
  auditoriaNome,
  onSuccess,
}: ImportarControlesDialogProps) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Um controlo inativo ou descontinuado não se audita: fica fora por omissão,
  // mas continua alcançável para quem estiver a auditar exactamente isso.
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Buscar controles disponíveis
  const { data: controles, isLoading } = useQuery({
    queryKey: ["controles-para-importar", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controles")
        .select("id, nome, descricao, tipo, status, criticidade")
        .eq("empresa_id", empresaId!)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!empresaId,
  });

  // Buscar controles já vinculados
  const { data: jaVinculados } = useQuery({
    queryKey: ["controles-vinculados", auditoriaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_itens")
        .select("controle_vinculado_id")
        .eq("auditoria_id", auditoriaId)
        .not("controle_vinculado_id", "is", null);

      if (error) throw error;
      return data?.map((d) => d.controle_vinculado_id) || [];
    },
    enabled: open && !!auditoriaId,
  });

  const ativoParaAuditar = (c: { status?: string | null }) =>
    incluirInativos || !['inativo', 'descontinuado'].includes(norm(c.status));

  const filteredControles = controles?.filter(
    (c) =>
      ativoParaAuditar(c) &&
      (c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.descricao?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const ocultos = (controles ?? []).filter((c) => !ativoParaAuditar(c)).length;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) return;

    setIsImporting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const selectedControles = controles?.filter((c) => selectedIds.includes(c.id)) || [];

      // O código do item é o identificador do papel de trabalho: tem de
      // continuar a sequência da auditoria, não recomeçar em CTRL-001 a cada
      // importação (duas importações geravam códigos repetidos).
      const { data: existentes } = await supabase
        .from("auditoria_itens")
        .select("codigo")
        .eq("auditoria_id", auditoriaId)
        .like("codigo", "CTRL-%");
      const ultimoNumero = (existentes ?? []).reduce((maior, item) => {
        const n = Number(String(item.codigo).replace("CTRL-", ""));
        return Number.isFinite(n) && n > maior ? n : maior;
      }, 0);

      const itemsToInsert = selectedControles.map((controle, index) => ({
        auditoria_id: auditoriaId,
        codigo: `CTRL-${String(ultimoNumero + index + 1).padStart(3, "0")}`,
        titulo: controle.nome,
        descricao: controle.descricao || null,
        controle_vinculado_id: controle.id,
        // A criticidade vem do banco em género feminino ("alta"/"media") e a
        // comparação directa com "alto"/"medio" caía sempre no ramo final:
        // um controlo crítico entrava na auditoria como prioridade baixa.
        prioridade: (() => {
          switch (criticidadeControle(controle)) {
            case "critico":
            case "alto":
              return "alta";
            case "baixo":
              return "baixa";
            // Sem criticidade classificada não se pode assumir prioridade
            // baixa: fica em média até alguém decidir.
            default:
              return "media";
          }
        })(),
        status: "pendente",
        created_by: userId,
      }));

      const { error } = await supabase.from("auditoria_itens").insert(itemsToInsert);

      if (error) throw error;

      toast.success(t("controlesAuditorias.icdToastSuccess", { count: selectedIds.length }));
      setSelectedIds([]);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao importar controles:", error);
      toast.error(error.message || t("controlesAuditorias.icdToastError"));
    } finally {
      setIsImporting(false);
    }
  };

  const getCriticidadeBadge = (criticidade: string) => {
    return (
      <StatusBadge {...resolveCriticidadeTone(criticidade)}>
        {formatStatus(criticidade)}
      </StatusBadge>
    );
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconShield}
      title={t("controlesAuditorias.icdTitle")}
      size="md"
      noScroll
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-sm text-muted-foreground">
            {t("controlesAuditorias.icdSelectedCount", { count: selectedIds.length })}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t("controlesAuditorias.icdBtnCancelar")}
            </Button>
            <Button size="sm" onClick={handleImport} disabled={selectedIds.length === 0 || isImporting}>
              {isImporting && <AkurisPulse size={16} className="mr-2" />}
              {t("controlesAuditorias.icdBtnImportar")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="h-full flex flex-col min-h-0 gap-4 px-6 py-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("controlesAuditorias.icdSearchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <ToggleInativos
            id="incluir-inativos"
            checked={incluirInativos}
            onCheckedChange={(v) => setIncluirInativos(v === true)}
          />
          <Label htmlFor="incluir-inativos" className="cursor-pointer text-sm font-normal">
            {t("controlesAuditorias.icdIncluirInativos")}
          </Label>
          {!incluirInativos && ocultos > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("controlesAuditorias.icdOcultos", { count: ocultos })}
            </span>
          )}
        </div>

        <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("controlesAuditorias.icdLoading")}</div>
          ) : filteredControles?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t("controlesAuditorias.icdEmpty")}
            </div>
          ) : (
            <div className="divide-y">
              {filteredControles?.map((controle) => {
                const isJaVinculado = jaVinculados?.includes(controle.id);
                const isSelected = selectedIds.includes(controle.id);

                return (
                  <div
                    key={controle.id}
                    className={`p-3 flex items-start gap-3 ${
                      isJaVinculado
                        ? "opacity-50 bg-muted/30"
                        : "hover:bg-accent cursor-pointer"
                    }`}
                    onClick={() => !isJaVinculado && toggleSelection(controle.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isJaVinculado}
                      onCheckedChange={() => toggleSelection(controle.id)}
                      // A linha inteira também alterna a seleção. Sem parar a
                      // propagação, clicar na própria caixa disparava os dois
                      // handlers e o resultado líquido era nenhum — a caixa
                      // parecia morta.
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{controle.nome}</span>
                        {getCriticidadeBadge(controle.criticidade)}
                        {isJaVinculado && (
                          <StatusBadge tone="neutral" variant="outline">
                            {t("controlesAuditorias.icdJaVinculado")}
                          </StatusBadge>
                        )}
                      </div>
                      {controle.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {controle.descricao}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1">
                        <StatusBadge {...resolveControleTipoTone(controle.tipo)}>
                          {formatStatus(controle.tipo)}
                        </StatusBadge>
                        <StatusBadge {...resolveControleStatusTone(controle.status)}>
                          {formatStatus(controle.status)}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </DialogShell>
  );
}
