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
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatDateOnly } from '@/lib/date-utils';
import { Plus, ListTodo, Clock, CheckCircle2, AlertTriangle, XCircle, Pencil, Trash2, LayoutGrid, List, Target, ExternalLink, MoreHorizontal, Download } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
  pendente: { label: 'Pendente', variant: 'warning', icon: Clock },
  em_andamento: { label: 'Em Andamento', variant: 'info', icon: Target },
  concluido: { label: 'Concluído', variant: 'success', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', variant: 'secondary', icon: XCircle },
  atrasado: { label: 'Atrasado', variant: 'destructive', icon: AlertTriangle },
};

const prioridadeConfig: Record<string, { label: string; variant: any }> = {
  baixa: { label: 'Baixa', variant: 'secondary' },
  media: { label: 'Média', variant: 'default' },
  alta: { label: 'Alta', variant: 'warning' },
  critica: { label: 'Crítica', variant: 'destructive' },
};

const moduloLabels: Record<string, string> = {
  manual: 'Manual',
  riscos: 'Riscos',
  controles: 'Controles',
  frameworks: 'Frameworks',
  incidentes: 'Incidentes',
  auditorias: 'Auditorias',
  contratos: 'Contratos',
  documentos: 'Documentos',
  dados: 'Privacidade',
  'due-diligence': 'Due Diligence',
  denuncia: 'Denúncia',
  ativos: 'Ativos',
  'contas-privilegiadas': 'Contas Priv.',
};

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
  useFocusRow();
  const { user, profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<any>(null);
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
        toast.success('Plano de ação atualizado');
      } else {
        const { error } = await supabase.from('planos_acao').insert({
          ...data,
          empresa_id: empresaId,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success('Plano de ação criado');
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
      toast.error('Erro ao salvar plano de ação');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('planos_acao').delete().eq('id', deleteId).eq('empresa_id', empresaId);
      if (error) throw error;
      toast.success('Plano de ação excluído');
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
    } catch (error) {
      logger.error('Erro ao excluir plano', error);
      toast.error('Erro ao excluir plano de ação');
    } finally {
      setDeleteId(null);
    }
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
      label: 'Título',
      sortable: true,
      render: (_: any, item: any) => (
        <div className="max-w-xs">
          <p className="font-medium truncate">{item.titulo}</p>
          {item.registro_origem_titulo && (
            <p className="text-xs text-muted-foreground truncate">
              ↳ {moduloLabels[item.modulo_origem] || item.modulo_origem}: {item.registro_origem_titulo}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_: any, item: any) => {
        const cfg = statusConfig[item._displayStatus] || statusConfig.pendente;
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'prioridade',
      label: 'Prioridade',
      sortable: true,
      render: (val: string) => {
        const cfg = prioridadeConfig[val] || prioridadeConfig.media;
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'responsavel_id',
      label: 'Responsável',
      render: (_: any, item: any) => (
        <span className="text-sm">{item.profiles?.nome || '-'}</span>
      ),
    },
    {
      key: 'prazo',
      label: 'Prazo',
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
      label: 'Origem',
      render: (val: string, item: any) => (
        <Badge variant={item._isExternal ? 'default' : 'outline'} className="text-xs">
          {moduloLabels[val] || val || 'Manual'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
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
                <ExternalLink className="h-4 w-4 mr-2" />Abrir no módulo
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => { setEditingPlano(item); setDialogOpen(true); }}>
                  <Pencil className="h-4 w-4 mr-2" />Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />Excluir
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
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Planos de Ação' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              if (planos.length === 0) return;
              exportCSV(
                ['Titulo', 'Status', 'Prioridade', 'Modulo', 'Prazo', 'Criado em'],
                planos.map((p: any) => [
                  p.titulo || p.nome || '', p.status || '', p.prioridade || '',
                  p.modulo_origem || 'manual', p.prazo || '', p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : ''
                ]),
                'planos_acao'
              );
            }}>
              <Download className="h-4 w-4 mr-2" />CSV
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
              Nova Ação
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Total"
          value={stats.total}
          icon={<ListTodo />}
          variant="primary"
          drillDown="planos"
          showAccent
          segments={[
            { label: 'pendentes', value: stats.pendentes, tone: 'warning' },
            { label: 'em andamento', value: stats.emAndamento, tone: 'info' },
            { label: 'concluídos', value: stats.concluidos, tone: 'success' },
          ]}
          emptyHint="Crie planos de ação a partir de riscos ou auditorias."
        />
        <StatCard title="Pendentes" value={stats.pendentes} icon={<Clock />} variant="warning" drillDown="planos" />
        <StatCard title="Em Andamento" value={stats.emAndamento} icon={<Target />} variant="info" drillDown="planos" />
        <StatCard title="Concluídos" value={stats.concluidos} icon={<CheckCircle2 />} variant="success" />
        <StatCard title="Atrasados" value={stats.atrasados} icon={<AlertTriangle />} variant="destructive" drillDown="planos" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="meus">Meus Itens</TabsTrigger>
          {isAdmin && <TabsTrigger value="todos">Todos</TabsTrigger>}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {viewMode === 'lista' ? (
            <Card>
              <DataTable
                data={filteredPlanos}
                columns={columns}
                loading={isLoading}
                searchable
                searchPlaceholder="Buscar pendências..."
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
                    label: 'Status',
                    options: [
                      { value: 'todos', label: 'Todos os Status' },
                      { value: 'pendente', label: 'Pendente' },
                      { value: 'em_andamento', label: 'Em Andamento' },
                      { value: 'concluido', label: 'Concluído' },
                      { value: 'atrasado', label: 'Atrasado' },
                      { value: 'cancelado', label: 'Cancelado' },
                    ],
                    value: statusFilter,
                    onChange: setStatusFilter,
                  },
                  {
                    key: 'prioridade',
                    label: 'Prioridade',
                    options: [
                      { value: 'todos', label: 'Todas' },
                      { value: 'baixa', label: 'Baixa' },
                      { value: 'media', label: 'Média' },
                      { value: 'alta', label: 'Alta' },
                      { value: 'critica', label: 'Crítica' },
                    ],
                    value: prioridadeFilter,
                    onChange: setPrioridadeFilter,
                  },
                ]}
                emptyState={{
                  icon: <ListTodo className="h-12 w-12" />,
                  title: 'Nenhuma pendência encontrada',
                  description: activeTab === 'meus' ? 'Você não possui itens pendentes no momento' : 'Crie um novo plano de ação para começar',
                  action: { label: 'Nova Ação', onClick: () => { setEditingPlano(null); setDialogOpen(true); } },
                }}
              />
            </Card>
          ) : (
            /* Kanban View */
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {kanbanColumns.map((colStatus) => {
                const cfg = statusConfig[colStatus];
                const items = filteredPlanos.filter((p: any) => p._displayStatus === colStatus);
                return (
                  <div key={colStatus} className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      <span className="text-sm text-muted-foreground">({items.length})</span>
                    </div>
                    <div className="space-y-2 min-h-[200px]">
                      {items.map((item: any) => (
                        <Card
                          key={`${item.modulo_origem || 'plano'}-${item.id}`}
                          data-focus-id={item.id}
                          className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            if (item._isExternal) {
                              navigate(item._route);
                            } else {
                              setEditingPlano(item);
                              setDialogOpen(true);
                            }
                          }}
                        >
                          <p className="font-medium text-sm line-clamp-2">{item.titulo}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant={prioridadeConfig[item.prioridade]?.variant || 'default'} className="text-xs">
                              {prioridadeConfig[item.prioridade]?.label || item.prioridade}
                            </Badge>
                            <Badge variant={item._isExternal ? 'default' : 'outline'} className="text-xs">
                              {moduloLabels[item.modulo_origem] || item.modulo_origem || 'Manual'}
                            </Badge>
                          </div>
                          {item.prazo && (
                            <p className={`text-xs mt-2 ${item._displayStatus === 'atrasado' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              Prazo: {formatDateOnly(item.prazo)}
                            </p>
                          )}
                          {item.profiles?.nome && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.profiles.nome}
                            </p>
                          )}
                        </Card>
                      ))}
                      {items.length === 0 && (
                        <div className="text-center text-muted-foreground text-xs py-8 border-2 border-dashed rounded-lg">
                          Nenhuma ação
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
        title="Excluir Plano de Ação"
        description="Tem certeza que deseja excluir este plano de ação? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
