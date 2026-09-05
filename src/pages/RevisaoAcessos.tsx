import { compareReviewRows } from '@/lib/access-review-sort';
import { exportCSV, spreadsheetText } from '@/lib/csv-utils';
import { readAllPages } from '@/lib/read-all-pages';
import { useSearchParams } from 'react-router-dom';
import { QueryError } from '@/components/ui/query-error';
import { useListState } from '@/hooks/useListState';
import { useState, useEffect } from "react";
import { IconAdd, IconEdit, IconDelete, IconDownload, IconView, IconMore, IconUserCheck } from '@/components/icons';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatStrip } from "@/components/ui/stat-strip";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Column } from "@/components/ui/data-table";
import { useReviewStats } from "@/hooks/useReviewStats";
import { useReviewData } from "@/hooks/useReviewData";
import { useAuth } from "@/components/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveWorkflowStatusTone } from "@/lib/status-tone";
import { ReviewDialog } from "@/components/revisao-acessos/ReviewDialog";
import { ReviewItemsDialog } from "@/components/revisao-acessos/ReviewItemsDialog";
import { SistemaUsuariosList } from "@/components/revisao-acessos/SistemaUsuariosList";
import { formatDateOnly } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

export default function RevisaoAcessos() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const systemId = searchParams.get('sistema');
  const linkedId = searchParams.get('revisao');
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { data: stats, loading: statsLoading, isError: statsError, refetch: retryStats } = useReviewStats();
  const { deleteReview } = useReviewData();
  const { toast } = useToast();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useListState('searchTerm', "");
  const [statusFilter, setStatusFilter] = useListState<string>('statusFilter', "all");
  const [activeTab, setActiveTab] = useListState<string>('activeTab', 'ativas');
  const [historySearch, setHistorySearch] = useListState('historySearch', '');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: "asc" | "desc" } | null>(null);

  const {
    data: reviews = [],
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch,
  } = useQuery({
    queryKey: ['reviews', empresaId, statusFilter, systemId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      if (!empresaId) return [];

      const { data, error } = await readAllPages((from, to) => {
      let query = supabase
        .from("access_reviews")
        .select(`
          *,
          sistema:sistemas_privilegiados(nome_sistema),
          responsavel:responsavel_revisao(nome),
          creator:created_by(nome)
        `)
        .eq("empresa_id", empresaId);

      query = statusFilter === 'all'
        ? query.in('status', ['rascunho', 'em_andamento'])
        : query.eq('status', statusFilter);

      if (systemId) query = query.eq("sistema_id", systemId);
      return query.order("created_at", { ascending: false }).order("id").range(from, to).abortSignal(signal);
      }, signal);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar histórico (revisões concluídas ou canceladas)
  const {
    data: historico = [],
    isLoading: historicoLoading,
    isError: historyError,
    refetch: retryHistory,
  } = useQuery({
    queryKey: ['reviews-historico', empresaId, systemId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      if (!empresaId) return [];

      const { data, error } = await readAllPages((from, to) => {
      let query = supabase
        .from("access_reviews")
        .select(`
          *,
          sistema:sistemas_privilegiados(nome_sistema),
          responsavel:responsavel_revisao(nome)
        `)
        .eq("empresa_id", empresaId)
        .in("status", ["concluida", "cancelada"])
        .order("data_conclusao", { ascending: false });
      if (systemId) query = query.eq("sistema_id", systemId);
      return query.order("id").range(from, to).abortSignal(signal);
      }, signal);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: linkedReview, isError: linkedError, isSuccess: linkedReady, refetch: retryLinked } = useQuery({
    queryKey: ['review-origin', empresaId, linkedId],
    enabled: !!empresaId && !!linkedId,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('access_reviews').select('*')
        .eq('empresa_id', empresaId!).eq('id', linkedId!).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!linkedReview) return;
    setSelectedReview(linkedReview);
    setItemsDialogOpen(true);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('revisao');
      next.set('sistema', linkedReview.sistema_id);
      return next;
    }, { replace: true });
  }, [linkedReview, setSearchParams]);

  const clearSystem = () => setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('sistema'); return next; });

  useEffect(() => { setItemsDialogOpen(false); setReviewDialogOpen(false); setSelectedReview(null); setDeleteConfirm(null); }, [empresaId]);

  const handleEdit = (review: any) => {
    setSelectedReview(review);
    setReviewDialogOpen(true);
  };

  const handleViewItems = (review: any) => {
    setSelectedReview(review);
    setItemsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteReview(deleteConfirm);
    setDeleteConfirm(null);
    refetch();
  };

  const handleSort = (field: string) => {
    setSortConfig((current) => {
      if (current?.field === field) {
        return current.direction === "asc" ? { field, direction: "desc" } : null;
      }
      return { field, direction: "asc" };
    });
  };

  const getStatusBadge = (status: string) => {
    return (
      <StatusBadge {...resolveWorkflowStatusTone(status)}>
        {formatStatus(status)}
      </StatusBadge>
    );
  };

  const getVencimentoBadge = (dataLimite: string, status: string) => {
    if (status === 'concluida' || status === 'cancelada') {
      return formatDateOnly(dataLimite);
    }

    /*
      Só a data.

      Havia aqui um selo colado ao prazo — «Vence em 7d», «Vencida» — calculado
      a partir da data que está ao lado. Dizia o que a data já dizia, e num
      quadro em que quase todas as linhas o traziam deixava de se ler como
      alerta e passava a ler-se como enfeite.
    */
    return formatDateOnly(dataLimite);
  };

  const compareReviews = (a: any, b: any) => compareReviewRows(a, b, sortConfig);

  const filteredAndSortedReviews = reviews
    ?.filter((review) =>
      searchTerm
        ? review.nome_revisao.toLowerCase().includes(searchTerm.toLowerCase()) ||
          review.sistema?.nome_sistema.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    )
    .sort(compareReviews);

  const visibleHistory = historico.filter(item => [item.nome_revisao, item.sistema?.nome_sistema]
    .some(value => value?.toLocaleLowerCase().includes(historySearch.toLocaleLowerCase()))).sort(compareReviews);
  const exportRows = activeTab === 'historico' ? visibleHistory : filteredAndSortedReviews;
  const exportFailed = activeTab === 'historico' ? historyError || historicoLoading : reviewsError || reviewsLoading;

  const columns: Column<any>[] = [
    {
      key: "nome_revisao",
      label: t('sweepDenuncias.revisao.colNomeRevisao'),
      sortable: true,
    },
    {
      key: "sistema.nome_sistema",
      label: t('sweepDenuncias.revisao.colSistema'),
      sortable: true,
      render: (_value: any, review: any) => review.sistema?.nome_sistema || "-",
    },
    {
      key: "tipo_revisao",
      label: t('fin.comum.tipo'),
      sortable: true,
      render: (_value: any, review: any) => formatStatus(review.tipo_revisao),
    },
    {
      key: "responsavel.nome",
      label: t('fin.comum.responsavel'),
      sortable: true,
      render: (_value: any, review: any) => review.responsavel?.nome || "-",
    },
    {
      key: "data_limite",
      label: t('sweepDenuncias.revisao.colPrazo'),
      sortable: true,
      render: (_value: any, review: any) => getVencimentoBadge(review.data_limite, review.status),
    },
    {
      key: "progress",
      label: t('sweepDenuncias.revisao.colProgresso'),
      render: (_value: any, review: any) => `${review.contas_revisadas}/${review.total_contas}`,
    },
    {
      key: "status",
      label: t('sweepDenuncias.revisao.colStatus'),
      sortable: true,
      render: (_value: any, review: any) => getStatusBadge(review.status),
    },
    {
      key: "actions",
      label: t('fin.comum.acoes'),
      render: (_value: any, review: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewItems(review)}>
              <IconView className="h-4 w-4 mr-2" />
              {t('sweepDenuncias.revisao.actionVerItens')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEdit(review)}>
              <IconEdit className="h-4 w-4 mr-2" />
              {t('sweepDenuncias.revisao.actionEditar')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteConfirm(review.id)}
              className="text-destructive focus:text-destructive"
            >
              <IconDelete className="h-4 w-4 mr-2" />
              {t('sweepDenuncias.revisao.actionExcluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const historicoColumns: Column<any>[] = [
    {
      key: "nome_revisao",
      label: t('sweepDenuncias.revisao.colNomeRevisao'),
      sortable: true,
    },
    {
      key: "sistema.nome_sistema",
      label: t('sweepDenuncias.revisao.colSistema'),
      render: (_value: any, review: any) => review.sistema?.nome_sistema || "-",
    },
    {
      key: "responsavel.nome",
      label: t('fin.comum.responsavel'),
      render: (_value: any, review: any) => review.responsavel?.nome || "-",
    },
    {
      key: "data_conclusao",
      label: t('sweepDenuncias.revisao.colDataConclusao'),
      sortable: true,
      render: (_value: any, review: any) => review.data_conclusao ? formatDateOnly(review.data_conclusao) : "-",
    },
    {
      key: "contas_revisadas",
      label: t('sweepDenuncias.revisao.colContasRevisadas'),
      render: (_value: any, review: any) => `${review.contas_revisadas}/${review.total_contas}`,
    },
    {
      key: "contas_aprovadas",
      label: t('sweepDenuncias.revisao.colAprovadas'),
      render: (_value: any, review: any) => review.contas_aprovadas || 0,
    },
    {
      key: "contas_revogadas",
      label: t('sweepDenuncias.revisao.colRevogadas'),
      render: (_value: any, review: any) => review.contas_revogadas || 0,
    },
    {
      key: "status",
      label: t('sweepDenuncias.revisao.colStatus'),
      render: (_value: any, review: any) => getStatusBadge(review.status),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.revisaoAcessos.title')}
        description={t('modules.revisaoAcessos.description')}
        actions={
          <Button onClick={() => {
            setSelectedReview(null);
            setReviewDialogOpen(true);
          }}>
            <IconAdd className="mr-2 h-4 w-4" />
            {t('sweepDenuncias.revisao.novaRevisao')}
          </Button>
        }
        secondaryActions={[
          {
            label: t('sweepDenuncias.revisao.exportar'),
            icon: <IconDownload className="h-4 w-4" />,
            disabled: exportFailed || !exportRows.length || activeTab === 'usuarios',
            onClick: () => exportCSV(
              [t('sweepDenuncias.revisao.colNomeRevisao'), t('sweepDenuncias.revisao.colSistema'), t('fin.comum.responsavel'), t('sweepDenuncias.revisao.colPrazo'), t('sweepDenuncias.revisao.colStatus'), t('sweepDenuncias.revisao.colProgresso')],
              exportRows.map(item => [item.nome_revisao, item.sistema?.nome_sistema, item.responsavel?.nome, formatDateOnly(item.data_limite), formatStatus(item.status), item.contas_revisadas + '/' + item.total_contas].map(spreadsheetText)),
              'campanhas-revisao-acessos',
            ),
          },
        ]}
      />

      {statsError && <QueryError onRetry={() => void retryStats()} />}
      {linkedError && <QueryError onRetry={() => void retryLinked()} />}
      {linkedId && linkedReady && !linkedReview && <p role="status" className="text-sm text-muted-foreground">{t('experience.reviewUnavailable')}</p>}
      {systemId && <div className="flex items-center gap-3 text-sm text-muted-foreground"><span>{t('experience.systemFilter')}</span><Button variant="ghost" size="sm" onClick={() => setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('sistema'); return next; })}>{t('common.clear')}</Button></div>}
      <StatStrip
        loading={statsLoading}
        error={statsError}
        items={[
          { key: 'emAndamento', label: t('residuos.geral.emAndamento'), value: stats?.emAndamento || 0, drillDown: 'revisao_acessos' },
          { key: 'concluidas', label: t('fin.comum.concluidas'), value: stats?.concluidas || 0 },
          { key: 'vencidas', label: t('sweepDenuncias.revisao.cardVencidas'), value: stats?.vencidas || 0, tone: 'destructive', drillDown: 'revisao_acessos_vencidas' },
          { key: 'contasRevisadas', label: t('sweepDenuncias.revisao.cardContasRevisadas'), value: stats?.contasRevisadas || 0 },
        ]}
      />


      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ativas">{t('fin.revisao.ativas')}</TabsTrigger>
          <TabsTrigger value="historico">{t('fin.comum.historico')}</TabsTrigger>
          <TabsTrigger value="usuarios">{t('fin.revisao.usuariosSistemas')}</TabsTrigger>
        </TabsList>


        <TabsContent value="ativas" className="space-y-4">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                paginated
                pageSize={20}
                data={filteredAndSortedReviews}
                filtering={{ active: !!systemId, onClear: clearSystem }}
                columns={columns}
                onRowClick={(review) => handleViewItems(review)}
                loading={reviewsLoading}
                error={reviewsError}
                onRefresh={() => void refetch()}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder={t('fin.revisao.buscar')}
                filters={[
                  {
                    key: "status",
                    label: t('sweepDenuncias.revisao.colStatus'),
                    options: [
                      { value: "all", label: t('sweepDenuncias.revisao.filterTodos') },
                      { value: "rascunho", label: t('sweepDenuncias.revisao.filterRascunho') },
                      { value: "em_andamento", label: t('sweepDenuncias.revisao.filterEmAndamento') },

                    ],
                    value: statusFilter,
                    onChange: setStatusFilter,
                  },
                ]}
                sortField={sortConfig?.field}
                sortDirection={sortConfig?.direction}
                onSort={handleSort}
                emptyState={{
                  icon: <IconUserCheck className="h-8 w-8" />,
                  title: t('p3Kpis.revisaoAcessos.emptyTitle'),
                  description: t('experience.reviewFirstRun'),
                  action: {
                    label: t('p3Kpis.revisaoAcessos.emptyAction'),
                    onClick: () => {
                      setSelectedReview(null);
                      setReviewDialogOpen(true);
                    },
                  },
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                paginated
                pageSize={20}
                data={visibleHistory}
                searchValue={historySearch}
                onSearchChange={setHistorySearch}
                filtering={{ active: !!systemId, onClear: clearSystem }}
                columns={historicoColumns}
                sortField={sortConfig?.field}
                sortDirection={sortConfig?.direction}
                onSort={handleSort}
                loading={historicoLoading}
                error={historyError}
                onRefresh={() => void retryHistory()}
                searchPlaceholder={t('fin.revisao.buscarHistorico')}
                emptyState={{
                  title: t('fin.revisao.nenhumaConcluida'),
                  description: t('fin.revisao.historicoVazio')
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-6">
              <SistemaUsuariosList sistemaIdInicial={systemId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReviewDialog
        open={reviewDialogOpen}
        onClose={() => {
          setReviewDialogOpen(false);
          setSelectedReview(null);
        }}
        review={selectedReview}
        onSuccess={() => {
          refetch();
          setReviewDialogOpen(false);
          setSelectedReview(null);
        }}
      />

      <ReviewItemsDialog
        open={itemsDialogOpen}
        onClose={() => {
          setItemsDialogOpen(false);
          setSelectedReview(null);
        }}
        review={selectedReview}
        onSuccess={() => {
          refetch();
        }}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={t('fin.revisao.excluirTitle')}
        description={t('fin.revisao.excluirDesc')}
        variant="destructive"
      />
    </div>
  );
}
