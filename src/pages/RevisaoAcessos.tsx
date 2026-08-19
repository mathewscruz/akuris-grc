import { useState } from "react";
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
import { resolveRevisaoTone, resolveWorkflowStatusTone } from "@/lib/status-tone";
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
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { data: stats, loading: statsLoading } = useReviewStats();
  const { deleteReview } = useReviewData();
  const { toast } = useToast();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: "asc" | "desc" } | null>(null);

  const {
    data: reviews = [],
    isLoading: reviewsLoading,
    refetch,
  } = useQuery({
    queryKey: ['reviews', empresaId, statusFilter],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!empresaId) return [];

      let query = supabase
        .from("access_reviews")
        .select(`
          *,
          sistema:sistemas_privilegiados(nome_sistema),
          responsavel:responsavel_revisao(nome),
          creator:created_by(nome)
        `)
        .eq("empresa_id", empresaId);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar histórico (revisões concluídas ou canceladas)
  const {
    data: historico = [],
    isLoading: historicoLoading,
  } = useQuery({
    queryKey: ['reviews-historico', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("access_reviews")
        .select(`
          *,
          sistema:sistemas_privilegiados(nome_sistema),
          responsavel:responsavel_revisao(nome)
        `)
        .eq("empresa_id", empresaId)
        .in("status", ["concluida", "cancelada"])
        .order("data_conclusao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

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

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(dataLimite + 'T00:00:00');
    const diffDays = Math.ceil((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <div className="flex items-center gap-2">
          <span>{formatDateOnly(dataLimite)}</span>
          <StatusBadge {...resolveRevisaoTone(-1)}>{t('sweepDenuncias.revisao.badgeVencida')}</StatusBadge>
        </div>
      );
    } else if (diffDays <= 7) {
      return (
        <div className="flex items-center gap-2">
          <span>{formatDateOnly(dataLimite)}</span>
          <StatusBadge {...resolveRevisaoTone(diffDays)}>{t('sweepDenuncias.revisao.badgeVenceEm', { dias: diffDays })}</StatusBadge>
        </div>
      );
    }

    return formatDateOnly(dataLimite);
  };

  const filteredAndSortedReviews = reviews
    ?.filter((review) =>
      searchTerm
        ? review.nome_revisao.toLowerCase().includes(searchTerm.toLowerCase()) ||
          review.sistema?.nome_sistema.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    )
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      return aVal > bVal ? direction : -direction;
    });

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
            <Button variant="ghost" size="icon" className="h-8 w-8">
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
            onClick: () => {},
          },
        ]}
      />

      <Tabs defaultValue="ativas">
        <TabsList>
          <TabsTrigger value="ativas">{t('fin.revisao.ativas')}</TabsTrigger>
          <TabsTrigger value="historico">{t('fin.comum.historico')}</TabsTrigger>
          <TabsTrigger value="usuarios">{t('fin.revisao.usuariosSistemas')}</TabsTrigger>
        </TabsList>

      <StatStrip
        loading={statsLoading}
        items={[
          { key: 'emAndamento', label: t('residuos.geral.emAndamento'), value: stats?.emAndamento || 0, drillDown: 'revisao_acessos' },
          { key: 'concluidas', label: t('fin.comum.concluidas'), value: stats?.concluidas || 0 },
          { key: 'vencidas', label: t('sweepDenuncias.revisao.cardVencidas'), value: stats?.vencidas || 0, tone: 'destructive', drillDown: 'revisao_acessos' },
          { key: 'contasRevisadas', label: t('sweepDenuncias.revisao.cardContasRevisadas'), value: stats?.contasRevisadas || 0 },
        ]}
      />

        <TabsContent value="ativas" className="space-y-4">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={filteredAndSortedReviews || []}
                columns={columns}
                onRowClick={(review) => handleViewItems(review)}
                loading={reviewsLoading}
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
                      { value: "concluida", label: t('fin.comum.concluidaF') },
                      { value: "cancelada", label: t('sweepDenuncias.revisao.filterCancelada') },
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
                  description: t('p3Kpis.revisaoAcessos.emptyDescription'),
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
                data={historico || []}
                columns={historicoColumns}
                loading={historicoLoading}
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
              <SistemaUsuariosList />
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
