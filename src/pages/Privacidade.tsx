import { useState, useEffect } from "react";
import { logger } from '@/lib/logger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Plus, Database, Users, AlertTriangle, Edit, Trash2, Link2, FileText, Eye, Clock, ShieldAlert, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DadosPessoaisDialog } from "@/components/dados/DadosPessoaisDialog";
import { MapeamentoDialog } from "@/components/dados/MapeamentoDialog";
import { RopaWizard } from "@/components/dados/RopaWizard";
import { RopaDialog } from "@/components/dados/RopaDialog";
import { SolicitacaoTitularDialog } from "@/components/dados/SolicitacaoTitularDialog";
import { DescoberDadosTab } from "@/components/dados/DescoberDadosTab";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveSensibilidadeTone, resolveItemStatusTone, resolveWorkflowStatusTone } from '@/lib/status-tone';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Privacidade() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("catalogo");
  const [showDadosDialog, setShowDadosDialog] = useState(false);
  const [showMapeamentoDialog, setShowMapeamentoDialog] = useState(false);
  const [showRopaWizard, setShowRopaWizard] = useState(false);
  const [showRopaDialog, setShowRopaDialog] = useState(false);
  const [showSolicitacaoDialog, setShowSolicitacaoDialog] = useState(false);
  const [selectedDado, setSelectedDado] = useState<any>(null);
  const [selectedRopa, setSelectedRopa] = useState<any>(null);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<any>(null);
  const [showDadoSheet, setShowDadoSheet] = useState(false);
  const [preSelectedDadoId, setPreSelectedDadoId] = useState<string | undefined>();
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; type: string }>({
    open: false,
    id: '',
    type: ''
  });
  
  // States for Catálogo tab DataTable
  const [catalogoSortField, setCatalogoSortField] = useState<string>("");
  const [catalogoSortDirection, setCatalogoSortDirection] = useState<"asc" | "desc">("asc");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [sensibilidadeFilter, setSensibilidadeFilter] = useState("todos");
  
  // States for ROPA tab DataTable
  const [searchRopaTerm, setSearchRopaTerm] = useState("");
  const [statusRopaFilter, setStatusRopaFilter] = useState("todos");
  const [baseLegalFilter, setBaseLegalFilter] = useState("todos");
  const [sortRopaField, setSortRopaField] = useState<string>("");
  const [sortRopaDirection, setSortRopaDirection] = useState<"asc" | "desc">("asc");
  
  // States for Solicitações tab DataTable
  const [searchSolicitacoesTerm, setSearchSolicitacoesTerm] = useState("");
  const [statusSolicitacoesFilter, setStatusSolicitacoesFilter] = useState("todos");
  const [tipoSolicitacaoFilter, setTipoSolicitacaoFilter] = useState("todos");
  const [sortSolicitacoesField, setSortSolicitacoesField] = useState<string>("");
  const [sortSolicitacoesDirection, setSortSolicitacoesDirection] = useState<"asc" | "desc">("asc");
  
  const { toast } = useToast();

  // React Query for all privacy data
  const { data: privacidadeData, isLoading } = useQuery({
    queryKey: ['privacidade', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      
      const dadosRes = await supabase.from('dados_pessoais').select('*').eq('empresa_id', empresaId).order('nome');
      const mapeamentosRes = await (supabase.from('dados_mapeamento' as any).select('id, dados_pessoais_id') as any).eq('empresa_id', empresaId);
      const ropaRes = await supabase.from('ropa_registros').select('*').eq('empresa_id', empresaId).order('nome_tratamento');
      const solicitacoesRes = await supabase.from('dados_solicitacoes_titular').select('*').eq('empresa_id', empresaId).order('data_solicitacao', { ascending: false });
      const dadosIds = (dadosRes.data || []).map((d: any) => d.id);
      const ropaDadosRes = dadosIds.length > 0
        ? await supabase.from('ropa_dados_vinculados').select('id, dados_pessoais_id').in('dados_pessoais_id', dadosIds)
        : { data: [] };
      const incidentesRes = await (supabase.from('incidentes').select('id') as any).eq('tipo', 'privacidade').eq('empresa_id', empresaId).in('status', ['aberto', 'investigacao', 'contido']);

      const mapeamentosCounts: Record<string, number> = {};
      (mapeamentosRes.data || []).forEach((m: any) => {
        mapeamentosCounts[m.dados_pessoais_id] = (mapeamentosCounts[m.dados_pessoais_id] || 0) + 1;
      });
      
      const ropasCounts: Record<string, number> = {};
      (ropaDadosRes.data || []).forEach((r: any) => {
        ropasCounts[r.dados_pessoais_id] = (ropasCounts[r.dados_pessoais_id] || 0) + 1;
      });

      const dadosEnriquecidos = (dadosRes.data || []).map((dado: any) => ({
        ...dado,
        mapeamentos_count: mapeamentosCounts[dado.id] || 0,
        ropas_count: ropasCounts[dado.id] || 0
      }));

      const dados = dadosRes.data || [];
      const sensiveis = dados.filter((d: any) => d.tipo_dados === 'sensivel' || d.sensibilidade === 'muito_sensivel' || d.sensibilidade === 'sensivel').length;
      const allSolicitacoes = solicitacoesRes.data || [];
      const pendentes = allSolicitacoes.filter((s: any) => s.status === 'pendente').length;
      
      const hoje = new Date();
      const foraPrazo = allSolicitacoes.filter((s: any) => {
        if (s.status === 'atendida' || s.status === 'rejeitada') return false;
        const prazo = s.prazo_resposta ? new Date(s.prazo_resposta) : null;
        return prazo && prazo < hoje;
      }).length;

      return {
        dadosPessoais: dadosEnriquecidos,
        ropaRegistros: ropaRes.data || [],
        solicitacoes: allSolicitacoes,
        incidentesPrivacidade: (incidentesRes.data || []).length,
        solicitacoesForaPrazo: foraPrazo,
        stats: {
          totalDados: dados.length,
          dadosSensiveis: sensiveis,
          mapeamentos: (mapeamentosRes.data || []).length,
          ropaAtivos: (ropaRes.data || []).filter((r: any) => r.status === 'ativo').length,
          solicitacoesPendentes: pendentes
        }
      };
    },
    enabled: !!empresaId,
  });

  const dadosPessoais = privacidadeData?.dadosPessoais || [];
  const ropaRegistros = privacidadeData?.ropaRegistros || [];
  const solicitacoes = privacidadeData?.solicitacoes || [];
  const incidentesPrivacidade = privacidadeData?.incidentesPrivacidade || 0;
  const solicitacoesForaPrazo = privacidadeData?.solicitacoesForaPrazo || 0;
  const stats = privacidadeData?.stats || {
    totalDados: 0,
    dadosSensiveis: 0,
    mapeamentos: 0,
    ropaAtivos: 0,
    solicitacoesPendentes: 0
  };

  const invalidatePrivacidade = () => {
    queryClient.invalidateQueries({ queryKey: ['privacidade'] });
  };

  const getSensibilidadeBadge = (tipo: string, sensibilidade: string) => {
    // Nível efetivo: tipo_dados 'sensivel' garante ao menos "Sensível"
    let nivel = sensibilidade || 'comum';
    if (tipo === 'sensivel' && nivel === 'comum') nivel = 'sensivel';
    const labels: Record<string, string> = {
      muito_sensivel: t('sweepDados.privacidade.sensibilidade.muitoSensivel'),
      sensivel: t('sweepDados.privacidade.sensibilidade.sensivel'),
      moderado: t('sweepDados.privacidade.sensibilidade.moderado'),
      comum: t('sweepDados.privacidade.sensibilidade.comum'),
    };
    return <StatusBadge size="sm" {...resolveSensibilidadeTone(nivel)}>{labels[nivel] || t('sweepDados.privacidade.sensibilidade.comum')}</StatusBadge>;
  };

  const getStatusBadge = (status: string) => {
    const isWorkflow = ['pendente', 'em_analise', 'atendida', 'rejeitada'].includes(status);
    const tone = isWorkflow ? resolveWorkflowStatusTone(status) : resolveItemStatusTone(status);
    return <StatusBadge size="sm" {...tone}>{formatStatus(status)}</StatusBadge>;
  };

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      identificacao: t('sweepDados.privacidade.categoria.identificacao'),
      contato: t('sweepDados.privacidade.categoria.contato'),
      localizacao: t('sweepDados.privacidade.categoria.localizacao'),
      financeiro: t('sweepDados.privacidade.categoria.financeiro'),
      saude: t('sweepDados.privacidade.categoria.saude'),
      biometrico: t('sweepDados.privacidade.categoria.biometrico'),
      comportamental: t('sweepDados.privacidade.categoria.comportamental'),
      outros: t('sweepDados.privacidade.categoria.outros')
    };
    return labels[categoria] || formatStatus(categoria);
  };

  // Catálogo DataTable columns
  const catalogoColumns = [
    {
      key: 'nome',
      label: t('sweepDados.privacidade.colNome'),
      sortable: true,
      render: (value: string, row: any) => (
        <div>
          <span className="font-medium cursor-pointer hover:text-primary" onClick={() => {
            setSelectedDado(row);
            setShowDadoSheet(true);
          }}>{value}</span>
          {row.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{row.descricao}</p>
          )}
        </div>
      )
    },
    {
      key: 'categoria_dados',
      label: t('sweepDados.privacidade.colCategoria'),
      sortable: true,
      render: (value: string) => <Badge variant="outline">{getCategoriaLabel(value)}</Badge>
    },
    {
      key: 'sensibilidade',
      label: t('sweepDados.privacidade.colSensibilidade'),
      sortable: true,
      render: (value: string, row: any) => getSensibilidadeBadge(row.tipo_dados, value)
    },
    {
      key: 'base_legal',
      label: t('sweepDados.privacidade.colBaseLegal'),
      sortable: true,
      render: (value: string) => value ? <Badge variant="secondary">{formatStatus(value)}</Badge> : <span className="text-muted-foreground">-</span>
    },
    {
      key: 'mapeamentos_count',
      label: t('sweepDados.privacidade.colMapeamentos'),
      sortable: true,
      render: (value: number) => value > 0 ? (
        <Badge variant="secondary">{value}</Badge>
      ) : <span className="text-muted-foreground">0</span>
    },
    {
      key: 'ropas_count',
      label: t('sweepDados.privacidade.colRopas'),
      sortable: true,
      render: (value: number) => value > 0 ? (
        <Badge variant="secondary">{value}</Badge>
      ) : <span className="text-muted-foreground">0</span>
    },
    {
      key: 'actions',
      label: t('sweepDados.privacidade.colAcoes'),
      render: (_: any, row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowDadoSheet(true); }}>
              <Eye className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.verDetalhes')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowDadosDialog(true); }}>
              <Edit className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.editar')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowMapeamentoDialog(true); }}>
              <Link2 className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.mapear')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPreSelectedDadoId(row.id); setShowRopaWizard(true); }}>
              <FileText className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.criarRopa')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(row.id, 'dados')} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.excluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const catalogoFilters = [
    {
      key: 'categoria_dados',
      label: t('sweepDados.privacidade.colCategoria'),
      type: 'select' as const,
      options: [
        { value: 'identificacao', label: t('sweepDados.privacidade.categoria.identificacao') },
        { value: 'contato', label: t('sweepDados.privacidade.categoria.contato') },
        { value: 'localizacao', label: t('sweepDados.privacidade.categoria.localizacao') },
        { value: 'financeiro', label: t('sweepDados.privacidade.categoria.financeiro') },
        { value: 'saude', label: t('sweepDados.privacidade.categoria.saude') },
        { value: 'biometrico', label: t('sweepDados.privacidade.categoria.biometrico') },
        { value: 'comportamental', label: t('sweepDados.privacidade.categoria.comportamental') },
        { value: 'outros', label: t('sweepDados.privacidade.categoria.outros') }
      ],
      value: categoriaFilter,
      onChange: setCategoriaFilter
    },
    {
      key: 'sensibilidade',
      label: t('sweepDados.privacidade.colSensibilidade'),
      type: 'select' as const,
      options: [
        { value: 'comum', label: t('sweepDados.privacidade.sensibilidade.comum') },
        { value: 'sensivel', label: t('sweepDados.privacidade.sensibilidade.moderado') },
        { value: 'muito_sensivel', label: t('sweepDados.privacidade.sensibilidade.sensivel') }
      ],
      value: sensibilidadeFilter,
      onChange: setSensibilidadeFilter
    }
  ];

  // ROPA DataTable columns
  const ropaColumns = [
    {
      key: 'nome_tratamento',
      label: t('sweepDados.privacidade.colNomeTratamento'),
      sortable: true,
      render: (value: string) => <span className="font-medium">{value}</span>
    },
    {
      key: 'base_legal',
      label: t('sweepDados.privacidade.colBaseLegal'),
      sortable: true,
      render: (value: string) => <Badge variant="outline">{value}</Badge>
    },
    {
      key: 'categoria_titulares',
      label: t('sweepDados.privacidade.colCategoriaTitulares'),
      sortable: true,
    },
    {
      key: 'status',
      label: t('sweepDados.privacidade.colStatus'),
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'actions',
      label: t('sweepDados.privacidade.colAcoes'),
      render: (_: any, ropa: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedRopa(ropa); setShowRopaDialog(true); }}>
              <Edit className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.editar')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(ropa.id, 'ropa')} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.excluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const ropaFilters = [
    {
      key: 'status',
      label: t('sweepDados.privacidade.colStatus'),
      type: 'select' as const,
      options: [
        { value: 'ativo', label: t('sweepDados.privacidade.statusRopa.ativo') },
        { value: 'inativo', label: t('sweepDados.privacidade.statusRopa.inativo') },
        { value: 'revisao', label: t('sweepDados.privacidade.statusRopa.revisao') }
      ],
      value: statusRopaFilter,
      onChange: setStatusRopaFilter
    },
    {
      key: 'base_legal',
      label: t('sweepDados.privacidade.colBaseLegal'),
      type: 'select' as const,
      options: [
        { value: 'consentimento', label: t('sweepDados.privacidade.baseLegal.consentimento') },
        { value: 'legitimo_interesse', label: t('sweepDados.privacidade.baseLegal.legitimoInteresse') },
        { value: 'execucao_contrato', label: t('sweepDados.privacidade.baseLegal.execucaoContrato') },
        { value: 'cumprimento_obrigacao', label: t('sweepDados.privacidade.baseLegal.cumprimentoObrigacao') }
      ],
      value: baseLegalFilter,
      onChange: setBaseLegalFilter
    }
  ];

  // Solicitações DataTable columns
  const solicitacoesColumns = [
    {
      key: 'tipo_solicitacao',
      label: t('sweepDados.privacidade.colTipo'),
      sortable: true,
      render: (value: string) => <Badge variant="outline">{value}</Badge>
    },
    {
      key: 'dados_titular',
      label: t('sweepDados.privacidade.colTitular'),
      render: (value: string) => {
        try {
          const titular = JSON.parse(value);
          return titular.nome || '-';
        } catch {
          return '-';
        }
      }
    },
    {
      key: 'canal_solicitacao',
      label: t('sweepDados.privacidade.colCanal'),
      sortable: true,
    },
    {
      key: 'status',
      label: t('sweepDados.privacidade.colStatus'),
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'prazo_resposta',
      label: t('sweepDados.privacidade.colPrazo'),
      sortable: true,
      render: (value: string) => formatDateOnly(value)
    },
    {
      key: 'actions',
      label: t('sweepDados.privacidade.colAcoes'),
      render: (_: any, solicitacao: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedSolicitacao(solicitacao); setShowSolicitacaoDialog(true); }}>
              <Edit className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.editar')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(solicitacao.id, 'solicitacao')} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.excluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const solicitacoesFilters = [
    {
      key: 'status',
      label: t('sweepDados.privacidade.colStatus'),
      type: 'select' as const,
      options: [
        { value: 'pendente', label: t('sweepDados.privacidade.statusSolicitacao.pendente') },
        { value: 'em_analise', label: t('sweepDados.privacidade.statusSolicitacao.emAnalise') },
        { value: 'atendida', label: t('sweepDados.privacidade.statusSolicitacao.atendida') },
        { value: 'rejeitada', label: t('sweepDados.privacidade.statusSolicitacao.rejeitada') }
      ],
      value: statusSolicitacoesFilter,
      onChange: setStatusSolicitacoesFilter
    },
    {
      key: 'tipo_solicitacao',
      label: t('sweepDados.privacidade.colTipo'),
      type: 'select' as const,
      options: [
        { value: 'acesso', label: t('sweepDados.privacidade.tipoSolicitacao.acesso') },
        { value: 'correcao', label: t('sweepDados.privacidade.tipoSolicitacao.correcao') },
        { value: 'exclusao', label: t('sweepDados.privacidade.tipoSolicitacao.exclusao') },
        { value: 'portabilidade', label: t('sweepDados.privacidade.tipoSolicitacao.portabilidade') },
        { value: 'oposicao', label: t('sweepDados.privacidade.tipoSolicitacao.oposicao') },
        { value: 'revogacao_consentimento', label: t('sweepDados.privacidade.tipoSolicitacao.revogacaoConsentimento') }
      ],
      value: tipoSolicitacaoFilter,
      onChange: setTipoSolicitacaoFilter
    }
  ];

  const handleDelete = (id: string, type: string) => {
    setDeleteConfirm({ open: true, id, type });
  };

  const confirmDelete = async () => {
    try {
      let error;

      // Use type-safe table operations
      switch (deleteConfirm.type) {
        case 'dados':
          ({ error } = await supabase.from('dados_pessoais').delete().eq('id', deleteConfirm.id));
          break;
        case 'mapeamento':
          ({ error } = await supabase.from('dados_mapeamento').delete().eq('id', deleteConfirm.id));
          break;
        case 'ropa':
          ({ error } = await supabase.from('ropa_registros').delete().eq('id', deleteConfirm.id));
          break;
        case 'fluxo':
          ({ error } = await supabase.from('dados_fluxos').delete().eq('id', deleteConfirm.id));
          break;
        case 'solicitacao':
          ({ error } = await supabase.from('dados_solicitacoes_titular').delete().eq('id', deleteConfirm.id));
          break;
        default:
          throw new Error(t('sweepDados.privacidade.tipoInvalido'));
      }

      if (error) throw error;

      toast({
        title: t('sweepDados.privacidade.sucesso'),
        description: t('sweepDados.privacidade.itemExcluido'),
      });

      invalidatePrivacidade();
      setDeleteConfirm({ open: false, id: '', type: '' });
    } catch (error: any) {
      logger.error('Erro ao excluir item de privacidade', { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: t('sweepDados.privacidade.erro'),
        description: error.message || t('sweepDados.privacidade.erroExcluirItem'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.privacidade.title')}
        description={t('modules.privacidade.description')}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          title={t('cardsKpi.privacidade.totalDados')}
          value={stats.totalDados}
          description={t('cardsKpi.sweep.privacidade.tiposCatalogados')}
          icon={<Database />}
          showAccent
          emptyHint={t('residuos.privacidade.cadastreCatalogo')}
        />
        <StatCard
          title={t('cardsKpi.privacidade.dadosSensiveis')}
          value={stats.dadosSensiveis}
          description={t('cardsKpi.privacidade.requeremProtecao')}
          icon={<AlertTriangle />}
          variant="warning"
        />
        <StatCard
          title={t('cardsKpi.privacidade.mapeamentos')}
          value={stats.mapeamentos}
          description={t('cardsKpi.sweep.privacidade.dadosXAtivos')}
          icon={<Database />}
        />
        <StatCard
          title={t('cardsKpi.privacidade.solicitacoesPendentes')}
          value={stats.solicitacoesPendentes}
          description={t('residuos.privacidade.deTitulares')}
          icon={<Users />}
          drillDown="privacidade"
        />
        <StatCard
          title={t('cardsKpi.privacidade.foraPrazoLgpd')}
          value={solicitacoesForaPrazo}
          description={t('cardsKpi.privacidade.excederam15Dias')}
          icon={<Clock />}
          variant={solicitacoesForaPrazo > 0 ? "destructive" : "default"}
          drillDown="privacidade"
        />
        <StatCard
          title={t('cardsKpi.sweep.privacidade.incidentesPrivacidade')}
          value={incidentesPrivacidade}
          description={incidentesPrivacidade > 0 ? t('cardsKpi.privacidade.emAberto') : t('cardsKpi.privacidade.nenhumAtivo')}
          icon={<ShieldAlert />}
          variant={incidentesPrivacidade > 0 ? "warning" : "default"}
          onClick={() => navigate('/incidentes')}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalogo">{t('cardsKpi.privacidade.abaCatalogo')}</TabsTrigger>
          <TabsTrigger value="ropa">{t('sweepDados.privacidade.abaRopa')}</TabsTrigger>
          <TabsTrigger value="solicitacoes">{t('cardsKpi.privacidade.abaSolicitacoes')}</TabsTrigger>
          <TabsTrigger value="descobertas">{t('sweepDados.privacidade.abaDescobertas')}</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMapeamentoDialog(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              {t('sweepDados.privacidade.mapearDado')}
            </Button>
            <Button size="sm" onClick={() => setShowDadosDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('sweepDados.privacidade.novoDado')}
            </Button>
          </div>
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={dadosPessoais}
                columns={catalogoColumns}
                searchPlaceholder={t('sweepDados.privacidade.buscarDados')}
                filters={catalogoFilters}
                sortField={catalogoSortField}
                sortDirection={catalogoSortDirection}
                onSort={(field) => {
                  if (field === catalogoSortField) {
                    setCatalogoSortDirection(catalogoSortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setCatalogoSortField(field);
                    setCatalogoSortDirection('asc');
                  }
                }}
                emptyState={{
                  icon: <Database className="h-8 w-8" />,
                  title: t('sweepDados.privacidade.emptyDadosTitulo'),
                  description: t('sweepDados.privacidade.emptyDadosDescricao'),
                  action: {
                    label: t('sweepDados.privacidade.novoDado'),
                    onClick: () => setShowDadosDialog(true)
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ropa" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowRopaWizard(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('sweepDados.privacidade.novoRopa')}
            </Button>
          </div>
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={ropaRegistros}
                columns={ropaColumns}
                loading={false}
                searchable
                searchPlaceholder={t('sweepDados.privacidade.buscarRopa')}
                searchValue={searchRopaTerm}
                onSearchChange={setSearchRopaTerm}
                filters={ropaFilters}
                sortField={sortRopaField}
                sortDirection={sortRopaDirection}
                onSort={(field) => {
                  if (sortRopaField === field) {
                    setSortRopaDirection(sortRopaDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortRopaField(field);
                    setSortRopaDirection('asc');
                  }
                }}
                emptyState={{
                  icon: <FileText className="h-8 w-8" />,
                  title: t('sweepDados.privacidade.emptyRopaTitulo'),
                  description: t('sweepDados.privacidade.emptyRopaDescricao'),
                  action: {
                    label: t('sweepDados.privacidade.novoRopa'),
                    onClick: () => setShowRopaWizard(true)
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowSolicitacaoDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('sweepDados.privacidade.novaSolicitacao')}
            </Button>
          </div>
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={solicitacoes}
                columns={solicitacoesColumns}
                loading={false}
                searchable
                searchPlaceholder={t('sweepDados.privacidade.buscarSolicitacoes')}
                searchValue={searchSolicitacoesTerm}
                onSearchChange={setSearchSolicitacoesTerm}
                filters={solicitacoesFilters}
                sortField={sortSolicitacoesField}
                sortDirection={sortSolicitacoesDirection}
                onSort={(field) => {
                  if (sortSolicitacoesField === field) {
                    setSortSolicitacoesDirection(sortSolicitacoesDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortSolicitacoesField(field);
                    setSortSolicitacoesDirection('asc');
                  }
                }}
                emptyState={{
                  icon: <Users className="h-8 w-8" />,
                  title: t('sweepDados.privacidade.emptySolicitacoesTitulo'),
                  description: t('sweepDados.privacidade.emptySolicitacoesDescricao'),
                  action: {
                    label: t('sweepDados.privacidade.novaSolicitacao'),
                    onClick: () => setShowSolicitacaoDialog(true)
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="descobertas" className="space-y-4">
          <DescoberDadosTab onRefresh={invalidatePrivacidade} />
        </TabsContent>
      </Tabs>

      <DadosPessoaisDialog
        isOpen={showDadosDialog}
        onClose={() => {
          setShowDadosDialog(false);
          setSelectedDado(null);
        }}
        onSave={invalidatePrivacidade}
        dados={selectedDado}
      />
      <MapeamentoDialog
        isOpen={showMapeamentoDialog}
        onClose={() => {
          setShowMapeamentoDialog(false);
          setSelectedDado(null);
        }}
        onSave={invalidatePrivacidade}
      />
      <RopaWizard
        isOpen={showRopaWizard}
        onClose={() => {
          setShowRopaWizard(false);
          setPreSelectedDadoId(undefined);
        }}
        onSave={invalidatePrivacidade}
        preSelectedDadoId={preSelectedDadoId}
      />
      <SolicitacaoTitularDialog
        isOpen={showSolicitacaoDialog}
        onClose={() => {
          setShowSolicitacaoDialog(false);
          setSelectedSolicitacao(null);
        }}
        onSave={invalidatePrivacidade}
        solicitacao={selectedSolicitacao}
      />
      
      <Sheet open={showDadoSheet} onOpenChange={setShowDadoSheet}>
        <SheetContent className="w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('cardsKpi.privacidade.detalhesDado')}</SheetTitle>
          </SheetHeader>
          {selectedDado && (
            <div className="space-y-4 mt-6">
              <div>
                <h3 className="font-semibold mb-2">{selectedDado.nome}</h3>
                <p className="text-sm text-muted-foreground">{selectedDado.descricao}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">{t('sweepDados.privacidade.colCategoria')}</span>
                  <p className="font-medium">{selectedDado.categoria_dados}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">{t('sweepDados.privacidade.colBaseLegal')}</span>
                  <p className="font-medium">{selectedDado.base_legal}</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t('residuos.privacidade.excluirItem')}
        description={t('residuos.privacidade.excluirItemConfirm')}
        confirmText={t('sweepDados.privacidade.excluir')}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}