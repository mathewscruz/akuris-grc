import { useState, useMemo } from 'react';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useFocusRow } from '@/hooks/useFocusRow';
import { exportCSV } from '@/lib/csv-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlanoAcaoDialog } from '@/components/planos-acao/PlanoAcaoDialog';
import { PlanosAcaoKanban, PLANO_STATUS_EDITAVEIS } from '@/components/planos-acao/PlanosAcaoKanban';
import { PlanoAcaoDetailDrawer } from '@/components/planos-acao/PlanoAcaoDetailDrawer';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatDateOnly } from '@/lib/date-utils';
import { Plus, ListTodo, Clock, CheckCircle2, AlertTriangle, XCircle, Pencil, Trash2, LayoutGrid, List, Target, ExternalLink, MoreHorizontal, Download } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

function buildStatusConfig(t: (key: string) => string): Record<string, { label: string; variant: any; icon: any }> {
  return {
    pendente: { label: t('planosAcao.statusPendente'), variant: 'warning', icon: Clock },
    em_andamento: { label: t('planosAcao.statusEmAndamento'), variant: 'info', icon: Target },
    concluido: { label: t('planosAcao.statusConcluido'), variant: 'success', icon: CheckCircle2 },
    cancelado: { label: t('planosAcao.statusCancelado'), variant: 'secondary', icon: XCircle },
    atrasado: { label: t('planosAcao.statusAtrasado'), variant: 'destructive', icon: AlertTriangle },
  };
}

function buildPrioridadeConfig(t: (key: string) => string): Record<string, { label: string; variant: any }> {
  return {
    baixa: { label: t('planosAcao.priorityBaixa'), variant: 'secondary' },
    media: { label: t('planosAcao.priorityMedia'), variant: 'default' },
    alta: { label: t('planosAcao.priorityAlta'), variant: 'warning' },
    critica: { label: t('planosAcao.priorityCritica'), variant: 'destructive' },
  };
}

function buildModuloLabels(t: (key: string) => string): Record<string, string> {
  return {
    manual: t('planosAcao.moduleManual'),
    riscos: t('planosAcao.moduleRiscos'),
    controles: t('planosAcao.moduleControles'),
    frameworks: t('planosAcao.moduleFrameworks'),
    incidentes: t('planosAcao.moduleIncidentes'),
    auditorias: t('planosAcao.moduleAuditorias'),
    contratos: t('planosAcao.moduleContratos'),
    documentos: t('planosAcao.moduleDocumentos'),
    dados: t('planosAcao.moduleDados'),
    'due-diligence': t('planosAcao.moduleDueDiligence'),
    denuncia: t('planosAcao.moduleDenuncia'),
    ativos: t('planosAcao.moduleAtivos'),
    'contas-privilegiadas': t('planosAcao.moduleContasPrivilegiadas'),
  };
}

// Map external module statuses to plano de acao statuses
function mapExternalStatus(modulo: string, status: string, prazo?: string | null): string {
  if (prazo) {
    const diff = differenceInDays(new Date(prazo), new Date());
    if (diff < 0) return 'atrasado';
  }

  if (modulo === 'controles') {
    if (status === 'ativo') return 'em_andamento';
    if (status === 'em_revisao') return 'pendente';
    return 'pendente';
  }
  if (modulo === 'auditorias') {
    if (status === 'em_andamento') return 'em_andamento';
    return 'pendente';
  }
  if (modulo === 'incidentes') {
    if (status === 'identificado') return 'pendente';
    if (['em_investigacao', 'em_tratamento'].includes(status)) return 'em_andamento';
    return 'pendente';
  }
  return 'pendente';
}

function getRouteForModule(modulo: string): string {
  if (modulo === 'controles') return '/governanca?tab=controles';
  if (modulo === 'auditorias') return '/governanca?tab=auditorias';
  if (modulo === 'incidentes') return '/incidentes';
  return '/planos-acao';
}

export default function PlanosAcao() {
  const { t } = useLanguage();
  const statusConfig = useMemo(() => buildStatusConfig(t), [t]);
  const prioridadeConfig = useMemo(() => buildPrioridadeConfig(t), [t]);
  const moduloLabels = useMemo(() => buildModuloLabels(t), [t]);
  useFocusRow();
  const { user, profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<any>(null);
  const [detailPlano, setDetailPlano] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [prioridadeFilter, setPrioridadeFilter] = useState('todos');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');
  const [activeTab, setActiveTab] = useState('meus');

  // Planos de ação nativos
  const { data: planos = [], isLoading } = useQuery({
    queryKey: ['planos-acao', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      // Nota: não há FK planos_acao.responsavel_id -> profiles, então o embed do PostgREST
      // falha (PGRST200) e derrubava a lista inteira. Resolvemos o responsável em query separada.
      const { data, error } = await supabase
        .from('planos_acao')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      const ids = [...new Set(rows.map((r: any) => r.responsavel_id).filter(Boolean))];
      let profMap: Record<string, { nome: string; foto_url: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, nome, foto_url')
          .in('user_id', ids);
        profMap = Object.fromEntries((profs || []).map((p: any) => [p.user_id, { nome: p.nome, foto_url: p.foto_url }]));
      }
      return rows.map((r: any) => ({ ...r, profiles: r.responsavel_id ? (profMap[r.responsavel_id] || null) : null }));
    },
    enabled: !!empresaId,
  });

  // Controles pendentes do usuário
  const { data: controlesExternos = [] } = useQuery({
    queryKey: ['planos-acao-controles', empresaId, user?.id],
    queryFn: async () => {
      if (!empresaId || !user?.id) return [];
      const { data, error } = await supabase
        .from('controles')
        .select('id, nome, status, criticidade, proxima_avaliacao, responsavel_id, created_at, profiles:responsavel_id(nome)')
        .eq('empresa_id', empresaId)
        .eq('responsavel_id', user.id)
        .in('status', ['ativo', 'em_revisao']);
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        titulo: c.nome,
        status: c.status,
        _displayStatus: mapExternalStatus('controles', c.status, c.proxima_avaliacao),
        prioridade: c.criticidade === 'critica' ? 'critica' : c.criticidade === 'alta' ? 'alta' : 'media',
        prazo: c.proxima_avaliacao,
        modulo_origem: 'controles',
        responsavel_id: c.responsavel_id,
        profiles: c.profiles,
        _isExternal: true,
        _route: getRouteForModule('controles'),
        registro_origem_titulo: null,
        observacoes: null,
        created_at: c.created_at,
      }));
    },
    enabled: !!empresaId && !!user?.id,
  });

  // Itens de auditoria pendentes do usuário
  const { data: auditoriasExternas = [] } = useQuery({
    queryKey: ['planos-acao-auditorias', empresaId, user?.id],
    queryFn: async () => {
      if (!empresaId || !user?.id) return [];
      const { data, error } = await supabase
        .from('auditoria_itens')
        .select('id, titulo, status, prioridade, prazo, responsavel_id, created_at, profiles:responsavel_id(nome), auditorias!inner(empresa_id)')
        .eq('auditorias.empresa_id', empresaId)
        .eq('responsavel_id', user.id)
        .not('status', 'in', '("concluido","cancelado","nao_aplicavel")');
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        titulo: a.titulo,
        status: a.status,
        _displayStatus: mapExternalStatus('auditorias', a.status, a.prazo),
        prioridade: a.prioridade || 'media',
        prazo: a.prazo,
        modulo_origem: 'auditorias',
        responsavel_id: a.responsavel_id,
        profiles: a.profiles,
        _isExternal: true,
        _route: getRouteForModule('auditorias'),
        registro_origem_titulo: null,
        observacoes: null,
        created_at: a.created_at,
      }));
    },
    enabled: !!empresaId && !!user?.id,
  });

  // Incidentes pendentes do usuário
  const { data: incidentesExternos = [] } = useQuery({
    queryKey: ['planos-acao-incidentes', empresaId, user?.id],
    queryFn: async () => {
      if (!empresaId || !user?.id) return [];
      const { data, error } = await supabase
        .from('incidentes')
        .select('id, titulo, status, criticidade, created_at, responsavel_tratamento')
        .eq('empresa_id', empresaId)
        .eq('responsavel_tratamento', user.id)
        .not('status', 'in', '("encerrado","cancelado")');
      if (error) throw error;
      return (data || []).map((i: any) => ({
        id: i.id,
        titulo: i.titulo,
        status: i.status,
        _displayStatus: mapExternalStatus('incidentes', i.status),
        prioridade: i.criticidade === 'critica' ? 'critica' : i.criticidade === 'alta' ? 'alta' : 'media',
        prazo: null,
        modulo_origem: 'incidentes',
        responsavel_id: i.responsavel_tratamento,
        profiles: null,
        _isExternal: true,
        _route: getRouteForModule('incidentes'),
        registro_origem_titulo: null,
        observacoes: null,
        created_at: i.created_at,
      }));
    },
    enabled: !!empresaId && !!user?.id,
  });

  // Auto-detect atrasados for native planos
  const processedPlanos = useMemo(() => {
    return planos.map((p: any) => {
      if (p.prazo && ['pendente', 'em_andamento'].includes(p.status)) {
        const diff = differenceInDays(new Date(p.prazo), new Date());
        if (diff < 0) return { ...p, _displayStatus: 'atrasado', _isExternal: false };
      }
      return { ...p, _displayStatus: p.status, _isExternal: false };
    });
  }, [planos]);

  // All external items combined
  const allExternalItems = useMemo(() => {
    return [...controlesExternos, ...auditoriasExternas, ...incidentesExternos];
  }, [controlesExternos, auditoriasExternas, incidentesExternos]);

  // Items for "Meus Itens" tab: user's planos + all external
  const meusItens = useMemo(() => {
    const meusPlanos = processedPlanos.filter(
      (p: any) => p.responsavel_id === user?.id || p.created_by === user?.id
    );
    return [...meusPlanos, ...allExternalItems];
  }, [processedPlanos, allExternalItems, user?.id]);

  // Stats based on active tab data
  const currentData = activeTab === 'meus' ? meusItens : processedPlanos;

  const stats = useMemo(() => {
    const total = currentData.length;
    const pendentes = currentData.filter((p: any) => p._displayStatus === 'pendente').length;
    const emAndamento = currentData.filter((p: any) => p._displayStatus === 'em_andamento').length;
    const concluidos = currentData.filter((p: any) => p._displayStatus === 'concluido').length;
    const atrasados = currentData.filter((p: any) => p._displayStatus === 'atrasado').length;
    return { total, pendentes, emAndamento, concluidos, atrasados };
  }, [currentData]);

  // Filter + search
  const filteredPlanos = useMemo(() => {
    let result = currentData;

    if (statusFilter !== 'todos') {
      result = result.filter((p: any) => p._displayStatus === statusFilter);
    }
    if (prioridadeFilter !== 'todos') {
      result = result.filter((p: any) => p.prioridade === prioridadeFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p: any) =>
        p.titulo?.toLowerCase().includes(s) ||
        p.descricao?.toLowerCase().includes(s) ||
        p.registro_origem_titulo?.toLowerCase().includes(s)
      );
    }

    result.sort((a: any, b: any) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [currentData, statusFilter, prioridadeFilter, search, sortField, sortDirection]);

  const { notify } = useIntegrationNotify();

  const handleSave = async (data: any) => {
    if (!empresaId || !user?.id) return;
    setSaving(true);
    try {
      if (editingPlano) {
        const { error } = await supabase.from('planos_acao').update(data).eq('id', editingPlano.id);
        if (error) throw error;
        toast.success(t('planosAcao.toastUpdated'));
      } else {
        const { error } = await supabase.from('planos_acao').insert({
          ...data,
          empresa_id: empresaId,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success(t('planosAcao.toastCreated'));
        notify('plano_acao_criado', {
          titulo: `Novo plano de ação: ${data.titulo}`,
          descricao: data.descricao,
          link: `${window.location.origin}/planos-acao`,
          dados: { prioridade: data.prioridade, modulo_origem: data.modulo_origem },
          gravidade: data.prioridade === 'critica' ? 'critica' : data.prioridade === 'alta' ? 'alta' : 'media',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      setDialogOpen(false);
      setEditingPlano(null);
    } catch (error) {
      logger.error('Erro ao salvar plano de ação', error);
      toast.error(t('planosAcao.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('planos_acao').delete().eq('id', deleteId).eq('empresa_id', empresaId);
      if (error) throw error;
      toast.success(t('planosAcao.toastDeleted'));
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
    } catch (error) {
      logger.error('Erro ao excluir plano', error);
      toast.error(t('planosAcao.toastDeleteError'));
    } finally {
      setDeleteId(null);
    }
  };

  // Mudança rápida de estado com atualização otimista e reversão em caso de falha.
  const handleStatusChange = async (item: any, novoStatus: string) => {
    if (!empresaId || item?._isExternal || !item?.id) return;
    if (!(PLANO_STATUS_EDITAVEIS as readonly string[]).includes(novoStatus)) return;
    if (item.status === novoStatus) return;

    const key = ['planos-acao', empresaId];
    const anterior = queryClient.getQueryData<any[]>(key);
    const patch = {
      status: novoStatus,
      data_conclusao: novoStatus === 'concluido' ? new Date().toISOString().slice(0, 10) : null,
    };

    queryClient.setQueryData<any[]>(key, (old) =>
      (old || []).map((p: any) => (p.id === item.id ? { ...p, ...patch } : p)),
    );
    setDetailPlano((d: any) => (d && d.id === item.id ? { ...d, ...patch, _displayStatus: novoStatus } : d));

    const { error } = await supabase
      .from('planos_acao')
      .update(patch)
      .eq('id', item.id)
      .eq('empresa_id', empresaId);

    if (error) {
      logger.error('Erro ao atualizar status do plano de ação', error);
      queryClient.setQueryData(key, anterior);
      setDetailPlano((d: any) => (d && d.id === item.id ? { ...d, status: item.status, _displayStatus: item._displayStatus } : d));
      toast.error(t('planosAcao.statusUpdateError'));
      return;
    }

    toast.success(t('planosAcao.statusUpdated'));
    queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'titulo',
      label: t('planosAcao.columnTitle'),
      sortable: true,
      render: (_: any, item: any) => (
        <div className="min-w-[220px] max-w-[420px]">
          <p className="font-medium whitespace-normal break-words line-clamp-2">{item.titulo}</p>
          {item.registro_origem_titulo && (
            <p className="text-xs text-muted-foreground whitespace-normal break-words line-clamp-2">
              ↳ {moduloLabels[item.modulo_origem] || item.modulo_origem}: {item.registro_origem_titulo}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: t('planosAcao.columnStatus'),
      sortable: true,
      render: (_: any, item: any) => {
        const cfg = statusConfig[item._displayStatus] || statusConfig.pendente;
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'prioridade',
      label: t('planosAcao.columnPriority'),
      sortable: true,
      render: (val: string) => {
        const cfg = prioridadeConfig[val] || prioridadeConfig.media;
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'responsavel_id',
      label: t('planosAcao.columnResponsible'),
      render: (_: any, item: any) => (
        <span className="text-sm">{item.profiles?.nome || '-'}</span>
      ),
    },
    {
      key: 'prazo',
      label: t('planosAcao.columnDeadline'),
      sortable: true,
      render: (val: string, item: any) => {
        if (!val) return <span className="text-muted-foreground">-</span>;
        const isOverdue = item._displayStatus === 'atrasado';
        return (
          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
            {formatDateOnly(val)}
          </span>
        );
      },
    },
    {
      key: 'modulo_origem',
      label: t('planosAcao.columnOrigin'),
      render: (val: string, item: any) => (
        <Badge variant={item._isExternal ? 'default' : 'outline'} className="text-xs">
          {moduloLabels[val] || val || 'Manual'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('planosAcao.columnActions'),
      className: 'w-16',
      render: (_: any, item: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item._isExternal ? (
              <DropdownMenuItem onClick={() => navigate(item._route)}>
                <ExternalLink className="h-4 w-4 mr-2" />{t('planosAcao.actionOpenInModule')}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => { setEditingPlano(item); setDialogOpen(true); }}>
                  <Pencil className="h-4 w-4 mr-2" />{t('planosAcao.actionEdit')}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />{t('planosAcao.actionDelete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const kanbanColumns = ['pendente', 'em_andamento', 'concluido', 'atrasado', 'cancelado'];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.planosAcao.title')}
        description={t('modules.planosAcao.description')}
        breadcrumbs={[{ label: t('planosAcao.breadcrumbDashboard'), href: '/dashboard' }, { label: t('planosAcao.breadcrumbTitle') }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              if (planos.length === 0) return;
              exportCSV(
                [t('planosAcao.csvHeaderTitle'), t('planosAcao.csvHeaderStatus'), t('planosAcao.csvHeaderPriority'), t('planosAcao.csvHeaderModule'), t('planosAcao.csvHeaderDeadline'), t('planosAcao.csvHeaderCreatedAt')],
                planos.map((p: any) => [
                  p.titulo || p.nome || '', p.status || '', p.prioridade || '',
                  p.modulo_origem || 'manual', p.prazo || '', p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : ''
                ]),
                'planos_acao'
              );
            }}>
              <Download className="h-4 w-4 mr-2" />{t('planosAcao.csv')}
            </Button>
            <div className="flex border rounded-md overflow-hidden">
              <Button variant={viewMode === 'lista' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('lista')} className="rounded-none">
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="rounded-none">
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => { setEditingPlano(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('planosAcao.newAction')}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title={t('planosAcao.statTotal')}
          value={stats.total}
          icon={<ListTodo />}
          variant="primary"
          drillDown="planos"
          showAccent
          segments={[
            { label: t('planosAcao.segmentPending'), value: stats.pendentes, tone: 'warning' },
            { label: t('planosAcao.segmentInProgress'), value: stats.emAndamento, tone: 'info' },
            { label: t('planosAcao.segmentCompleted'), value: stats.concluidos, tone: 'success' },
          ]}
          emptyHint={t('planosAcao.emptyHintTotal')}
        />
        <StatCard title={t('planosAcao.statPending')} value={stats.pendentes} icon={<Clock />} variant="warning" drillDown="planos" />
        <StatCard title={t('planosAcao.statInProgress')} value={stats.emAndamento} icon={<Target />} variant="info" drillDown="planos" />
        <StatCard title={t('planosAcao.statCompleted')} value={stats.concluidos} icon={<CheckCircle2 />} variant="success" />
        <StatCard title={t('planosAcao.statOverdue')} value={stats.atrasados} icon={<AlertTriangle />} variant="destructive" drillDown="planos" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="meus">{t('planosAcao.tabMyItems')}</TabsTrigger>
          {isAdmin && <TabsTrigger value="todos">{t('planosAcao.tabAll')}</TabsTrigger>}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {viewMode === 'lista' ? (
            <Card>
              <DataTable
                data={filteredPlanos}
                columns={columns}
                loading={isLoading}
                searchable
                searchPlaceholder={t('planosAcao.searchPlaceholder')}
                searchValue={search}
                onSearchChange={setSearch}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                paginated
                pageSize={20}
                filters={[
                  {
                    key: 'status',
                    label: t('planosAcao.filterStatusLabel'),
                    options: [
                      { value: 'todos', label: t('planosAcao.filterStatusAll') },
                      { value: 'pendente', label: t('planosAcao.statusPendente') },
                      { value: 'em_andamento', label: t('planosAcao.statusEmAndamento') },
                      { value: 'concluido', label: t('planosAcao.statusConcluido') },
                      { value: 'atrasado', label: t('planosAcao.statusAtrasado') },
                      { value: 'cancelado', label: t('planosAcao.statusCancelado') },
                    ],
                    value: statusFilter,
                    onChange: setStatusFilter,
                  },
                  {
                    key: 'prioridade',
                    label: t('planosAcao.filterPriorityLabel'),
                    options: [
                      { value: 'todos', label: t('planosAcao.filterPriorityAll') },
                      { value: 'baixa', label: t('planosAcao.priorityBaixa') },
                      { value: 'media', label: t('planosAcao.priorityMedia') },
                      { value: 'alta', label: t('planosAcao.priorityAlta') },
                      { value: 'critica', label: t('planosAcao.priorityCritica') },
                    ],
                    value: prioridadeFilter,
                    onChange: setPrioridadeFilter,
                  },
                ]}
                emptyState={{
                  icon: <ListTodo className="h-12 w-12" />,
                  title: t('planosAcao.emptyTitle'),
                  description: activeTab === 'meus' ? t('planosAcao.emptyDescriptionMyItems') : t('planosAcao.emptyDescriptionAll'),
                  action: { label: t('planosAcao.newAction'), onClick: () => { setEditingPlano(null); setDialogOpen(true); } },
                }}
              />
            </Card>
          ) : (
            <PlanosAcaoKanban
              colunas={kanbanColumns}
              items={filteredPlanos}
              onOpen={(item) => setDetailPlano(item)}
              onStatusChange={handleStatusChange}
              statusConfig={statusConfig}
              prioridadeConfig={prioridadeConfig}
              moduloLabels={moduloLabels}
            />
          )}
        </TabsContent>
      </Tabs>

      <PlanoAcaoDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingPlano(null); }}
        onSave={handleSave}
        plano={editingPlano}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('planosAcao.deleteDialogTitle')}
        description={t('planosAcao.deleteDialogDescription')}
        confirmText={t('planosAcao.deleteDialogConfirm')}
        cancelText={t('planosAcao.deleteDialogCancel')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
