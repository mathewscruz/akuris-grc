import { useState, useEffect } from 'react';
import { IconAdd, IconClose, IconEdit, IconDelete, IconMore, IconWarning, IconTime, IconFile, IconShield, IconSettings, IconTag, IconHistory, IconShieldCheck, IconAttach, IconBook, IconUserOff, IconCalendarClock } from '@/components/icons';
import { useSearchParams, useLocation } from 'react-router-dom';
import { StatStrip } from '@/components/ui/stat-strip';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  resolveRiscoStatusTone,
  resolveNivelRiscoTone,
  resolveAprovacaoTone,
  resolveRevisaoTone,
} from '@/lib/status-tone';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useRiscosStats } from '@/hooks/useRiscosStats';
import { useRiskScoreTrend } from '@/hooks/useRiskScoreTrend';
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly } from '@/lib/date-utils';
import { differenceInDays } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RiscoDialog } from '@/components/riscos/RiscoDialog';
import { TratamentosDialog } from '@/components/riscos/TratamentosDialog';
import { MatrizDialog } from '@/components/riscos/MatrizDialog';
import { CategoriasDialog } from '@/components/riscos/CategoriasDialog';
import { BibliotecaRiscosDialog } from '@/components/riscos/BibliotecaRiscosDialog';
import { RiscoAnexosIcone } from '@/components/riscos/RiscoAnexosIcone';
import { RiscosTabs } from '@/components/riscos/RiscosTabs';
import RiscosAceite from '@/pages/RiscosAceite';
import { RiscoDetailDrawer } from '@/components/riscos/RiscoDetailDrawer';
import { AppetiteBanner } from '@/components/riscos/overview/AppetiteBanner';
import { RiskTrendChart } from '@/components/riscos/overview/RiskTrendChart';
import { RiskCategoryBars } from '@/components/riscos/overview/RiskCategoryBars';
import { RiskWatchlist } from '@/components/riscos/overview/RiskWatchlist';
import { SeverityKpiRow } from '@/components/riscos/matrix/SeverityKpiRow';
import { RiskHeatmap } from '@/components/riscos/matrix/RiskHeatmap';
import { HeatmapCellPanel } from '@/components/riscos/matrix/HeatmapCellPanel';
import { AppetiteFooter } from '@/components/riscos/matrix/AppetiteFooter';
import { RiscosViewChips, type SavedView } from '@/components/riscos/table/RiscosViewChips';
import { SparklineCell } from '@/components/riscos/table/SparklineCell';
import { SlaCell } from '@/components/riscos/table/SlaCell';
import { isAcimaApetite, severityFromNivel, slaFromRevisao, scoreFromPI, shortRiskId, relativeShort, toScaleNumber, formatScaleValue, financialExposure } from '@/components/riscos/risk-utils';
import { useEmpresaMoeda } from '@/hooks/useEmpresaMoeda';
import { assertTratamentosLookup, deriveRiscoStatus, isTratamentoConcluido, isTratamentoRequerido } from '@/components/riscos/risk-status';
import {
  apetiteScoreFromNiveis,
  type NivelRisco,
  type EscalaItem,
} from '@/components/riscos/matriz-config';
import { filterUuids, splitResponsavel } from '@/lib/uuid';

import { TrilhaAuditoriaRiscos } from '@/components/riscos/TrilhaAuditoriaRiscos';
import { HistoricoAvaliacoesDialog } from '@/components/riscos/HistoricoAvaliacoesDialog';
import { AprovacaoRiscoDialog } from '@/components/riscos/AprovacaoRiscoDialog';
import { exportRiscosPDF, exportRiscosCSV } from '@/components/riscos/ExportRiscosPDF';
import { CriarTarefaMenuItem } from '@/components/projetos/CriarTarefaMenuItem';
import { useLanguage } from '@/contexts/LanguageContext';

interface Risco {
  id: string;
  nome: string;
  descricao?: string;
  matriz_id?: string;
  categoria_id?: string;
  probabilidade_inicial?: string;
  impacto_inicial?: string;
  impacto_financeiro?: number;
  historico_scores?: number[];
  probabilidade_residual?: string;
  impacto_residual?: string;
  nivel_risco_inicial: string;
  nivel_risco_residual?: string;
  status: string;
  responsavel?: string;
  responsavel_nome?: string;
  responsavel_foto?: string;
  controles_existentes?: string;
  mitigacao_snapshot?: unknown;
  causas?: string;
  consequencias?: string;
  aceito: boolean;
  justificativa_aceite?: string;
  categoria?: { nome: string; cor?: string };
  matriz?: { nome: string };
  created_at: string;
  tratamentos_count?: number;
  /** Tratamentos exigidos (total menos cancelados) — base da regra de "Tratado". */
  tratamentos_requeridos?: number;
  /** Tratamentos exigidos já concluídos. */
  tratamentos_concluidos?: number;
  /** Status coerente com os tratamentos (AKURIS QA-065). Só difere quando o valor gravado é 'tratado' sem evidência. */
  status_efetivo?: string;
  /** Explicação do ajuste de status, quando houve. */
  status_ajuste_motivo?: string | null;
  data_proxima_revisao?: string;
  status_aprovacao?: string;
  aprovador_id?: string;
  historico_aprovacao?: any;
  created_by?: string;
}

interface MatrizConfig {
  niveis_risco: NivelRisco[];
  escala_probabilidade?: EscalaItem[];
  escala_impacto?: EscalaItem[];
  metodo_calculo?: string | null;
}

export function Riscos() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();
  const { data: stats, refetch: refetchStats } = useRiscosStats();
  const { data: trendPoints = [] } = useRiskScoreTrend();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { format: formatMoedaEmpresa } = useEmpresaMoeda();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [nivelFilter, setNivelFilter] = useState<string>('');
  const [aceitoFilter, setAceitoFilter] = useState<string>('');
  const [idsFilter, setIdsFilter] = useState<string[]>([]);
  const [riscoDialogOpen, setRiscoDialogOpen] = useState(false);
  const [matrizDialogOpen, setMatrizDialogOpen] = useState(false);
  const [editingRisco, setEditingRisco] = useState<Risco | null>(null);
  const [tratamentosDialogOpen, setTratamentosDialogOpen] = useState(false);
  const [tratamentosRisco, setTratamentosRisco] = useState<Risco | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [riscoToDelete, setRiscoToDelete] = useState<Risco | null>(null);
  const [categoriasDialogOpen, setCategoriasDialogOpen] = useState(false);
  const [bibliotecaDialogOpen, setBibliotecaDialogOpen] = useState(false);
  
  // Novos estados para dialogs
  const [auditRisco, setAuditRisco] = useState<Risco | null>(null);
  const [historicoRisco, setHistoricoRisco] = useState<Risco | null>(null);
  const [aprovacaoRisco, setAprovacaoRisco] = useState<Risco | null>(null);

  // Drawer de detalhe
  const [drawerRiscoId, setDrawerRiscoId] = useState<string | null>(null);
  const [matrixCell, setMatrixCell] = useState<{ p: number; i: number } | undefined>();
  const [matrixMode, setMatrixMode] = useState<'inerente' | 'residual' | 'movimento'>('inerente');

  // Saved view chips (apenas para a aba Tabela)
  const [savedView, setSavedView] = useState<SavedView>('todos');

  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // React Query for riscos
  const {
    data: riscos = [], isLoading: loading, isError: riscosError,
    error: riscosQueryError, refetch: refetchRiscos,
  } = useQuery<Risco[]>({
    queryKey: ['riscos', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos')
        .select(`
          id, codigo, nome, descricao, matriz_id, categoria_id,
          probabilidade_inicial, impacto_inicial,
          probabilidade_residual, impacto_residual,
          nivel_risco_inicial, nivel_risco_residual,
          status, responsavel, controles_existentes, mitigacao_snapshot,
          causas, consequencias, aceito, justificativa_aceite,
          created_at, data_proxima_revisao,
          status_aprovacao, aprovador_id, historico_aprovacao,
          categoria:riscos_categorias(nome, cor),
          matriz:riscos_matrizes(nome)
        `)
        .eq('empresa_id', profile!.empresa_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Tratamentos: além da contagem total, o status de cada um — a regra de
      // "Tratado" (AKURIS QA-065) depende de quantos são exigidos e concluídos.
      const riscoIds = data?.map(r => r.id) || [];
      let tratamentosCount: Record<string, number> = {};
      const tratamentosRequeridos: Record<string, number> = {};
      const tratamentosConcluidos: Record<string, number> = {};

      if (riscoIds.length > 0) {
        const { data: tratamentos, error: tratamentosError } = await supabase
          .from('riscos_tratamentos')
          .select('risco_id, status')
          .in('risco_id', riscoIds);

        assertTratamentosLookup(tratamentosError);

        tratamentosCount = (tratamentos || []).reduce((acc, t) => {
          acc[t.risco_id] = (acc[t.risco_id] || 0) + 1;
          if (isTratamentoRequerido(t.status)) {
            tratamentosRequeridos[t.risco_id] = (tratamentosRequeridos[t.risco_id] || 0) + 1;
            if (isTratamentoConcluido(t.status)) {
              tratamentosConcluidos[t.risco_id] = (tratamentosConcluidos[t.risco_id] || 0) + 1;
            }
          }
          return acc;
        }, {} as Record<string, number>);
      }

      // Impacto financeiro em query SEPARADA e tolerante a erro: se a coluna
      // ainda não existir na base (migração não aplicada), a lista de riscos
      // NÃO quebra — apenas a exposição fica indisponível até a migração.
      let financeMap: Record<string, number | null> = {};
      if (riscoIds.length > 0) {
        const { data: fin, error: finErr } = await supabase
          .from('riscos')
          .select('id, impacto_financeiro')
          .in('id', riscoIds);
        if (!finErr && fin) {
          financeMap = Object.fromEntries(fin.map((r: any) => [r.id, r.impacto_financeiro]));
        }
      }

      // Histórico real de avaliações → pontos da coluna "Tend.". Sem histórico
      // suficiente a tabela mostra "sem histórico" (nunca uma linha inventada).
      const historicoMap: Record<string, number[]> = {};
      if (riscoIds.length > 0) {
        const { data: hist, error: histErr } = await supabase
          .from('riscos_historico_avaliacoes')
          .select('risco_id, probabilidade, impacto, created_at')
          .in('risco_id', riscoIds)
          .order('created_at', { ascending: true });
        if (!histErr && hist) {
          hist.forEach((h: any) => {
            const score = scoreFromPI(h.probabilidade, h.impacto);
            if (!score) return;
            (historicoMap[h.risco_id] ||= []).push(score);
          });
        }
      }

      if (data && data.length > 0) {
        const normalizedData = data.map(risco => {
          const requeridos = tratamentosRequeridos[risco.id] || 0;
          const concluidos = tratamentosConcluidos[risco.id] || 0;
          const coerente = deriveRiscoStatus(risco.status, { requeridos, concluidos });
          return {
            ...risco,
            categoria: Array.isArray(risco.categoria) && risco.categoria.length > 0
              ? risco.categoria[0]
              : risco.categoria,
            tratamentos_count: tratamentosCount[risco.id] || 0,
            tratamentos_requeridos: requeridos,
            tratamentos_concluidos: concluidos,
            status_efetivo: coerente.status,
            status_ajuste_motivo: coerente.motivo,
            impacto_financeiro: financeMap[risco.id] ?? null,
            historico_scores: historicoMap[risco.id] ?? [],
          };
        });

        // AKURIS QA-064: `riscos.responsavel` é TEXT e guarda tanto UUID de
        // perfil quanto rótulo legado ("Mathews Cruz - CISO", "DPO"). Enviar o
        // rótulo ao filtro uuid `profiles.user_id` devolvia HTTP 400/22P02.
        // Só UUIDs vão ao backend; o rótulo continua sendo exibido.
        const responsavelIds = filterUuids(normalizedData.map(r => r.responsavel));

        let profileMap = new Map<string, { nome: string | null; foto_url: string | null }>();
        if (responsavelIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, nome, foto_url')
            .in('user_id', responsavelIds);

          profileMap = new Map(
            profiles?.map(p => [p.user_id, { nome: p.nome, foto_url: p.foto_url }]) || []
          );
        }

        return normalizedData.map(risco => {
          const { userId, label } = splitResponsavel(risco.responsavel);
          const profileData = userId ? profileMap.get(userId) : null;
          return {
            ...risco,
            responsavel_nome: profileData?.nome || label || null,
            responsavel_foto: profileData?.foto_url || null,
          };
        }) as unknown as Risco[];
      }

      return (data || []) as unknown as Risco[];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 1000 * 60 * 2,
  });

  // React Query for matriz config
  //
  // AKURIS QA-055: `.single()` respondia HTTP 406/PGRST116 quando a empresa não
  // tinha linha de configuração, e o erro era engolido (`const { data }`).
  // Agora: `.maybeSingle()` distingue "não existe" (null, estado acionável) de
  // erro real (lançado, tratado por `isError`), com o tenant explícito no filtro
  // além da RLS.
  const {
    data: matrizConfig = null,
    isLoading: matrizConfigLoading,
    isError: matrizConfigError,
    refetch: refetchMatrizConfig,
  } = useQuery({
    queryKey: ['riscos-matriz-config', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos_matriz_configuracao')
        .select('niveis_risco, escala_probabilidade, escala_impacto, metodo_calculo, matriz:riscos_matrizes!inner(empresa_id)')
        .eq('matriz.empresa_id', profile!.empresa_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        niveis_risco: data.niveis_risco as unknown as NivelRisco[],
        escala_probabilidade: data.escala_probabilidade as unknown as EscalaItem[],
        escala_impacto: data.escala_impacto as unknown as EscalaItem[],
        metodo_calculo: data.metodo_calculo as string | null,
      } as MatrizConfig;
    },
    enabled: !!profile?.empresa_id,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  /** Configuração indisponível: sem linha (ausente) ou consulta com erro. */
  const matrizConfigIndisponivel = !matrizConfigLoading && (matrizConfigError || !matrizConfig);

  /**
   * Refaz TODAS as consultas afetadas por criar/editar/apagar risco.
   * `refetchType: 'all'` garante que abas ainda não montadas (Visão geral,
   * Matriz) e os KPIs do Dashboard também sejam atualizados, e o `await`
   * permite fechar o modal só depois de a lista já conter o novo risco.
   */
  const invalidateRiscos = async () => {
    const keys = [
      ['riscos'],
      ['riscos-stats'],
      ['risco-detail'],
      ['risk-score-trend'],
      ['riscos-categorias'],
      ['dashboard-stats'],
      ['grc-maturity'],
      ['trend-data'],
      ['planos-acao-stats'],
    ];
    await Promise.all(
      keys.map((queryKey) =>
        queryClient.invalidateQueries({ queryKey, refetchType: 'all' }),
      ),
    );
    await Promise.all([refetchRiscos(), refetchStats()]);
  };

  useEffect(() => {
    const itemId = location.state?.itemId;
    if (itemId && riscos.length > 0) {
      const risco = riscos.find(r => r.id === itemId);
      if (risco) {
        setEditingRisco(risco as Risco);
        setRiscoDialogOpen(true);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, riscos]);

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) {
      setIdsFilter(ids.split(','));
    }
  }, [searchParams]);

  const filteredRiscos = riscos.filter(risco => {
    const matchesSearch = risco.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         risco.responsavel?.toLowerCase().includes(searchTerm.toLowerCase());
    // Filtra pelo status exibido (AKURIS QA-065) para que o resultado bata com o badge.
    const matchesStatus = !statusFilter || statusFilter === 'all' || (risco.status_efetivo ?? risco.status) === statusFilter;
    // Mesmo critério do badge: filtrar pela inerente devolvia riscos cuja
    // severidade apresentada era outra.
    const matchesNivel = !nivelFilter || nivelFilter === 'all' ||
      (risco.nivel_risco_residual || risco.nivel_risco_inicial) === nivelFilter;
    const matchesAceito = !aceitoFilter || aceitoFilter === 'all' || 
                         (aceitoFilter === 'aceito' && risco.aceito) ||
                         (aceitoFilter === 'nao_aceito' && !risco.aceito);
    const matchesIds = idsFilter.length === 0 || idsFilter.includes(risco.id);

    return matchesSearch && matchesStatus && matchesNivel && matchesAceito && matchesIds;
  });

  const clearIdsFilter = () => {
    setIdsFilter([]);
    setSearchParams({});
  };

  const handleEdit = (risco: Risco) => {
    setEditingRisco(risco);
    setRiscoDialogOpen(true);
  };

  const openTratamentosDialog = (risco: Risco) => {
    setTratamentosRisco(risco);
    setTratamentosDialogOpen(true);
  };

  const openDeleteDialog = (risco: Risco) => {
    setRiscoToDelete(risco);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!riscoToDelete) return;

    try {
      const { error } = await supabase
        .from('riscos')
        .delete()
        .eq('id', riscoToDelete.id)
        .eq('empresa_id', profile!.empresa_id);

      if (error) throw error;

      toast({
        title: t('riscos.page.toast.successTitle'),
        description: t('riscos.page.toast.deleteSuccess'),
      });
      await invalidateRiscos();
      setDeleteDialogOpen(false);
      setRiscoToDelete(null);
    } catch (error: any) {
      toast({
        title: t('riscos.page.toast.errorTitle'),
        description: t('riscos.page.toast.deleteError') + error.message,
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setEditingRisco(null);
    setRiscoDialogOpen(true);
  };

  const handleDialogSuccess = async () => {
    // Fecha só depois do refetch: o utilizador vê o risco já na lista.
    await invalidateRiscos();
    setRiscoDialogOpen(false);
    setEditingRisco(null);
  };

  const handleMatrizDialogSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['riscos-matriz-config'], refetchType: 'all' });
    await invalidateRiscos();
    setMatrizDialogOpen(false);
  };

  const handleCategoriasDialogSuccess = async () => {
    await invalidateRiscos();
    setCategoriasDialogOpen(false);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRiscos = [...filteredRiscos].sort((a, b) => {
    let aValue: any = a[sortField as keyof Risco];
    let bValue: any = b[sortField as keyof Risco];
    
    if (sortField === 'categoria') {
      aValue = a.categoria?.nome || '';
      bValue = b.categoria?.nome || '';
    }

    if (sortField === 'exposicao') {
      aValue = financialExposure(a.impacto_financeiro, a.probabilidade_residual ?? a.probabilidade_inicial) ?? -1;
      bValue = financialExposure(b.impacto_financeiro, b.probabilidade_residual ?? b.probabilidade_inicial) ?? -1;
    }

    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';
    
    if (typeof aValue === 'string') {
      const comparison = aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getRevisaoBadge = (dataRevisao?: string) => {
    if (!dataRevisao) return null;
    const dias = differenceInDays(new Date(dataRevisao), new Date());
    if (dias < 0) {
      return <StatusBadge {...resolveRevisaoTone(dias)}>{t('riscos.page.overdue')}</StatusBadge>;
    }
    if (dias <= 7) {
      return <StatusBadge {...resolveRevisaoTone(dias)}>{dias}d</StatusBadge>;
    }
    return null;
  };

  // `getAprovacaoBadge` vivia aqui e nunca foi chamado — código morto que
  // ainda carregava o vocabulário antigo (`pendente` em vez de
  // `pendente_aprovacao`). Removido: o estado de aprovação mostra-se no
  // diálogo de Aprovação, que é onde se decide.

  // (calcTrend e MiniSparkline removidos com os KPI cards antigos)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AkurisPulse size={48} />
        <p className="text-sm text-muted-foreground">{t('riscos.page.loading')}</p>
      </div>
    );
  }

  if (riscosError) {
    return (
      <Alert variant="destructive" role="alert" className="my-6">
        <IconWarning className="h-4 w-4" />
        <AlertTitle>{t('riscos.page.loadError.title')}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{(riscosQueryError as Error)?.message || t('riscos.page.loadError.fallback')}</p>
          <Button variant="outline" size="sm" onClick={() => refetchRiscos()}>{t('riscos.page.retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const riscoColumns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    className?: string;
    render?: (value: any, risco: Risco) => React.ReactNode;
  }> = [
    {
      key: 'id',
      label: t('riscos.page.columns.id'),
      className: 'w-[72px]',
      render: (_value: any, risco: Risco) => (
        <span className="font-mono text-micro text-muted-foreground">{shortRiskId(risco.id, (risco as any).codigo)}</span>
      ),
    },
    {
      key: 'nome',
      label: t('riscos.page.columns.name'),
      sortable: true,
      render: (value: any, risco: Risco) => {
        const sev = severityFromNivel(risco.nivel_risco_residual || risco.nivel_risco_inicial);
        const dot =
          sev === 'critico' ? 'bg-destructive' :
          sev === 'alto' ? 'bg-warning' :
          sev === 'medio' ? 'bg-warning/60' : 'bg-success';
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot}`} />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDrawerRiscoId(risco.id); }}
              className="font-medium text-left hover:text-primary transition-colors truncate"
            >
              {value}
            </button>
          </div>
        );
      },
    },
    {
      key: 'categoria',
      label: t('riscos.page.columns.category'),
      render: (value: any) => value ? <span className="text-xs text-foreground/85">{value.nome}</span> : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'nivel_risco_inicial',
      label: t('riscos.page.columns.severity'),
      // Severidade efectiva (residual quando existe), como o ponto ao lado do
      // nome, o detalhe do risco, o mapa de calor e o dashboard. Mostrar aqui a
      // inerente fazia a mesma linha exibir duas severidades diferentes.
      render: (_value: string, risco: Risco) => {
        const nivel = risco.nivel_risco_residual || risco.nivel_risco_inicial;
        return <StatusBadge {...resolveNivelRiscoTone(nivel)}>{formatStatus(nivel)}</StatusBadge>;
      },
    },
    {
      key: 'trend',
      label: t('riscos.page.columns.trend'),
      className: 'w-[92px]',
      render: (_v: any, r: Risco) => (
        <SparklineCell points={r.historico_scores} />
      ),
    },
    {
      key: 'status',
      label: t('riscos.page.columns.status'),
      render: (value: string, risco: Risco) => {
        // AKURIS QA-065: "Tratado" sem tratamento concluído é exibido no status
        // coerente com a evidência; o dado gravado não é alterado.
        const efetivo = risco.status_efetivo ?? value;
        return (
          <span title={risco.status_ajuste_motivo ?? undefined}>
            <StatusBadge {...resolveRiscoStatusTone(efetivo)}>{formatStatus(efetivo)}</StatusBadge>
          </span>
        );
      },
    },
    {
      key: 'responsavel',
      label: t('riscos.page.columns.responsible'),
      render: (_value: string, risco: Risco) => {
        if (!risco.responsavel_nome) return <span className="text-xs text-muted-foreground">—</span>;
        const first = risco.responsavel_nome.trim().split(/\s+/)[0];
        return (
          <div className="inline-flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              {risco.responsavel_foto && <AvatarImage src={risco.responsavel_foto} alt={risco.responsavel_nome} />}
              <AvatarFallback className="bg-primary/10 text-primary text-micro">
                {risco.responsavel_nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-foreground/85" title={risco.responsavel_nome}>{first}</span>
          </div>
        );
      },
    },
    {
      key: 'updated',
      label: t('riscos.page.columns.updated'),
      className: 'w-[96px]',
      render: (_v: any, r: Risco) => (
        <span className="text-micro text-muted-foreground">{relativeShort((r as any).updated_at || r.created_at)}</span>
      ),
    },
    {
      key: 'sla',
      label: t('riscos.page.columns.sla'),
      className: 'w-[90px]',
      render: (_v: any, r: Risco) => <SlaCell dataProximaRevisao={r.data_proxima_revisao} />,
    },
    {
      key: 'actions',
      label: t('riscos.page.columns.actions'),
      className: 'w-[60px]',
      render: (value: any, risco: Risco) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${t('p8Layout.layout.moreActions')}: ${risco.nome}`}
              className="h-8 w-8 p-0"
            >
              <IconMore className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(risco)}>
              <IconEdit className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.page.actions.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTratamentosDialog(risco)}>
              <IconShield className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.page.actions.treatments')} ({risco.tratamentos_count || 0})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAprovacaoRisco(risco)}>
              <IconShieldCheck className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.page.actions.approval')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHistoricoRisco(risco)}>
              <IconTime className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.page.actions.evaluationHistory')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAuditRisco(risco)}>
              <IconHistory className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.page.actions.auditTrail')}
            </DropdownMenuItem>
            <CriarTarefaMenuItem
              entidadeTipo="risco"
              entidadeId={risco.id}
              tituloSugerido={`${t('riscos.page.actions.treatRiskPrefix')} ${risco.nome ?? ''}`}
            />
            <DropdownMenuItem onClick={() => openDeleteDialog(risco)} className="text-destructive focus:text-destructive">
              <IconDelete className="mr-2 h-4 w-4" strokeWidth={1.5} /> {t('riscos.page.actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters = [
    {
      key: 'status',
      label: t('riscos.page.filters.status'),
      type: 'select' as const,
      options: [
        { value: 'all', label: t('riscos.page.filters.all') },
        { value: 'identificado', label: t('riscos.page.status.identificado') },
        { value: 'analisado', label: t('riscos.page.status.analisado') },
        { value: 'em_tratamento', label: t('riscos.page.status.em_tratamento') },
        { value: 'tratado', label: t('riscos.page.status.tratado') },
        { value: 'monitorado', label: t('riscos.page.status.monitorado') },
        { value: 'aceito', label: t('riscos.page.status.aceito') }
      ],
      value: statusFilter,
      onChange: (value: string) => setStatusFilter(value === 'all' ? '' : value)
    },
    {
      key: 'nivel',
      label: t('riscos.page.filters.level'),
      type: 'select' as const,
      options: [
        { value: 'all', label: t('riscos.page.filters.all') },
        { value: 'Crítico', label: t('riscos.page.level.critico') },
        { value: 'Muito Alto', label: t('riscos.page.level.muitoAlto') },
        { value: 'Alto', label: t('riscos.page.level.alto') },
        { value: 'Médio', label: t('riscos.page.level.medio') },
        { value: 'Baixo', label: t('riscos.page.level.baixo') },
        { value: 'Muito Baixo', label: t('riscos.page.level.muitoBaixo') }
      ],
      value: nivelFilter,
      onChange: (value: string) => setNivelFilter(value === 'all' ? '' : value)
    },
    {
      key: 'aceito',
      label: t('riscos.page.filters.accepted'),
      type: 'select' as const,
      options: [
        { value: 'all', label: t('riscos.page.filters.all') },
        { value: 'aceito', label: t('riscos.page.filters.acceptedYes') },
        { value: 'nao_aceito', label: t('riscos.page.filters.acceptedNo') }
      ],
      value: aceitoFilter,
      onChange: (value: string) => setAceitoFilter(value === 'all' ? '' : value)
    }
  ];

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <PageHeader
          title={t('modules.riscos.title')}
          description={t('modules.riscos.description')}
          actions={
            <Button size="sm" onClick={openCreateDialog} aria-label={t('riscos.page.newRiskAria')}>
              <IconAdd className="h-4 w-4 sm:mr-2" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('riscos.page.newRisk')}</span>
            </Button>
          }
          secondaryActions={[
            { label: t('riscos.page.export.csv'), icon: <IconFile className="h-4 w-4" strokeWidth={1.5} />, onClick: () => exportRiscosCSV(sortedRiscos) },
            { label: t('riscos.page.export.pdf'), icon: <IconFile className="h-4 w-4" strokeWidth={1.5} />, onClick: () => exportRiscosPDF(sortedRiscos, stats) },
            { label: t('riscosBiblioteca.botao'), icon: <IconBook className="h-4 w-4" strokeWidth={1.5} />, onClick: () => setBibliotecaDialogOpen(true), separatorBefore: true },
            { label: t('riscos.page.categories'), icon: <IconTag className="h-4 w-4" strokeWidth={1.5} />, onClick: () => setCategoriasDialogOpen(true) },
            { label: t('riscos.page.configMatrix'), icon: <IconSettings className="h-4 w-4" strokeWidth={1.5} />, onClick: () => setMatrizDialogOpen(true) },
          ]}
        />

        {/* KPI cards antigos removidos — KPIs agora vivem dentro das abas (Visão geral / Matriz). */}

        {/* AKURIS QA-055 — sem configuração de matriz não há nível de risco
            calculável. Antes o erro era silencioso; agora é explícito e acionável. */}
        {matrizConfigIndisponivel && (
          <Alert variant="destructive" data-testid="matriz-config-indisponivel">
            <IconWarning className="h-4 w-4" strokeWidth={1.5} />
            <AlertTitle>{t('riscos.page.matrizErroTitulo')}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{t('riscos.page.matrizErroDescricao')}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setMatrizDialogOpen(true)}>
                  <IconSettings className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  {t('riscos.page.configMatrix')}
                </Button>
                {matrizConfigError && (
                  <Button size="sm" variant="ghost" onClick={() => refetchMatrizConfig()}>
                    {t('riscos.page.retry')}
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {idsFilter.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap">
              {t('riscos.page.matrixFilter')} ({idsFilter.length})
              <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent" onClick={clearIdsFilter}>
                <IconClose className="h-3 w-3" />
              </Button>
            </Badge>
          </div>
        )}

        {(() => {
          // Derivações compartilhadas para Visão geral e Matriz
          // Apetite score = max do nível marcado como limite de apetite na config da
          // matriz (fallback: nível "médio", para matrizes sem a marcação).
          const apetiteScore: number | null = apetiteScoreFromNiveis(matrizConfig?.niveis_risco);
          const acimaApetite = riscos.filter((r) => isAcimaApetite(r, apetiteScore)).length;
          // Alinhado à coluna Resp. da tabela: conta riscos sem nome de responsável
          // resolvido (um ID que não resolve para um perfil também aparece como "—").
          const semResponsavel = riscos.filter((r) => !r.responsavel_nome).length;
          const revisaoVencida = riscos.filter((r) => slaFromRevisao(r.data_proxima_revisao) === 'vencido').length;
          // Status efetivo (AKURIS QA-065): o KPI acompanha o badge exibido.
          const emTratamento = riscos.filter((r) => (r.status_efetivo ?? r.status) === 'em_tratamento').length;

          // Counts por severidade (residual||inicial)
          const sevCounts = riscos.reduce(
            (acc, r) => {
              const s = severityFromNivel(r.nivel_risco_residual || r.nivel_risco_inicial);
              acc[s]++;
              return acc;
            },
            { critico: 0, alto: 0, medio: 0, baixo: 0 } as Record<'critico' | 'alto' | 'medio' | 'baixo', number>,
          );

          // Risks da célula selecionada — respeita o modo do heatmap (inerente/residual)
          const cellRisks = matrixCell
            ? riscos
                .filter((r) => {
                  const p = toScaleNumber(matrixMode === 'residual' ? r.probabilidade_residual : r.probabilidade_inicial);
                  const i = toScaleNumber(matrixMode === 'residual' ? r.impacto_residual : r.impacto_inicial);
                  return p === matrixCell.p && i === matrixCell.i;
                })
                // O painel exibe o status coerente, igual à tabela (AKURIS QA-065).
                .map((r) => ({ ...r, status: r.status_efetivo ?? r.status }))
            : [];

          const overviewNode = (
            <div className="space-y-5">
              <AppetiteBanner
                count={acimaApetite}
                onSeeMatrix={() => {
                  const sp = new URLSearchParams(searchParams);
                  sp.set('view', 'matrix');
                  setSearchParams(sp);
                }}
              />
              <StatStrip
                items={[
                  { key: 'acimaApetite', label: t('riscos.page.kpi.aboveAppetite'), value: acimaApetite, icon: IconWarning, tone: 'destructive', hint: t('riscos.page.kpi.highOrCritical'), onClick: () => {
                    const sp = new URLSearchParams(searchParams); sp.set('view', 'matrix'); setSearchParams(sp);
                  }},
                  { key: 'semResponsavel', label: t('riscos.page.kpi.noResponsible'), value: semResponsavel, icon: IconUserOff, tone: 'warning', hint: t('riscos.page.kpi.awaitingAssignment'), onClick: () => {
                    const sp = new URLSearchParams(searchParams); sp.set('view', 'table'); setSearchParams(sp);
                  }},
                  { key: 'revisaoVencida', label: t('riscos.page.kpi.overdueReview'), value: revisaoVencida, icon: IconCalendarClock, tone: 'warning', hint: t('riscos.page.kpi.slaExpired'), onClick: () => {
                    const sp = new URLSearchParams(searchParams); sp.set('view', 'table'); setSearchParams(sp);
                  }},
                  { key: 'emTratamento', label: t('riscos.page.kpi.inTreatment'), value: emTratamento, icon: IconShieldCheck, hint: t('riscos.page.kpi.planInProgress'), onClick: () => {
                    const sp = new URLSearchParams(searchParams); sp.set('view', 'table'); setSearchParams(sp);
                  }},
                ]}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2"><RiskTrendChart points={trendPoints} apetite={apetiteScore} /></div>
                <RiskCategoryBars riscos={riscos as any} />
              </div>
              <RiskWatchlist
                riscos={riscos as any}
                totalCount={riscos.length}
                onOpenRisk={(id) => setDrawerRiscoId(id)}
                onSeeAll={() => {
                  const sp = new URLSearchParams(searchParams); sp.set('view', 'table'); setSearchParams(sp);
                }}
              />
            </div>
          );

          const matrixNode = (
            <div className="space-y-4">
              <SeverityKpiRow counts={sevCounts} />
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
                <div className="space-y-3">
                  <RiskHeatmap
                    riscos={riscos as any}
                    selected={matrixCell}
                    onSelectCell={(c) => setMatrixCell(c)}
                    onClearSelection={() => setMatrixCell(undefined)}
                    onOpenRisk={(id) => setDrawerRiscoId(id)}
                    mode={matrixMode}
                    onModeChange={(m) => { setMatrixMode(m); setMatrixCell(undefined); }}
                    config={matrizConfig}
                  />
                  <AppetiteFooter apetiteScore={apetiteScore} acimaCount={acimaApetite} />
                </div>
                {matrixCell && (
                  <HeatmapCellPanel
                    cell={matrixCell}
                    risks={cellRisks as any}
                    onOpenRisk={(id) => setDrawerRiscoId(id)}
                    onClearSelection={() => setMatrixCell(undefined)}
                    config={matrizConfig}
                  />
                )}
              </div>
            </div>
          );

          // Saved-view virtual filter para a tabela
          const meId = profile?.user_id;
          const viewFilters: Record<SavedView, (r: Risco) => boolean> = {
            todos: () => true,
            acima_apetite: (r) => isAcimaApetite(r, apetiteScore),
            sem_responsavel: (r) => !r.responsavel_nome,
            revisao_vencida: (r) => slaFromRevisao(r.data_proxima_revisao) === 'vencido',
            meus_riscos: (r) => !!meId && r.responsavel === meId,
          };
          const viewedRiscos = sortedRiscos.filter(viewFilters[savedView]);
          const viewItems = [
            { id: 'todos' as SavedView, label: t('riscos.page.filters.all'), count: sortedRiscos.length },
            { id: 'acima_apetite' as SavedView, label: t('riscos.page.kpi.aboveAppetite'), count: sortedRiscos.filter(viewFilters.acima_apetite).length },
            { id: 'sem_responsavel' as SavedView, label: t('riscos.page.kpi.noResponsible'), count: sortedRiscos.filter(viewFilters.sem_responsavel).length },
            { id: 'revisao_vencida' as SavedView, label: t('riscos.page.kpi.overdueReview'), count: sortedRiscos.filter(viewFilters.revisao_vencida).length },
            { id: 'meus_riscos' as SavedView, label: t('riscos.page.myRisks'), count: sortedRiscos.filter(viewFilters.meus_riscos).length },
          ];

          const tableNode = (
            <div className="space-y-3">
              <Card className="rounded-lg border overflow-hidden">
                <CardContent className="p-0">
                  <div className="px-4 pt-4 sm:px-6 sm:pt-6">
                    <RiscosViewChips active={savedView} onChange={setSavedView} items={viewItems} />
                  </div>
                  <DataTable
                    data={viewedRiscos}
                    columns={riscoColumns as Column<Risco>[]}
                    onRowClick={(risco) => setDrawerRiscoId(risco.id)}
                    loading={loading}
                    searchable
                    searchPlaceholder={t('riscos.page.searchPlaceholder')}
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    filters={filters}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    emptyState={{
                      icon: <IconWarning className="h-8 w-8" />,
                      title: searchTerm || statusFilter || nivelFilter || aceitoFilter || savedView !== 'todos'
                        ? t('riscos.page.empty.foundTitle')
                        : t('riscos.page.empty.noneTitle'),
                      description: searchTerm || statusFilter || nivelFilter || aceitoFilter || savedView !== 'todos'
                        ? t('riscos.page.empty.foundDesc')
                        : t('riscosBiblioteca.vazioDesc'),
                      action: !searchTerm && !statusFilter && !nivelFilter && !aceitoFilter && savedView === 'todos' ? {
                        label: t('riscosBiblioteca.vazioCta'),
                        onClick: () => setBibliotecaDialogOpen(true),
                      } : undefined,
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          );

          return <RiscosTabs overview={overviewNode} matrix={matrixNode} table={tableNode} aceite={<RiscosAceite embedded />} />;
        })()}
        
        {/* Dialogs */}
        <RiscoDialog
          open={riscoDialogOpen}
          onOpenChange={setRiscoDialogOpen}
          risco={editingRisco}
          onSuccess={handleDialogSuccess}
        />

        <TratamentosDialog
          open={tratamentosDialogOpen}
          onOpenChange={setTratamentosDialogOpen}
          risco={tratamentosRisco}
          onSuccess={invalidateRiscos}
        />

        <MatrizDialog
          open={matrizDialogOpen}
          onOpenChange={setMatrizDialogOpen}
          onSuccess={handleMatrizDialogSuccess}
        />

        <BibliotecaRiscosDialog
          open={bibliotecaDialogOpen}
          onOpenChange={setBibliotecaDialogOpen}
          onSuccess={invalidateRiscos}
        />

        <CategoriasDialog
          open={categoriasDialogOpen}
          onOpenChange={setCategoriasDialogOpen}
          onSuccess={handleCategoriasDialogSuccess}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('riscos.page.deleteDialog.title')}
          description={t('riscos.page.deleteDialog.description', { nome: riscoToDelete?.nome ?? '' })}
          variant="destructive"
          confirmText={t('riscos.page.deleteDialog.confirm')}
          onConfirm={handleDelete}
        />

        {/* Novos Dialogs */}
        {auditRisco && (
          <TrilhaAuditoriaRiscos
            open={!!auditRisco}
            onOpenChange={(open) => !open && setAuditRisco(null)}
            riscoId={auditRisco.id}
            riscoNome={auditRisco.nome}
          />
        )}

        {historicoRisco && (
          <HistoricoAvaliacoesDialog
            open={!!historicoRisco}
            onOpenChange={(open) => !open && setHistoricoRisco(null)}
            riscoId={historicoRisco.id}
            riscoNome={historicoRisco.nome}
          />
        )}

        {aprovacaoRisco && (
          <AprovacaoRiscoDialog
            open={!!aprovacaoRisco}
            onOpenChange={(open) => !open && setAprovacaoRisco(null)}
            risco={aprovacaoRisco}
            onSuccess={() => { setAprovacaoRisco(null); invalidateRiscos(); }}
          />
        )}

        {/* Drawer de detalhe (global, abre via tabela / watchlist / heatmap) */}
        {(() => {
          const idx = drawerRiscoId ? sortedRiscos.findIndex((r) => r.id === drawerRiscoId) : -1;
          return (
            <RiscoDetailDrawer
              risco={(sortedRiscos[idx] as Risco) || null}
              open={!!drawerRiscoId}
              onOpenChange={(o) => !o && setDrawerRiscoId(null)}
              onEdit={(r) => { setDrawerRiscoId(null); handleEdit(r); }}
              onAccept={(r) => { setDrawerRiscoId(null); setAprovacaoRisco(r); }}
              onOpenTratamentos={(r) => { setDrawerRiscoId(null); openTratamentosDialog(r); }}
              nav={idx >= 0 ? {
                current: idx + 1,
                total: sortedRiscos.length,
                onPrev: idx > 0 ? () => setDrawerRiscoId(sortedRiscos[idx - 1].id) : undefined,
                onNext: idx < sortedRiscos.length - 1 ? () => setDrawerRiscoId(sortedRiscos[idx + 1].id) : undefined,
              } : undefined}
            />
          );
        })()}

      </div>
    </TooltipProvider>
  );
}
