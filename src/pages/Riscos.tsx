import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Plus, AlertTriangle, Shield, Settings, Tag, X, Clock, FileText, Download, MoreHorizontal, Edit, Trash2, History, ShieldCheck, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/ui/data-table';
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
import { RiscoAnexosIcone } from '@/components/riscos/RiscoAnexosIcone';
import { RiscosTabs } from '@/components/riscos/RiscosTabs';
import RiscosAceite from '@/pages/RiscosAceite';
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
import { RiscosViewChips, type SavedView } from '@/components/riscos/table/RiscosViewChips';
import { SparklineCell } from '@/components/riscos/table/SparklineCell';
import { SlaCell } from '@/components/riscos/table/SlaCell';
import { isAcimaApetite, severityFromNivel, slaFromRevisao, scoreFromPI, shortRiskId, relativeShort, toScaleNumber, formatScaleValue } from '@/components/riscos/risk-utils';


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
  niveis_risco: Array<{ min: number; max: number; nivel: string; cor?: string; apetite?: boolean }>;
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
  const [matrixMode, setMatrixMode] = useState<'inerente' | 'residual'>('inerente');

  // Saved view chips (apenas para a aba Tabela)
  const [savedView, setSavedView] = useState<SavedView>('todos');

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
        .eq('id', riscoToDelete.id)
        .eq('empresa_id', profile!.empresa_id);

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

  // (calcTrend e MiniSparkline removidos com os KPI cards antigos)

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
      key: 'id',
      label: 'ID',
      className: 'w-[72px]',
      render: (_value: any, risco: Risco) => (
        <span className="font-mono text-[11px] text-muted-foreground">{shortRiskId(risco.id)}</span>
      ),
    },
    {
      key: 'nome',
      label: 'Risco',
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
      label: 'Categoria',
      render: (value: any) => value ? <span className="text-xs text-foreground/85">{value.nome}</span> : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'nivel_risco_inicial',
      label: 'Severidade',
      render: (value: string) => (
        <StatusBadge size="sm" {...resolveNivelRiscoTone(value)}>{formatStatus(value)}</StatusBadge>
      ),
    },
    {
      key: 'pi',
      label: 'P × I',
      className: 'w-[70px]',
      render: (_v: any, r: Risco) => (
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {formatScaleValue(r.probabilidade_inicial)} × {formatScaleValue(r.impacto_inicial)}
        </span>
      ),
    },
    {
      key: 'trend',
      label: 'Tend.',
      className: 'w-[60px]',
      render: (_v: any, r: Risco) => (
        <SparklineCell
          probInicial={r.probabilidade_inicial}
          impInicial={r.impacto_inicial}
          probResidual={r.probabilidade_residual}
          impResidual={r.impacto_residual}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <StatusBadge size="sm" {...resolveRiscoStatusTone(value)}>{formatStatus(value)}</StatusBadge>
      ),
    },
    {
      key: 'responsavel',
      label: 'Resp.',
      render: (_value: string, risco: Risco) => {
        if (!risco.responsavel_nome) return <span className="text-xs text-muted-foreground">—</span>;
        const last = risco.responsavel_nome.split(' ').slice(-1)[0];
        return (
          <div className="inline-flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              {risco.responsavel_foto && <AvatarImage src={risco.responsavel_foto} alt={risco.responsavel_nome} />}
              <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                {risco.responsavel_nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-foreground/85">{last}</span>
          </div>
        );
      },
    },
    {
      key: 'updated',
      label: 'Atualizado',
      className: 'w-[96px]',
      render: (_v: any, r: Risco) => (
        <span className="text-[11px] text-muted-foreground">{relativeShort((r as any).updated_at || r.created_at)}</span>
      ),
    },
    {
      key: 'sla',
      label: 'SLA',
      className: 'w-[90px]',
      render: (_v: any, r: Risco) => <SlaCell dataProximaRevisao={r.data_proxima_revisao} />,
    },
    {
      key: 'actions',
      label: 'Ações',
      className: 'w-[60px]',
      render: (value: any, risco: Risco) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(risco)}>
              <Edit className="mr-2 h-4 w-4" strokeWidth={1.5} /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTratamentosDialog(risco)}>
              <Shield className="mr-2 h-4 w-4" strokeWidth={1.5} /> Tratamentos ({risco.tratamentos_count || 0})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAprovacaoRisco(risco)}>
              <ShieldCheck className="mr-2 h-4 w-4" strokeWidth={1.5} /> Aprovação
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHistoricoRisco(risco)}>
              <Clock className="mr-2 h-4 w-4" strokeWidth={1.5} /> Histórico Avaliações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAuditRisco(risco)}>
              <History className="mr-2 h-4 w-4" strokeWidth={1.5} /> Trilha de Auditoria
            </DropdownMenuItem>
            <CriarTarefaMenuItem
              entidadeTipo="risco"
              entidadeId={risco.id}
              tituloSugerido={`Tratar risco: ${risco.nome ?? ''}`}
            />
            <DropdownMenuItem onClick={() => openDeleteDialog(risco)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
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
      <div className="space-y-5">
        <PageHeader
          title={t('modules.riscos.title')}
          description={t('modules.riscos.description')}
        />

        {/* KPI cards antigos removidos — KPIs agora vivem dentro das abas (Visão geral / Matriz). */}

        {/* Toolbar global */}
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
                  <Download className="h-4 w-4 sm:mr-2" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportRiscosCSV(sortedRiscos)}>
                  <FileText className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRiscosPDF(sortedRiscos, stats)}>
                  <FileText className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setCategoriasDialogOpen(true)} className="whitespace-nowrap">
              <Tag className="h-4 w-4 sm:mr-2" strokeWidth={1.5} />
              <span className="hidden sm:inline">Categorias</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMatrizDialogOpen(true)} className="whitespace-nowrap" title="Configurar matriz de risco">
              <Settings className="h-4 w-4 sm:mr-2" strokeWidth={1.5} />
              <span className="hidden sm:inline">Configurar Matriz</span>
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 sm:mr-2" strokeWidth={1.5} />
              <span className="hidden sm:inline">Novo Risco</span>
            </Button>
          </div>
        </div>

        {(() => {
          // Derivações compartilhadas para Visão geral e Matriz
          // Apetite score = max do nível marcado como limite de apetite na config da
          // matriz (fallback: nível "médio", para matrizes sem a marcação).
          const apetiteScore: number | null = (() => {
            const niveis = matrizConfig?.niveis_risco;
            if (!niveis) return null;
            const norm = (s?: string) => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
            const lvl = niveis.find((n) => n.apetite) || niveis.find((n) => norm(n.nivel) === 'medio');
            return lvl ? lvl.max : null;
          })();
          const acimaApetite = riscos.filter((r) => isAcimaApetite(r, apetiteScore)).length;
          // Alinhado à coluna Resp. da tabela: conta riscos sem nome de responsável
          // resolvido (um ID que não resolve para um perfil também aparece como "—").
          const semResponsavel = riscos.filter((r) => !r.responsavel_nome).length;
          const revisaoVencida = riscos.filter((r) => slaFromRevisao(r.data_proxima_revisao) === 'vencido').length;
          const emTratamento = riscos.filter((r) => r.status === 'em_tratamento').length;

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
            ? riscos.filter((r) => {
                const p = toScaleNumber(matrixMode === 'residual' ? r.probabilidade_residual : r.probabilidade_inicial);
                const i = toScaleNumber(matrixMode === 'residual' ? r.impacto_residual : r.impacto_inicial);
                return p === matrixCell.p && i === matrixCell.i;
              })
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
              <RiskKpiQuad
                items={[
                  { label: 'Acima do apetite', value: acimaApetite, sub: 'Alto ou Crítico', cta: 'Ver na matriz', tone: 'destructive', onClick: () => {
                    const sp = new URLSearchParams(searchParams); sp.set('view', 'matrix'); setSearchParams(sp);
                  }},
                  { label: 'Sem responsável', value: semResponsavel, sub: 'Aguardando atribuição', cta: 'Atribuir agora', tone: 'amber', onClick: () => {
                    const sp = new URLSearchParams(searchParams); sp.set('view', 'table'); setSearchParams(sp);
                  }},
                  { label: 'Revisão vencida', value: revisaoVencida, sub: 'SLA estourado', cta: 'Reavaliar', tone: 'warning', onClick: () => {
                    const sp = new URLSearchParams(searchParams); sp.set('view', 'table'); setSearchParams(sp);
                  }},
                  { label: 'Em tratamento', value: emTratamento, sub: 'Plano em execução', cta: 'Ver tratamentos', tone: 'success', onClick: () => {
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
                    onOpenRisk={(id) => setDrawerRiscoId(id)}
                    mode={matrixMode}
                    onModeChange={(m) => { setMatrixMode(m); setMatrixCell(undefined); }}
                  />
                  <AppetiteFooter apetiteScore={apetiteScore} acimaCount={acimaApetite} />
                </div>
                {matrixCell && (
                  <HeatmapCellPanel
                    cell={matrixCell}
                    risks={cellRisks as any}
                    onOpenRisk={(id) => setDrawerRiscoId(id)}
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
            { id: 'todos' as SavedView, label: 'Todos', count: sortedRiscos.length },
            { id: 'acima_apetite' as SavedView, label: 'Acima do apetite', count: sortedRiscos.filter(viewFilters.acima_apetite).length },
            { id: 'sem_responsavel' as SavedView, label: 'Sem responsável', count: sortedRiscos.filter(viewFilters.sem_responsavel).length },
            { id: 'revisao_vencida' as SavedView, label: 'Revisão vencida', count: sortedRiscos.filter(viewFilters.revisao_vencida).length },
            { id: 'meus_riscos' as SavedView, label: 'Meus riscos', count: sortedRiscos.filter(viewFilters.meus_riscos).length },
          ];

          const tableNode = (
            <div className="space-y-3">
              <RiscosViewChips active={savedView} onChange={setSavedView} items={viewItems} />
              <Card className="rounded-lg border overflow-hidden">
                <CardContent className="p-0">
                  <DataTable
                    data={viewedRiscos}
                    columns={riscoColumns as Column<Risco>[]}
                    loading={loading}
                    searchable
                    searchPlaceholder="Buscar por nome ou ID…"
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    filters={filters}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    emptyState={{
                      icon: <AlertTriangle className="h-8 w-8" />,
                      title: searchTerm || statusFilter || nivelFilter || aceitoFilter || savedView !== 'todos'
                        ? 'Nenhum risco encontrado'
                        : 'Nenhum risco cadastrado',
                      description: searchTerm || statusFilter || nivelFilter || aceitoFilter || savedView !== 'todos'
                        ? 'Tente ajustar os filtros ou a visão ativa.'
                        : 'Comece identificando e cadastrando os riscos da sua organização.',
                      action: !searchTerm && !statusFilter && !nivelFilter && !aceitoFilter && savedView === 'todos' ? {
                        label: 'Cadastrar Primeiro Risco',
                        onClick: openCreateDialog,
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

        {/* Drawer de detalhe (global, abre via tabela / watchlist / heatmap) */}
        <RiscoDetailDrawer
          risco={(riscos.find((r) => r.id === drawerRiscoId) as Risco) || null}
          open={!!drawerRiscoId}
          onOpenChange={(o) => !o && setDrawerRiscoId(null)}
          onEdit={(r) => { setDrawerRiscoId(null); handleEdit(r); }}
          onAccept={(r) => { setDrawerRiscoId(null); setAprovacaoRisco(r); }}
          onOpenTratamentos={(r) => { setDrawerRiscoId(null); openTratamentosDialog(r); }}
        />

      </div>
    </TooltipProvider>
  );
}
