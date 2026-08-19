import { useState, useEffect, useMemo } from "react";
import { IconAdd, IconDownload, IconMore, IconSuccess, IconWarning, IconTime, IconFile } from '@/components/icons';
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useEmpresaId } from "@/hooks/useEmpresaId";
;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatStrip } from "@/components/ui/stat-strip";
import { ModuleToolbar, ToolbarField } from "@/components/ui/module-toolbar";
import {
  DropdownMenu as ActionsMenu,
  DropdownMenuContent as ActionsMenuContent,
  DropdownMenuItem as ActionsMenuItem,
  DropdownMenuTrigger as ActionsMenuTrigger,
} from "@/components/ui/dropdown-menu";
;
import { EmptyState } from "@/components/ui/empty-state";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from '@/hooks/use-toast';
import { useUsuariosEmpresa } from "@/hooks/useAuditoriaData";
import AuditoriaDialog from "@/components/auditorias/AuditoriaDialog";
import { ItensAuditoriaDialog } from "@/components/auditorias/ItensAuditoriaDialog";
import { AuditoriaCardAccordion } from "@/components/auditorias/AuditoriaCardAccordion";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatDateOnly } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuditoriasContent({ actionsSlot }: { actionsSlot?: HTMLElement | null } = {}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();
  const { empresaId } = useEmpresaId();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [selectedAuditoria, setSelectedAuditoria] = useState<any>(null);
  const [showAuditoriaDialog, setShowAuditoriaDialog] = useState(false);
  const [showControlesDialog, setShowControlesDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome?: string }>({ open: false, id: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: usuarios } = useUsuariosEmpresa();

  const { data: auditorias, isLoading, refetch } = useQuery({
    queryKey: ['auditorias', empresaId, searchTerm, statusFilter, tipoFilter],
    queryFn: async () => {
      let query = supabase
        .from('auditorias')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      if (tipoFilter !== 'todos') {
        query = query.eq('tipo', tipoFilter);
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: t("governancaComp.auditorias.toastErrorTitle"),
          description: t("governancaComp.auditorias.toastErrorLoad"),
          variant: "destructive",
        });
        throw error;
      }

      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar contagens de itens para todas as auditorias (inclui auditoria_itens + controles_auditorias)
  const { data: auditoriasCounts } = useQuery({
    queryKey: ['auditorias-counts', auditorias?.map(a => a.id)],
    queryFn: async () => {
      if (!auditorias || auditorias.length === 0) return {};
      
      const counts: Record<string, { itens: number; itensConcluidos: number }> = {};
      const auditoriaIds = auditorias.map(a => a.id);
      
      // Buscar TODOS os itens de todas as auditorias de uma vez
      const [itensRes, controlesRes] = await Promise.all([
        supabase
          .from('auditoria_itens')
          // `controle_vinculado_id` e o que permite deduplicar contra
          // `controles_auditorias`, que e espelhada por gatilho a partir daqui.
          .select('id, status, auditoria_id, controle_vinculado_id')
          .in('auditoria_id', auditoriaIds),
        supabase
          .from('controles_auditorias')
          .select(`auditoria_id, controle_id, controle:controles(id, status)`)
          .in('auditoria_id', auditoriaIds)
      ]);
      
      /**
       * Progresso da auditoria — a MESMA derivação de `ItensAuditoriaDialog`.
       *
       * Havia duas contas para o mesmo número, e esta estava errada nos dois
       * lados. Somava `auditoria_itens + controles_auditorias` sem deduplicar,
       * e desde que a segunda passou a ser espelhada por gatilho a partir da
       * primeira, cada controlo importado entrava duas vezes. E contava o
       * controlo `ativo` como item concluído — estar no âmbito não é estar
       * auditado. A Deloitte-2025 saía "50/50 · 100% concluído" no cartão e no
       * CSV com zero itens de trabalho concluídos e zero testes.
       */
      for (const auditoria of auditorias) {
        const itens = itensRes.data?.filter(i => i.auditoria_id === auditoria.id) || [];
        const controles = controlesRes.data?.filter((c: any) => c.auditoria_id === auditoria.id) || [];

        const comItemProprio = new Set(
          itens.map((i: any) => i.controle_vinculado_id).filter(Boolean),
        );
        const controlesSemItem = controles.filter(
          (c: any) => c.controle?.id && !comItemProprio.has(c.controle.id),
        );

        counts[auditoria.id] = {
          itens: itens.length + controlesSemItem.length,
          // Só o trabalho de auditoria realmente concluído conta.
          itensConcluidos: itens.filter(i => i.status === 'concluido').length,
        };
      }
      
      return counts;
    },
    enabled: !!auditorias && auditorias.length > 0,
  });

  const handleEdit = (auditoria: any) => {
    setSelectedAuditoria(auditoria);
    setShowAuditoriaDialog(true);
  };

  const handleDelete = (id: string, nome?: string) => {
    setDeleteConfirm({ open: true, id, nome });
  };

  const confirmDelete = async () => {
    const { id } = deleteConfirm;
    
    const { error } = await supabase
      .from('auditorias')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: t("governancaComp.auditorias.toastErrorTitle"),
        description: t("governancaComp.auditorias.toastErrorDelete"),
        variant: "destructive",
      });
      setDeleteConfirm({ open: false, id: '' });
      return;
    }

    toast({
      title: t("governancaComp.auditorias.toastSuccessTitle"),
      description: t("governancaComp.auditorias.toastDeleted"),
    });
    setDeleteConfirm({ open: false, id: '' });
    refetch();
  };

  const handleOpenControles = (auditoria: any) => {
    setSelectedAuditoria(auditoria);
    setShowControlesDialog(true);
  };

  // Detectar se veio com itemId do dashboard
  useEffect(() => {
    const itemId = location.state?.itemId;
    if (itemId && auditorias && auditorias.length > 0) {
      const auditoria = auditorias.find(a => a.id === itemId);
      if (auditoria) {
        setSelectedAuditoria(auditoria);
        setShowAuditoriaDialog(true);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, auditorias]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tipoFilter, searchTerm]);

  // Exportar para CSV
  const handleExportCSV = () => {
    if (!auditorias || auditorias.length === 0) return;
    
    const headers = ['Nome', 'Tipo', 'Status', 'Prioridade', 'Data Início', 'Auditor', 'Itens', 'Concluídos', '% Progresso'];
    
    const rows = auditorias.map(a => {
      const counts = auditoriasCounts?.[a.id] || { itens: 0, itensConcluidos: 0 };
      const auditor = usuarios?.find((u: any) => u.user_id === a.auditor_responsavel);
      const progresso = counts.itens > 0 ? Math.round((counts.itensConcluidos / counts.itens) * 100) : 0;
      
      return [
        a.nome,
        formatStatus(a.tipo),
        formatStatus(a.status),
        formatStatus(a.prioridade),
        a.data_inicio ? formatDateOnly(a.data_inicio) : '-',
        auditor?.nome || '-',
        counts.itens,
        counts.itensConcluidos,
        `${progresso}%`
      ].join(';');
    });
    
    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditorias_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast({
      title: t("governancaComp.auditorias.toastExportTitle"),
      description: t("governancaComp.auditorias.toastExportDesc", { count: auditorias.length }),
    });
  };

  // Calcular estatísticas
  const totalItens = Object.values(auditoriasCounts || {}).reduce((acc, c) => acc + c.itens, 0);
  const totalConcluidos = Object.values(auditoriasCounts || {}).reduce((acc, c) => acc + c.itensConcluidos, 0);

  // Pagination
  const paginatedAuditorias = useMemo(() => {
    if (!auditorias) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return auditorias.slice(startIndex, startIndex + itemsPerPage);
  }, [auditorias, currentPage, itemsPerPage]);

  const totalPages = Math.ceil((auditorias?.length || 0) / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <StatStrip
        loading={isLoading}
        items={[
          { key: 'total', label: t("governancaComp.auditorias.statTotal"), value: auditorias?.length || 0, drillDown: 'auditorias' },
          { key: 'em_andamento', label: t("governancaComp.auditorias.statEmAndamento"), value: auditorias?.filter(a => a.status === 'em_andamento' || a.status === 'em_execucao').length || 0, drillDown: 'auditorias' },
          { key: 'controles', label: t("governancaComp.auditorias.statControles"), value: `${totalConcluidos}/${totalItens}`, drillDown: 'auditorias' },
          { key: 'pendentes', label: t("governancaComp.auditorias.statPendentes"), value: auditorias?.filter(a => a.status === 'planejamento').length || 0, tone: 'warning', drillDown: 'auditorias' },
        ]}
      />

      {actionsSlot && createPortal(
        <>
          <ActionsMenu>
            <ActionsMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("layout.moreActions")} title={t("layout.moreActions")}>
                <IconMore className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </ActionsMenuTrigger>
            <ActionsMenuContent align="end" className="w-56">
              <ActionsMenuItem onClick={handleExportCSV} disabled={!auditorias || auditorias.length === 0}>
                <IconDownload className="mr-2 h-4 w-4" strokeWidth={1.5} />
                {t("governancaComp.auditorias.buttonExportar")}
              </ActionsMenuItem>
            </ActionsMenuContent>
          </ActionsMenu>
          <Button size="sm" onClick={() => setShowAuditoriaDialog(true)}>
            <IconAdd className="h-4 w-4 mr-2" />
            {t("governancaComp.auditorias.buttonNova")}
          </Button>
        </>,
        actionsSlot
      )}

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 sm:p-6 pb-4">
            <ModuleToolbar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder={t("governancaComp.auditorias.searchPlaceholder")}
              filters={
                <>
                  <ToolbarField label={t("governancaComp.auditorias.filterStatus")}>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full min-w-[160px]">
                        <SelectValue placeholder={t("governancaComp.auditorias.filterStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">{t("governancaComp.auditorias.filterStatusAll")}</SelectItem>
                        <SelectItem value="planejamento">{t("governancaComp.auditorias.statusPlanejamento")}</SelectItem>
                        <SelectItem value="em_andamento">{t("governancaComp.auditorias.statusEmAndamento")}</SelectItem>
                        <SelectItem value="concluida">{t("governancaComp.auditorias.statusConcluida")}</SelectItem>
                        <SelectItem value="cancelada">{t("governancaComp.auditorias.statusCancelada")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </ToolbarField>
                  <ToolbarField label={t("governancaComp.auditorias.filterTipo")}>
                    <Select value={tipoFilter} onValueChange={setTipoFilter}>
                      <SelectTrigger className="w-full min-w-[160px]">
                        <SelectValue placeholder={t("governancaComp.auditorias.filterTipo")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">{t("governancaComp.auditorias.filterTipoAll")}</SelectItem>
                        <SelectItem value="interna">{t("governancaComp.auditorias.tipoInterna")}</SelectItem>
                        <SelectItem value="externa">{t("governancaComp.auditorias.tipoExterna")}</SelectItem>
                        <SelectItem value="compliance">{t("governancaComp.auditorias.tipoCompliance")}</SelectItem>
                        <SelectItem value="operacional">{t("governancaComp.auditorias.tipoOperacional")}</SelectItem>
                        <SelectItem value="ti">{t("governancaComp.auditorias.tipoTi")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </ToolbarField>
                </>
              }
            />
          </div>
          
          {isLoading ? (
            <div className="space-y-1 px-4 pb-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : !auditorias || auditorias.length === 0 ? (
            <EmptyState
              icon={<IconFile className="h-8 w-8" />}
              title={t("governancaComp.auditorias.emptyTitle")}
              description={t("governancaComp.auditorias.emptyDescription")}
              action={{
                label: t("governancaComp.auditorias.emptyAction"),
                onClick: () => {
                  setSelectedAuditoria(null);
                  setShowAuditoriaDialog(true);
                }
              }}
            />
          ) : (
            <>
              <div className="space-y-1 px-4 pb-4">
                {paginatedAuditorias.map((auditoria) => {
                  const counts = auditoriasCounts?.[auditoria.id] || { itens: 0, itensConcluidos: 0 };
                  const auditorResponsavel = usuarios?.find((u: any) => u.user_id === auditoria.auditor_responsavel);
                  
                  return (
                    <AuditoriaCardAccordion
                      key={auditoria.id}
                      auditoria={auditoria}
                      counts={counts}
                      onEdit={() => handleEdit(auditoria)}
                      onDelete={() => handleDelete(auditoria.id, auditoria.nome)}
                      onOpenControles={() => handleOpenControles(auditoria)}
                      auditorNome={auditorResponsavel?.nome}
                    />
                  );
                })}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {t("governancaComp.auditorias.showingRange", { from: ((currentPage - 1) * itemsPerPage) + 1, to: Math.min(currentPage * itemsPerPage, auditorias.length), total: auditorias.length })}
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {[...Array(totalPages)].map((_, index) => {
                        const pageNumber = index + 1;
                        
                        if (
                          pageNumber === 1 ||
                          pageNumber === totalPages ||
                          (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={pageNumber}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNumber)}
                                isActive={currentPage === pageNumber}
                                className="cursor-pointer"
                              >
                                {pageNumber}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (
                          pageNumber === currentPage - 2 ||
                          pageNumber === currentPage + 2
                        ) {
                          return (
                            <PaginationItem key={pageNumber}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      <AuditoriaDialog
        open={showAuditoriaDialog}
        onOpenChange={setShowAuditoriaDialog}
        auditoria={selectedAuditoria}
        onSuccess={() => {
          refetch();
          setShowAuditoriaDialog(false);
        }}
      />

      <ItensAuditoriaDialog
        open={showControlesDialog}
        onOpenChange={setShowControlesDialog}
        auditoriaId={selectedAuditoria?.id}
        auditoriaNome={selectedAuditoria?.nome}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t("governancaComp.auditorias.deleteTitle")}
        description={t("governancaComp.auditorias.deleteDescription", { nome: deleteConfirm.nome })}
        confirmText={t("governancaComp.auditorias.deleteConfirm")}
        cancelText={t("governancaComp.auditorias.deleteCancel")}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
