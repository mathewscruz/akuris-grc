import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, MessageSquare, Paperclip, User, Calendar, ChevronRight, Download, Shield, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ItemAuditoriaFormDialog } from "./ItemAuditoriaFormDialog";
import { ItemAuditoriaDetalheDialog } from "./ItemAuditoriaDetalheDialog";
import { ImportarControlesDialog } from "./ImportarControlesDialog";
import { useUsuariosEmpresa } from "@/hooks/useAuditoriaData";
import { formatDateOnly } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveWorkflowStatusTone, resolveAuditoriaPrioridadeTone } from "@/lib/status-tone";

interface ItensAuditoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoriaId: string;
  auditoriaNome: string;
}

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "nao_aplicavel", label: "Não Aplicável" },
];

export function ItensAuditoriaDialog({
  open,
  onOpenChange,
  auditoriaId,
  auditoriaNome,
}: ItensAuditoriaDialogProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("todos");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDetalheOpen, setIsDetalheOpen] = useState(false);
  const [detalheItem, setDetalheItem] = useState<any>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const { data: usuarios } = useUsuariosEmpresa();

  // Buscar itens manuais + controles vinculados
  const { data: itens, isLoading } = useQuery({
    queryKey: ["auditoria-itens", auditoriaId],
    queryFn: async () => {
      // Buscar itens manuais
      const { data: itensData, error: itensError } = await supabase
        .from("auditoria_itens")
        .select(`
          *,
          responsavel:profiles!auditoria_itens_responsavel_id_fkey(user_id, nome, email)
        `)
        .eq("auditoria_id", auditoriaId)
        .order("codigo");

      if (itensError) throw itensError;

      // Buscar controles vinculados via controles_auditorias
      const { data: controlesData, error: controlesError } = await supabase
        .from("controles_auditorias")
        .select(`
          controle_id,
          observacoes,
          controle:controles(id, nome, descricao, status, criticidade, responsavel_id, tipo)
        `)
        .eq("auditoria_id", auditoriaId);

      if (controlesError) throw controlesError;

      // Buscar nomes dos responsáveis dos controles
      const responsavelIds = controlesData
        ?.map((c: any) => c.controle?.responsavel_id)
        .filter(Boolean) || [];
      
      let responsaveisMap = new Map();
      if (responsavelIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome, email")
          .in("user_id", responsavelIds);
        responsaveisMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      }

      // Mapear controles vinculados para o formato de itens
      const controlesAsItens = controlesData?.map((cv: any) => ({
        id: cv.controle?.id,
        codigo: `CTRL-${cv.controle?.id?.slice(0, 6).toUpperCase()}`,
        titulo: cv.controle?.nome,
        descricao: cv.controle?.descricao,
        status: cv.controle?.status === 'ativo' ? 'concluido' : 'pendente',
        prioridade: cv.controle?.criticidade === 'critico' ? 'alta' : cv.controle?.criticidade === 'alto' ? 'alta' : 'media',
        controle_vinculado_id: cv.controle?.id,
        responsavel_id: cv.controle?.responsavel_id,
        responsavel: responsaveisMap.get(cv.controle?.responsavel_id) || null,
        prazo: null,
        observacoes: cv.observacoes,
        is_controle_vinculado: true,
      })) || [];

      // Combinar itens manuais + controles vinculados
      return [...(itensData || []), ...controlesAsItens];
    },
    enabled: open && !!auditoriaId,
  });

  // Buscar contagens de evidências e comentários para cada item
  const { data: contagens } = useQuery({
    queryKey: ["auditoria-itens-contagens", auditoriaId],
    queryFn: async () => {
      if (!itens || itens.length === 0) return {};

      const itemIds = itens.map((i) => i.id);

      const [evidenciasRes, comentariosRes] = await Promise.all([
        supabase
          .from("auditoria_itens_evidencias")
          .select("item_id")
          .in("item_id", itemIds),
        supabase
          .from("auditoria_itens_comentarios")
          .select("item_id")
          .in("item_id", itemIds),
      ]);

      const evidenciasPorItem: Record<string, number> = {};
      const comentariosPorItem: Record<string, number> = {};

      evidenciasRes.data?.forEach((e) => {
        evidenciasPorItem[e.item_id] = (evidenciasPorItem[e.item_id] || 0) + 1;
      });

      comentariosRes.data?.forEach((c) => {
        comentariosPorItem[c.item_id] = (comentariosPorItem[c.item_id] || 0) + 1;
      });

      return { evidencias: evidenciasPorItem, comentarios: comentariosPorItem };
    },
    enabled: !!itens && itens.length > 0,
  });

  const filteredItens = itens?.filter((item) => {
    const matchesSearch =
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || item.status === statusFilter;
    const matchesResponsavel =
      responsavelFilter === "todos" || item.responsavel_id === responsavelFilter;
    return matchesSearch && matchesStatus && matchesResponsavel;
  });

  const stats = {
    total: itens?.length || 0,
    pendente: itens?.filter((i) => i.status === "pendente").length || 0,
    em_andamento: itens?.filter((i) => i.status === "em_andamento").length || 0,
    concluido: itens?.filter((i) => i.status === "concluido").length || 0,
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.concluido / stats.total) * 100) : 0;

  const handleAddItem = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  const handleEditItem = (item: any) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleOpenDetalhe = (item: any) => {
    setDetalheItem(item);
    setIsDetalheOpen(true);
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["auditoria-itens", auditoriaId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria-itens-count", auditoriaId] });
    setIsFormOpen(false);
  };

  const handleDetalheSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["auditoria-itens", auditoriaId] });
    queryClient.invalidateQueries({ queryKey: ["auditoria-itens-contagens", auditoriaId] });
  };

  const getStatusBadge = (status: string) => {
    return (
      <StatusBadge size="sm" {...resolveWorkflowStatusTone(status)}>
        {formatStatus(status)}
      </StatusBadge>
    );
  };

  const getPrioridadeBadge = (prioridade: string) => {
    return (
      <StatusBadge size="sm" {...resolveAuditoriaPrioridadeTone(prioridade)}>
        {formatStatus(prioridade)}
      </StatusBadge>
    );
  };

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={FileText}
        title={`Itens de Verificação — ${auditoriaNome}`}
        size="xl"
        noScroll
        hideFooter
      >
        <div className="h-full flex flex-col min-h-0 gap-4 px-6 py-6">
          {/* Progresso */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso da Auditoria</span>
              <span className="font-medium">{progressPercent}% concluído</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Total: {stats.total}</span>
              <span className="text-muted-foreground">Pendente: {stats.pendente}</span>
              <span className="text-info">Em Andamento: {stats.em_andamento}</span>
              <span className="text-success">Concluído: {stats.concluido}</span>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Responsáveis</SelectItem>
                {usuarios?.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Importar Controles
            </Button>
            <Button onClick={handleAddItem}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </div>

          {/* Tabela */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-[150px]">Responsável</TableHead>
                  <TableHead className="w-[100px]">Prazo</TableHead>
                  <TableHead className="w-[100px]">Prioridade</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredItens?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItens?.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenDetalhe(item)}
                    >
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1">
                          {(item as any).is_controle_vinculado && (
                            <Link2 className="h-3 w-3 text-primary" />
                          )}
                          {item.codigo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.titulo}</span>
                          {(item as any).is_controle_vinculado ? (
                            <StatusBadge size="sm" tone="neutral" variant="outline" className="w-fit mt-1">
                              Controle Vinculado
                            </StatusBadge>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {contagens?.evidencias?.[item.id] || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {contagens?.comentarios?.[item.id] || 0}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.responsavel ? (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[120px]">
                              {item.responsavel.nome}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.prazo ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDateOnly(item.prazo)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getPrioridadeBadge(item.prioridade)}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-center">
                        <ChevronRight className="h-4 w-4 text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogShell>

      <ItemAuditoriaFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        auditoriaId={auditoriaId}
        auditoriaNome={auditoriaNome}
        item={selectedItem}
        onSuccess={handleFormSuccess}
      />

      <ItemAuditoriaDetalheDialog
        open={isDetalheOpen}
        onOpenChange={setIsDetalheOpen}
        item={detalheItem}
        onSuccess={handleDetalheSuccess}
        onEdit={() => {
          setIsDetalheOpen(false);
          handleEditItem(detalheItem);
        }}
      />

      <ImportarControlesDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        auditoriaId={auditoriaId}
        auditoriaNome={auditoriaNome}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
