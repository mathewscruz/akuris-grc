import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Shield } from 'lucide-react';
import { toast } from "sonner";
import { formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveCriticidadeTone, resolveControleStatusTone, resolveControleTipoTone } from "@/lib/status-tone";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
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
  const { empresaId } = useEmpresaId();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  const filteredControles = controles?.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      const itemsToInsert = selectedControles.map((controle, index) => ({
        auditoria_id: auditoriaId,
        codigo: `CTRL-${String(index + 1).padStart(3, "0")}`,
        titulo: controle.nome,
        descricao: controle.descricao || null,
        controle_vinculado_id: controle.id,
        prioridade:
          controle.criticidade === "critico"
            ? "alta"
            : controle.criticidade === "alto"
            ? "alta"
            : controle.criticidade === "medio"
            ? "media"
            : "baixa",
        status: "pendente",
        created_by: userId,
      }));

      const { error } = await supabase.from("auditoria_itens").insert(itemsToInsert);

      if (error) throw error;

      toast.success(`${selectedIds.length} controle(s) importado(s) com sucesso`);
      setSelectedIds([]);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao importar controles:", error);
      toast.error(error.message || "Erro ao importar controles");
    } finally {
      setIsImporting(false);
    }
  };

  const getCriticidadeBadge = (criticidade: string) => {
    return (
      <StatusBadge size="sm" {...resolveCriticidadeTone(criticidade)}>
        {formatStatus(criticidade)}
      </StatusBadge>
    );
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Shield}
      title="Importar Controles Existentes"
      size="md"
      noScroll
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} controle(s) selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleImport} disabled={selectedIds.length === 0 || isImporting}>
              {isImporting && <AkurisPulse size={16} className="mr-2" />}
              Importar Selecionados
            </Button>
          </div>
        </div>
      }
    >
      <div className="h-full flex flex-col min-h-0 gap-4 px-6 py-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar controles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando controles...</div>
          ) : filteredControles?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum controle encontrado
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
                        : "hover:bg-muted/20 cursor-pointer"
                    }`}
                    onClick={() => !isJaVinculado && toggleSelection(controle.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isJaVinculado}
                      onCheckedChange={() => toggleSelection(controle.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{controle.nome}</span>
                        {getCriticidadeBadge(controle.criticidade)}
                        {isJaVinculado && (
                          <StatusBadge size="sm" tone="neutral" variant="outline">
                            Já vinculado
                          </StatusBadge>
                        )}
                      </div>
                      {controle.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {controle.descricao}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1">
                        <StatusBadge size="sm" {...resolveControleTipoTone(controle.tipo)}>
                          {formatStatus(controle.tipo)}
                        </StatusBadge>
                        <StatusBadge size="sm" {...resolveControleStatusTone(controle.status)}>
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
