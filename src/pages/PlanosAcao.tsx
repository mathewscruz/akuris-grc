import { useState, useMemo, useEffect } from 'react';
import { IconAdd, IconEdit, IconDelete, IconDownload, IconExternal, IconMore, IconSuccess, IconWarning, IconError, IconTime, IconChecklist, IconGrid, IconList, IconTarget } from '@/components/icons';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFocusRow } from '@/hooks/useFocusRow';
import { exportCSV } from '@/lib/csv-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';
import { ModuleToolbar, ToolbarField } from '@/components/ui/module-toolbar';
import { DataTable, Column } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlanoAcaoDialog } from '@/components/planos-acao/PlanoAcaoDialog';
import { PlanosAcaoKanban, PLANO_STATUS_EDITAVEIS } from '@/components/planos-acao/PlanosAcaoKanban';
import { PlanoAcaoDetailDrawer } from '@/components/planos-acao/PlanoAcaoDetailDrawer';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { formatDateOnly, intlLocale, parseDataLocal, formatarDiaParaDB} from '@/lib/date-utils';
import { differenceInDays } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';


import { severidadeDeFaixas } from '@/lib/metrics/riscos';
import { compararEscala } from '@/lib/ordem-de-escala';

/**
 * Severidade (escala de risco) → prioridade (escala de execução).
 *
 * São dois vocabulários diferentes e é bom que sejam: um controlo crítico não
 * é uma tarefa "crítica", é uma tarefa urgente. O que não pode é a tradução
 * acontecer por coincidência de grafia — era `criticidade === 'critica'`, e
 * desde a normalização isso nunca acontece: tudo saía como prioridade média.
 */
const prioridadeDaSeveridade = (v?: string | null): string =>
  ({ critico: 'critica', alto: 'alta', medio: 'media', baixo: 'baixa' } as Record<string, string>)[
    severidadeDeFaixas(v)
  ] ?? 'media';
function buildStatusConfig(t: (key: string) => string): Record<string, { label: string; tone: any; icon: any }> {
  return {
    pendente: { label: t('planosAcao.statusPendente'), tone: 'warning', icon: IconTime },
    em_andamento: { label: t('planosAcao.statusEmAndamento'), tone: 'info', icon: IconTarget },
    concluido: { label: t('planosAcao.statusConcluido'), tone: 'success', icon: IconSuccess },
    cancelado: { label: t('planosAcao.statusCancelado'), tone: 'neutral', icon: IconError },
    atrasado: { label: t('planosAcao.statusAtrasado'), tone: 'destructive', icon: IconWarning },
  };
}

function buildPrioridadeConfig(t: (key: string) => string): Record<string, { label: string; tone: any; mark: string }> {
  return {
    baixa: { label: t('planosAcao.priorityBaixa'), tone: 'success', mark: 'B' },
    media: { label: t('planosAcao.priorityMedia'), tone: 'warning', mark: 'M' },
    alta: { label: t('planosAcao.priorityAlta'), tone: 'orange', mark: 'A' },
    critica: { label: t('planosAcao.priorityCritica'), tone: 'destructive', mark: 'C' },
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
    const diff = differenceInDays(parseDataLocal(prazo), new Date());
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
  if (modulo === 'controles') return '/governanca/controles';
  if (modulo === 'auditorias') return '/governanca/auditorias';
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
  // A fila abre pela urgência real: prazos mais próximos (inclusive vencidos)
  // primeiro. Itens sem prazo ficam no fim, em vez de disputar o topo com o
  // trabalho que já tem compromisso assumido.
  const [sortField, setSortField] = useState('prazo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');
  // Administradores chegam na visão consolidada que o dashboard resume.
  // Usuários comuns continuam começando pelo que está atribuído a eles.
  const [activeTab, setActiveTab] = useState(() => isAdmin ? 'todos' : 'meus');

  // Planos de ação nativos
  /*
    `?plano=<id>` abre o plano directamente.

    Quem vem da Remediação do Gap Analysis clicou num plano concreto e caía
    aqui na lista inteira, para o ter de encontrar outra vez. O parâmetro é
    consumido uma vez e limpo do URL, para que voltar atrás não reabra a
    gaveta.
  */
  const [searchParams, setSearchParams] = useSearchParams();
  const planoNoUrl = searchParams.get('plano');

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

  useEffect(() => {
    if (!planoNoUrl || planos.length === 0) return;
    const alvo = planos.find((p: { id: string }) => p.id === planoNoUrl);
    if (alvo) setDetailPlano(alvo);
    searchParams.delete('plano');
    setSearchParams(searchParams, { replace: true });
  }, [planoNoUrl, planos, searchParams, setSearchParams]);

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
        prioridade: prioridadeDaSeveridade(c.criticidade),
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
        prioridade: prioridadeDaSeveridade(i.criticidade),
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
        const diff = differenceInDays(parseDataLocal(p.prazo), new Date());
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
      const aRaw = a[sortField];
      const bRaw = b[sortField];
      if (sortField === 'prazo') {
        const aMissing = !aRaw;
        const bMissing = !bRaw;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
      }
      const aVal = aRaw || '';
      const bVal = bRaw || '';
      /* Critíco > Alto > Médio > Baixo. O alfabeto põe Alto antes de Baixo
         antes de Crítico — ao contrário do que a coluna promete. */
      const escala = compararEscala(aVal, bVal);
      if (escala !== null) return sortDirection === 'asc' ? escala : -escala;

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
    const targetId = deleteId;
    try {
      // Guardamos a linha exata antes da exclusão para que "Desfazer" seja uma
      // recuperação real, inclusive após o refetch da lista.
      const { data: snapshot } = await supabase
        .from('planos_acao')
        .select('*')
        .eq('id', targetId)
        .eq('empresa_id', empresaId)
        .maybeSingle();
      const { error } = await supabase.from('planos_acao').delete().eq('id', targetId).eq('empresa_id', empresaId);
      if (error) throw error;
      toast.success(t('planosAcao.toastDeleted'), snapshot ? {
        duration: 6000,
        action: {
          label: t('common.undo'),
          onClick: async () => {
            const { error: restoreError } = await supabase.from('planos_acao').insert(snapshot);
            if (restoreError) {
              logger.error('Erro ao restaurar plano', restoreError);
              toast.error(t('toasts.genericError'));
              return;
            }
            queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
          },
        },
      } : undefined);
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
      data_conclusao: novoStatus === 'concluido' ? formatarDiaParaDB(new Date()) : null,
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
      toast.error(t('planosAcao.statusUpdateError'), {
        action: {
          label: t('common.tryAgain'),
          onClick: () => void handleStatusChange(item, novoStatus),
        },
      });
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
          <button
            type="button"
            className="min-h-10 text-left font-medium whitespace-normal break-words line-clamp-2 text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={(event) => { event.stopPropagation(); setDetailPlano(item); }}
          >
            {item.titulo}
          </button>
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
      mobilePriority: 0,
      label: t('planosAcao.columnStatus'),
      sortable: true,
      render: (_: any, item: any) => {
        const cfg = statusConfig[item._displayStatus] || statusConfig.pendente;
        return <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'prioridade',
      mobilePriority: 1,
      label: t('planosAcao.columnPriority'),
      sortable: true,
      render: (val: string) => {
        const cfg = prioridadeConfig[val] || prioridadeConfig.media;
        return <StatusBadge tone={cfg.tone} mark={cfg.mark}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'responsavel_id',
      mobilePriority: 3,
      label: t('planosAcao.columnResponsible'),
      render: (_: any, item: any) => (
        <span className="text-sm">{item.profiles?.nome || '-'}</span>
      ),
    },
    {
      key: 'prazo',
      mobilePriority: 2,
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
      mobilePriority: 4,
      label: t('planosAcao.columnOrigin'),
      render: (val: string, item: any) => (
        <Chip family="category">
          {moduloLabels[val] || val || 'Manual'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      label: t('planosAcao.columnActions'),
      className: 'w-16',
      render: (_: any, item: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setDetailPlano(item)}>
              <IconExternal className="h-4 w-4 mr-2" />{t('planosAcao.actionOpenDetail')}
            </DropdownMenuItem>
            {item._isExternal ? (
              <DropdownMenuItem onClick={() => navigate(item._route)}>
                <IconExternal className="h-4 w-4 mr-2" />{t('planosAcao.actionOpenInModule')}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t('planosAcao.quickStatusPrefix')}
                </DropdownMenuLabel>
                {PLANO_STATUS_EDITAVEIS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleStatusChange(item, s)}
                    className={item.status === s ? 'font-semibold' : ''}
                  >
                    {statusConfig[s]?.label}
                    {item.status === s && <IconSuccess className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setEditingPlano(item); setDialogOpen(true); }}>
                  <IconEdit className="h-4 w-4 mr-2" />{t('planosAcao.actionEdit')}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                  <IconDelete className="h-4 w-4 mr-2" />{t('planosAcao.actionDelete')}
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
        actions={
          <Button onClick={() => { setEditingPlano(null); setDialogOpen(true); }}>
            <IconAdd className="h-4 w-4 mr-2" />
            {t('planosAcao.newAction')}
          </Button>
        }
        secondaryActions={[
          {
            label: t('planosAcao.csv'),
            icon: <IconDownload className="h-4 w-4" />,
            /*
               Exportar o que está no ecrã, escrito como está no ecrã.

               Medido: com o filtro em «Crítica» a tabela mostrava 1 linha e o
               ficheiro trazia 6, de todas as prioridades. Quem filtra e exporta
               age sobre a lista que exportou — e recebia outra.

               E o conteúdo era o da base, não o da tabela: «em_andamento»,
               «media», «frameworks», onde o ecrã escreve «Em Andamento»,
               «Média», «Frameworks». As duas datas vinham em formatos
               diferentes na mesma linha: `prazo` cru da base (2026-06-25) ao
               lado de `created_at` já formatado (26/05/2026). Os rótulos já
               existiam na página; o CSV era o único sítio que não os usava.
            */
            onClick: () => {
              if (filteredPlanos.length === 0) return;
              exportCSV(
                [t('planosAcao.csvHeaderTitle'), t('planosAcao.csvHeaderStatus'), t('planosAcao.csvHeaderPriority'), t('planosAcao.csvHeaderModule'), t('planosAcao.csvHeaderDeadline'), t('planosAcao.csvHeaderCreatedAt')],
                filteredPlanos.map((p: any) => [
                  p.titulo || p.nome || '',
                  statusConfig[p._displayStatus ?? p.status]?.label || p.status || '',
                  prioridadeConfig[p.prioridade]?.label || p.prioridade || '',
                  moduloLabels[p.modulo_origem] || p.modulo_origem || moduloLabels.manual || 'manual',
                  p.prazo ? formatDateOnly(p.prazo) : '',
                  p.created_at ? formatDateOnly(p.created_at) : '',
                ]),
                'planos_acao'
              );
            },
          },
        ]}
      />

      {/* Stats — todos os itens abrem a mesma vista filtrada (lista + filtro de estado). */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="meus">{t('planosAcao.tabMyItems')}</TabsTrigger>
          {isAdmin && <TabsTrigger value="todos">{t('planosAcao.tabAll')}</TabsTrigger>}
        </TabsList>

      <StatStrip
        items={[
          { key: 'total', label: t('planosAcao.statTotal'), value: stats.total, onClick: () => { setStatusFilter('todos'); setViewMode('lista'); } },
          { key: 'pendentes', label: t('planosAcao.statPending'), value: stats.pendentes, tone: 'warning', onClick: () => { setStatusFilter('pendente'); setViewMode('lista'); } },
          { key: 'emAndamento', label: t('planosAcao.statInProgress'), value: stats.emAndamento, onClick: () => { setStatusFilter('em_andamento'); setViewMode('lista'); } },
          { key: 'concluidos', label: t('planosAcao.statCompleted'), value: stats.concluidos, onClick: () => { setStatusFilter('concluido'); setViewMode('lista'); } },
          { key: 'atrasados', label: t('planosAcao.statOverdue'), value: stats.atrasados, tone: 'destructive', onClick: () => { setStatusFilter('atrasado'); setViewMode('lista'); } },
        ]}
      />

      {/* Tabs */}

        <TabsContent value={activeTab} className="space-y-4">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b border-border/60 p-4">
          <ModuleToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('planosAcao.searchPlaceholder')}
            filters={
              <>
                <ToolbarField label={t('planosAcaoFiltros.statusLabel')}>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="planos-filtro-status" className="w-[200px]" title={t('planosAcaoFiltros.statusLabel')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">{t('planosAcao.filterStatusAll')}</SelectItem>
                      <SelectItem value="pendente">{t('planosAcao.statusPendente')}</SelectItem>
                      <SelectItem value="em_andamento">{t('planosAcao.statusEmAndamento')}</SelectItem>
                      <SelectItem value="concluido">{t('planosAcao.statusConcluido')}</SelectItem>
                      <SelectItem value="atrasado">{t('planosAcao.statusAtrasado')}</SelectItem>
                      <SelectItem value="cancelado">{t('planosAcao.statusCancelado')}</SelectItem>
                    </SelectContent>
                  </Select>
                </ToolbarField>
                <ToolbarField label={t('planosAcaoFiltros.priorityLabel')}>
                  <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                    <SelectTrigger id="planos-filtro-prioridade" className="w-[200px]" title={t('planosAcaoFiltros.priorityLabel')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">{t('planosAcao.filterPriorityAll')}</SelectItem>
                      <SelectItem value="baixa">{t('planosAcao.priorityBaixa')}</SelectItem>
                      <SelectItem value="media">{t('planosAcao.priorityMedia')}</SelectItem>
                      <SelectItem value="alta">{t('planosAcao.priorityAlta')}</SelectItem>
                      <SelectItem value="critica">{t('planosAcao.priorityCritica')}</SelectItem>
                    </SelectContent>
                  </Select>
                </ToolbarField>
              </>
            }
            viewSwitcher={
              <div
                role="group"
                aria-label={`${t('planosAcao.viewList')} / ${t('planosAcao.viewKanban')}`}
                className="inline-flex rounded-lg border border-border bg-muted/25 p-1"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={viewMode === 'lista'}
                  className={viewMode === 'lista' ? 'bg-card text-primary shadow-sm hover:bg-card' : 'text-muted-foreground'}
                  onClick={() => setViewMode('lista')}
                >
                  <IconList className="mr-1.5 h-4 w-4" />{t('planosAcao.viewList')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={viewMode === 'kanban'}
                  className={viewMode === 'kanban' ? 'bg-card text-primary shadow-sm hover:bg-card' : 'text-muted-foreground'}
                  onClick={() => setViewMode('kanban')}
                >
                  <IconGrid className="mr-1.5 h-4 w-4" />{t('planosAcao.viewKanban')}
                </Button>
              </div>
            }
          />
              </div>
          {viewMode === 'lista' ? (
              <DataTable
                data={filteredPlanos}
                columns={columns}
                // A página já tem a sua busca no `ModuleToolbar`; o `DataTable`
                // traz uma por omissão e o ecrã ficava com dois campos
                // empilhados, o de baixo sem rótulo nenhum.
                searchable={false}
                // A busca e os filtros vivem no `ModuleToolbar` acima; sem
                // isto a tabela não sabia que estavam activos e o ecrã
                // vazio dizia «Você não possui itens pendentes» a quem
                // tinha cinco e só estava a filtrar.
                filtering={{
                  active: Boolean(search.trim()) || statusFilter !== 'todos' || prioridadeFilter !== 'todos',
                  onClear: () => { setSearch(''); setStatusFilter('todos'); setPrioridadeFilter('todos'); },
                }}
                onRowClick={(item) => setDetailPlano(item)}
                loading={isLoading}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                paginated
                pageSize={20}
                emptyState={{
                  icon: <IconChecklist className="h-12 w-12" />,
                  title: t('planosAcao.emptyTitle'),
                  description: activeTab === 'meus' ? t('planosAcao.emptyDescriptionMyItems') : t('planosAcao.emptyDescriptionAll'),
                  action: { label: t('planosAcao.newAction'), onClick: () => { setEditingPlano(null); setDialogOpen(true); } },
                }}
              />
          ) : (
            <div className="p-4 sm:p-6 pt-0">
              <PlanosAcaoKanban
                colunas={kanbanColumns}
                items={filteredPlanos}
                onOpen={(item) => setDetailPlano(item)}
                onStatusChange={handleStatusChange}
                statusConfig={statusConfig}
                prioridadeConfig={prioridadeConfig}
                moduloLabels={moduloLabels}
              />
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PlanoAcaoDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingPlano(null); }}
        onSave={handleSave}
        plano={editingPlano}
        loading={saving}
      />

      <PlanoAcaoDetailDrawer
        plano={detailPlano}
        open={!!detailPlano}
        onOpenChange={(open) => { if (!open) setDetailPlano(null); }}
        onEdit={(p) => { setDetailPlano(null); setEditingPlano(p); setDialogOpen(true); }}
        onStatusChange={handleStatusChange}
        onOpenOrigin={(p) => { if (p._route) navigate(p._route); }}
        statusConfig={statusConfig}
        prioridadeConfig={prioridadeConfig}
        moduloLabels={moduloLabels}
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
