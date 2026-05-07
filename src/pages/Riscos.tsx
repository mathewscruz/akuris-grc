import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Plus, AlertTriangle, TrendingUp, CheckCircle, Shield, Settings, Tag, X, Clock, FileText, Download, MoreHorizontal, Edit, Trash2, History, ShieldCheck, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly } from '@/lib/date-utils';
import { differenceInDays } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RiscoDialog } from '@/components/riscos/RiscoDialog';
import { TratamentosDialog } from '@/components/riscos/TratamentosDialog';
import { MatrizDialog } from '@/components/riscos/MatrizDialog';
import { CategoriasDialog } from '@/components/riscos/CategoriasDialog';
import { RiscoAnexosIcone } from '@/components/riscos/RiscoAnexosIcone';
import { RiskScoreCard } from '@/components/riscos/RiskScoreCard';
import { RiscosTabs } from '@/components/riscos/RiscosTabs';
import { RiscoDetailDrawer } from '@/components/riscos/RiscoDetailDrawer';
import { AppetiteBanner } from '@/components/riscos/overview/AppetiteBanner';
import { RiskKpiQuad } from '@/components/riscos/overview/RiskKpiQuad';
import { RiskTrendChart } from '@/components/riscos/overview/RiskTrendChart';
import { RiskCategoryBars } from '@/components/riscos/overview/RiskCategoryBars';
import { RiskWatchlist } from '@/components/riscos/overview/RiskWatchlist';
import { SeverityKpiRow } from '@/components/riscos/matrix/SeverityKpiRow';
import { RiskHeatmap } from '@/components/riscos/matrix/RiskHeatmap';
import { HeatmapCellPanel } from '@/components/riscos/matrix/HeatmapCellPanel';
import { AppetiteFooter } from '@/components/riscos/matrix/AppetiteFooter';
import { isAcimaApetite, severityFromNivel, slaFromRevisao } from '@/components/riscos/risk-utils';
import { useMemo } from 'react';

import { TrilhaAuditoriaRiscos } from '@/components/riscos/TrilhaAuditoriaRiscos';
import { HistoricoAvaliacoesDialog } from '@/components/riscos/HistoricoAvaliacoesDialog';
import { AprovacaoRiscoDialog } from '@/components/riscos/AprovacaoRiscoDialog';
import { exportRiscosPDF, exportRiscosCSV } from '@/components/riscos/ExportRiscosPDF';
import { useLanguage } from '@/contexts/LanguageContext';

interface Risco {
  id: string;
  nome: string;
  descricao?: string;
  matriz_id?: string;
  categoria_id?: string;
  probabilidade_inicial?: string;
  impacto_inicial?: string;
  probabilidade_residual?: string;
  impacto_residual?: string;
  nivel_risco_inicial: string;
  nivel_risco_residual?: string;
  status: string;
  responsavel?: string;
  responsavel_nome?: string;
  responsavel_foto?: string;
  controles_existentes?: string;
  causas?: string;
  consequencias?: string;
  aceito: boolean;
  justificativa_aceite?: string;
  categoria?: { nome: string; cor?: string };
  matriz?: { nome: string };
  created_at: string;
  tratamentos_count?: number;
  data_proxima_revisao?: string;
  status_aprovacao?: string;
  aprovador_id?: string;
  historico_aprovacao?: any;
  created_by?: string;
}


interface MatrizConfig {
  niveis_risco: Array<{ min: number; max: number; nivel: string; cor?: string }>;
}

export function Riscos() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();
  const { data: stats, refetch: refetchStats } = useRiscosStats();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
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
  
  // Novos estados para dialogs
  const [auditRisco, setAuditRisco] = useState<Risco | null>(null);
  const [historicoRisco, setHistoricoRisco] = useState<Risco | null>(null);
  const [aprovacaoRisco, setAprovacaoRisco] = useState<Risco | null>(null);

  // Drawer de detalhe
  const [drawerRiscoId, setDrawerRiscoId] = useState<string | null>(null);
  const [matrixCell, setMatrixCell] = useState<{ p: number; i: number } | undefined>();

  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // React Query for riscos
  const { data: riscos = [], isLoading: loading } = useQuery({
    queryKey: ['riscos', profile?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos')
        .select(`
          id, nome, descricao, matriz_id, categoria_id,
          probabilidade_inicial, impacto_inicial,
          probabilidade_residual, impacto_residual,
          nivel_risco_inicial, nivel_risco_residual,
          status, responsavel, controles_existentes,
          causas, consequencias, aceito, justificativa_aceite,
          created_at, data_proxima_revisao,
          status_aprovacao, aprovador_id, historico_aprovacao,
          categoria:riscos_categorias(nome, cor),
          matriz:riscos_matrizes(nome)
        `)
        .eq('empresa_id', profile!.empresa_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar contagem de tratamentos
      const riscoIds = data?.map(r => r.id) || [];
      let tratamentosCount: Record<string, number> = {};
      
      if (riscoIds.length > 0) {
        const { data: tratamentos } = await supabase
          .from('riscos_tratamentos')
          .select('risco_id')
          .in('risco_id', riscoIds);
        
        tratamentosCount = (tratamentos || []).reduce((acc, t) => {
          acc[t.risco_id] = (acc[t.risco_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
      
      if (data && data.length > 0) {
        const normalizedData = data.map(risco => ({
          ...risco,
          categoria: Array.isArray(risco.categoria) && risco.categoria.length > 0 
            ? risco.categoria[0] 
            : risco.categoria,
          tratamentos_count: tratamentosCount[risco.id] || 0
        }));

        const responsavelIds = normalizedData
          .map(r => r.responsavel)
          .filter(r => r && r.trim() !== '');
        
        if (responsavelIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, nome, foto_url')
            .in('user_id', responsavelIds);
          
          const profileMap = new Map(
            profiles?.map(p => [p.user_id, { nome: p.nome, foto_url: p.foto_url }]) || []
          );
          
          return normalizedData.map(risco => {
            const profileData = (risco.responsavel && risco.responsavel.trim() !== '') 
              ? profileMap.get(risco.responsavel) 
              : null;
            return {
              ...risco,
              responsavel_nome: profileData?.nome || null,
              responsavel_foto: profileData?.foto_url || null
            };
          });
        }
        
        return normalizedData;
      }
      
      return data || [];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 1000 * 60 * 2,
  });

  // React Query for matriz config
  const { data: matrizConfig = null } = useQuery({
    queryKey: ['riscos-matriz-config', profile?.empresa_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('riscos_matriz_configuracao')
        .select('niveis_risco')
        .limit(1)
        .single();

      if (data) {
        return {
          niveis_risco: data.niveis_risco as Array<{ min: number; max: number; nivel: string; cor?: string }>
        } as MatrizConfig;
      }
      return null;
    },
    enabled: !!profile?.empresa_id,
    staleTime: 1000 * 60 * 5,
  });

  const invalidateRiscos = () => {
    queryClient.invalidateQueries({ queryKey: ['riscos'] });
    refetchStats();
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
    const matchesStatus = !statusFilter || statusFilter === 'all' || risco.status === statusFilter;
    const matchesNivel = !nivelFilter || nivelFilter === 'all' || risco.nivel_risco_inicial === nivelFilter;
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
        .eq('id', riscoToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Risco excluído com sucesso!",
      });
      setDeleteDialogOpen(false);
      setRiscoToDelete(null);
      invalidateRiscos();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao excluir risco: " + error.message,
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setEditingRisco(null);
    setRiscoDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    setRiscoDialogOpen(false);
    setEditingRisco(null);
    invalidateRiscos();
  };

  const handleMatrizDialogSuccess = () => {
    setMatrizDialogOpen(false);
    invalidateRiscos();
    queryClient.invalidateQueries({ queryKey: ['riscos-matriz-config'] });
  };

  const handleCategoriasDialogSuccess = () => {
    setCategoriasDialogOpen(false);
    invalidateRiscos();
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
      return <StatusBadge size="sm" {...resolveRevisaoTone(dias)}>Vencida</StatusBadge>;
    }
    if (dias <= 7) {
      return <StatusBadge size="sm" {...resolveRevisaoTone(dias)}>{dias}d</StatusBadge>;
    }
    return null;
  };

  const getAprovacaoBadge = (status?: string) => {
    if (!status || status === 'nao_requerido') return null;
    const labels: Record<string, string> = { aprovado: 'Aprovado', rejeitado: 'Rejeitado', pendente: 'Pendente' };
    if (!labels[status]) return null;
    return <StatusBadge size="sm" {...resolveAprovacaoTone(status)}>{labels[status]}</StatusBadge>;
  };

  // Função para calcular variação percentual
  const calcTrend = (atual: number, antigo: number | null | undefined): { value: number; direction: 'up' | 'down' | 'neutral' } | undefined => {
    if (antigo === null || antigo === undefined || antigo === 0) return undefined;
    const diff = ((atual - antigo) / antigo) * 100;
    const rounded = Math.round(Math.abs(diff));
    if (rounded === 0) return undefined;
    return { value: rounded, direction: diff > 0 ? 'up' : 'down' };
  };

  // Mini sparkline SVG component
  const MiniSparkline = ({ trend, color }: { trend?: { direction: 'up' | 'down' | 'neutral' }; color: string }) => {
    const upPath = "M0,14 L4,12 L8,10 L12,8 L16,11 L20,7 L24,5 L28,3";
    const downPath = "M0,3 L4,5 L8,7 L12,5 L16,8 L20,10 L24,12 L28,14";
    const flatPath = "M0,8 L4,9 L8,7 L12,8 L16,9 L20,7 L24,8 L28,8";
    const path = trend?.direction === 'up' ? upPath : trend?.direction === 'down' ? downPath : flatPath;
    return (
      <svg width="32" height="16" viewBox="0 0 28 16" className="opacity-60">
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AkurisPulse size={48} />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
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
      key: 'nome',
      label: 'Nome',
      sortable: true,
      render: (value: any, risco: Risco) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDrawerRiscoId(risco.id); }}
          className="font-medium text-left hover:text-primary transition-colors"
        >
          {value}
        </button>
      )
    },
    {
      key: 'categoria',
      label: 'Categoria',
      render: (value: any) => value ? (
        <div className="flex items-center gap-2">
          {value.cor && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: value.cor }} />}
          <span className="text-sm">{value.nome}</span>
        </div>
      ) : '-'
    },
    {
      key: 'nivel_risco_inicial',
      label: 'Nível Inicial',
      render: (value: string) => (
        <StatusBadge size="sm" {...resolveNivelRiscoTone(value)}>{formatStatus(value)}</StatusBadge>
      )
    },
    {
      key: 'nivel_risco_residual',
      label: 'Nível Residual',
      render: (value: string) => value ? (
        <StatusBadge size="sm" {...resolveNivelRiscoTone(value)}>{formatStatus(value)}</StatusBadge>
      ) : <StatusBadge size="sm" tone="neutral">Não avaliado</StatusBadge>
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <StatusBadge size="sm" {...resolveRiscoStatusTone(value)}>{formatStatus(value)}</StatusBadge>
      )
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (_value: any, risco: Risco) => {
        const tags: React.ReactNode[] = [];
        const aprovBadge = getAprovacaoBadge(risco.status_aprovacao);
        if (aprovBadge) tags.push(<span key="aprov">{aprovBadge}</span>);
        if (risco.aceito) tags.push(<StatusBadge key="aceito" size="sm" tone="warning" icon={<ShieldCheck strokeWidth={1.5} className="h-3 w-3" />}>Aceito</StatusBadge>);
        const revBadge = getRevisaoBadge(risco.data_proxima_revisao);
        if (revBadge) tags.push(<span key="rev">{revBadge}</span>);

        if (tags.length === 0) return <span className="text-muted-foreground text-sm">-</span>;
        
        const visible = tags.slice(0, 2);
        const extra = tags.length - 2;
        
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {visible}
            {extra > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{extra}</Badge>
            )}
          </div>
        );
      }
    },
    {
      key: 'tratamentos_count',
      label: 'Tratam.',
      className: 'text-center',
      render: (value: number, risco: Risco) => (
        <Button variant="ghost" size="sm" className="flex items-center gap-1" onClick={() => openTratamentosDialog(risco)}>
          <Shield className="h-4 w-4" />
          <Badge variant={value > 0 ? "default" : "outline"} className="ml-1">{value || 0}</Badge>
        </Button>
      )
    },
    {
      key: 'responsavel',
      label: 'Resp.',
      render: (value: string, risco: Risco) => {
        if (risco.responsavel_nome) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    {risco.responsavel_foto && <AvatarImage src={risco.responsavel_foto} alt={risco.responsavel_nome} />}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {risco.responsavel_nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent><p>{risco.responsavel_nome}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return '-';
      }
    },
    {
      key: 'actions',
      label: 'Ações',
      className: 'w-[60px]',
      render: (value: any, risco: Risco) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(risco)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTratamentosDialog(risco)}>
              <Shield className="mr-2 h-4 w-4" />
              Tratamentos ({risco.tratamentos_count || 0})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAprovacaoRisco(risco)}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Aprovação
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHistoricoRisco(risco)}>
              <Clock className="mr-2 h-4 w-4" />
              Histórico Avaliações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAuditRisco(risco)}>
              <History className="mr-2 h-4 w-4" />
              Trilha de Auditoria
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDeleteDialog(risco)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const filters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'identificado', label: 'Identificado' },
        { value: 'analisado', label: 'Analisado' },
        { value: 'em_tratamento', label: 'Em Tratamento' },
        { value: 'tratado', label: 'Tratado' },
        { value: 'monitorado', label: 'Monitorado' },
        { value: 'aceito', label: 'Aceito' }
      ],
      value: statusFilter,
      onChange: (value: string) => setStatusFilter(value === 'all' ? '' : value)
    },
    {
      key: 'nivel',
      label: 'Nível',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'Crítico', label: 'Crítico' },
        { value: 'Muito Alto', label: 'Muito Alto' },
        { value: 'Alto', label: 'Alto' },
        { value: 'Médio', label: 'Médio' },
        { value: 'Baixo', label: 'Baixo' },
        { value: 'Muito Baixo', label: 'Muito Baixo' }
      ],
      value: nivelFilter,
      onChange: (value: string) => setNivelFilter(value === 'all' ? '' : value)
    },
    {
      key: 'aceito',
      label: 'Aceito',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'aceito', label: 'Aceitos' },
        { value: 'nao_aceito', label: 'Não Aceitos' }
      ],
      value: aceitoFilter,
      onChange: (value: string) => setAceitoFilter(value === 'all' ? '' : value)
    }
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title={t('modules.riscos.title')}
          description={t('modules.riscos.description')}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            const totalTrend = calcTrend(stats?.total || 0, stats?.total_7d_atras);
            const tratConcTrend = calcTrend(stats?.tratamentos_concluidos || 0, stats?.tratamentos_concluidos_7d_atras);
            const aceitosTrend = calcTrend(stats?.aceitos || 0, stats?.aceitos_7d_atras);
            return (
              <>
                <StatCard
                  title={t('modules.riscos.total')}
                  value={stats?.total || 0}
                  icon={<AlertTriangle />}
                  variant={stats?.criticos ? "destructive" : "default"}
                  loading={!stats}
                  drillDown="riscos"
                  segments={[
                    { label: 'críticos', value: stats?.criticos || 0, tone: 'destructive' },
                    { label: 'altos', value: stats?.altos || 0, tone: 'warning' },
                    { label: 'demais', value: Math.max(0, (stats?.total || 0) - (stats?.criticos || 0) - (stats?.altos || 0)), tone: 'neutral' },
                  ]}
                  trend={totalTrend ? { value: totalTrend.value, direction: totalTrend.direction, period: '7d' } : undefined}
                  showAccent
                  emptyHint="Cadastre riscos para começar a monitorar."
                />
                <StatCard
                  title="Tratamentos Concluídos"
                  value={stats?.tratamentos_concluidos || 0}
                  description={`${stats?.tratamentos_andamento || 0} em andamento`}
                  icon={<TrendingUp />}
                  variant="success"
                  loading={!stats}
                  drillDown="planos"
                  trend={tratConcTrend ? { value: tratConcTrend.value, direction: tratConcTrend.direction, period: '7d' } : undefined}
                />
                <StatCard
                  title="Riscos Aceitos"
                  value={stats?.aceitos || 0}
                  description="Aceitos formalmente"
                  icon={<CheckCircle />}
                  variant="warning"
                  loading={!stats}
                  drillDown="riscos_aceite"
                  trend={aceitosTrend ? { value: aceitosTrend.value, direction: aceitosTrend.direction, period: '7d' } : undefined}
                />
                <RiskScoreCard stats={stats} loading={!stats} />
              </>
            );
          })()}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {idsFilter.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap">
                Filtro da Matriz ({idsFilter.length})
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent" onClick={clearIdsFilter}>
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportRiscosCSV(sortedRiscos)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRiscosPDF(sortedRiscos, stats)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setCategoriasDialogOpen(true)} className="whitespace-nowrap">
              <Tag className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Categorias</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMatrizDialogOpen(true)} className="whitespace-nowrap">
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Matriz</span>
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Risco</span>
            </Button>
          </div>
        </div>

        {/* DataTable */}
        <Card className="rounded-lg border overflow-hidden">
          <CardContent className="p-0">
            <DataTable
              data={sortedRiscos}
              columns={riscoColumns as Column<Risco>[]}
              loading={loading}
              searchable
              searchPlaceholder="Buscar riscos..."
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              filters={filters}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              emptyState={{
                icon: <AlertTriangle className="h-8 w-8" />,
                title: searchTerm || statusFilter !== '' || nivelFilter !== '' || aceitoFilter !== ''
                  ? 'Nenhum risco encontrado'
                  : 'Nenhum risco cadastrado',
                description: searchTerm || statusFilter !== '' || nivelFilter !== '' || aceitoFilter !== ''
                  ? 'Tente ajustar os filtros para encontrar o que procura.'
                  : 'Comece identificando e cadastrando os riscos da sua organização.',
                action: !searchTerm && statusFilter === '' && nivelFilter === '' && aceitoFilter === '' ? {
                  label: 'Cadastrar Primeiro Risco',
                  onClick: openCreateDialog
                } : undefined
              }}
            />
          </CardContent>
        </Card>
        
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

        <CategoriasDialog
          open={categoriasDialogOpen}
          onOpenChange={setCategoriasDialogOpen}
          onSuccess={handleCategoriasDialogSuccess}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Risco"
          description={`Tem certeza que deseja excluir o risco "${riscoToDelete?.nome}"? Esta ação não pode ser desfeita.`}
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

      </div>
    </TooltipProvider>
  );
}
