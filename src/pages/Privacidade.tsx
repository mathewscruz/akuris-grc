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
      muito_sensivel: 'Muito Sensível',
      sensivel: 'Sensível',
      moderado: 'Moderado',
      comum: 'Comum',
    };
    return <StatusBadge size="sm" {...resolveSensibilidadeTone(nivel)}>{labels[nivel] || 'Comum'}</StatusBadge>;
  };

  const getStatusBadge = (status: string) => {
    const isWorkflow = ['pendente', 'em_analise', 'atendida', 'rejeitada'].includes(status);
    const tone = isWorkflow ? resolveWorkflowStatusTone(status) : resolveItemStatusTone(status);
    return <StatusBadge size="sm" {...tone}>{formatStatus(status)}</StatusBadge>;
  };

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      identificacao: 'Identificação',
      contato: 'Contato',
      localizacao: 'Localização',
      financeiro: 'Financeiro',
      saude: 'Saúde',
      biometrico: 'Biométrico',
      comportamental: 'Comportamental',
      outros: 'Outros'
    };
    return labels[categoria] || formatStatus(categoria);
  };

  // Catálogo DataTable columns
  const catalogoColumns = [
    {
      key: 'nome',
      label: 'Nome',
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
      label: 'Categoria',
      sortable: true,
      render: (value: string) => <Badge variant="outline">{getCategoriaLabel(value)}</Badge>
    },
    {
      key: 'sensibilidade',
      label: 'Sensibilidade',
      sortable: true,
      render: (value: string, row: any) => getSensibilidadeBadge(row.tipo_dados, value)
    },
    {
      key: 'base_legal',
      label: 'Base Legal',
      sortable: true,
      render: (value: string) => value ? <Badge variant="secondary">{formatStatus(value)}</Badge> : <span className="text-muted-foreground">-</span>
    },
    {
      key: 'mapeamentos_count',
      label: 'Mapeamentos',
      sortable: true,
      render: (value: number) => value > 0 ? (
        <Badge variant="secondary">{value}</Badge>
      ) : <span className="text-muted-foreground">0</span>
    },
    {
      key: 'ropas_count',
      label: 'ROPAs',
      sortable: true,
      render: (value: number) => value > 0 ? (
        <Badge variant="secondary">{value}</Badge>
      ) : <span className="text-muted-foreground">0</span>
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_: any, row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowDadoSheet(true); }}>
              <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowDadosDialog(true); }}>
              <Edit className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowMapeamentoDialog(true); }}>
              <Link2 className="h-4 w-4 mr-2" /> Mapear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPreSelectedDadoId(row.id); setShowRopaWizard(true); }}>
              <FileText className="h-4 w-4 mr-2" /> Criar ROPA
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(row.id, 'dados')} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const catalogoFilters = [
    {
      key: 'categoria_dados',
      label: 'Categoria',
      type: 'select' as const,
      options: [
        { value: 'identificacao', label: 'Identificação' },
        { value: 'contato', label: 'Contato' },
        { value: 'localizacao', label: 'Localização' },
        { value: 'financeiro', label: 'Financeiro' },
        { value: 'saude', label: 'Saúde' },
        { value: 'biometrico', label: 'Biométrico' },
        { value: 'comportamental', label: 'Comportamental' },
        { value: 'outros', label: 'Outros' }
      ],
      value: categoriaFilter,
      onChange: setCategoriaFilter
    },
    {
      key: 'sensibilidade',
      label: 'Sensibilidade',
      type: 'select' as const,
      options: [
        { value: 'comum', label: 'Comum' },
        { value: 'sensivel', label: 'Moderado' },
        { value: 'muito_sensivel', label: 'Sensível' }
      ],
      value: sensibilidadeFilter,
      onChange: setSensibilidadeFilter
    }
  ];

  // ROPA DataTable columns
  const ropaColumns = [
    {
      key: 'nome_tratamento',
      label: 'Nome do Tratamento',
      sortable: true,
      render: (value: string) => <span className="font-medium">{value}</span>
    },
    {
      key: 'base_legal',
      label: 'Base Legal',
      sortable: true,
      render: (value: string) => <Badge variant="outline">{value}</Badge>
    },
    {
      key: 'categoria_titulares',
      label: 'Categoria Titulares',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_: any, ropa: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedRopa(ropa); setShowRopaDialog(true); }}>
              <Edit className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(ropa.id, 'ropa')} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const ropaFilters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: 'ativo', label: 'Ativo' },
        { value: 'inativo', label: 'Inativo' },
        { value: 'revisao', label: 'Em Revisão' }
      ],
      value: statusRopaFilter,
      onChange: setStatusRopaFilter
    },
    {
      key: 'base_legal',
      label: 'Base Legal',
      type: 'select' as const,
      options: [
        { value: 'consentimento', label: 'Consentimento' },
        { value: 'legitimo_interesse', label: 'Legítimo Interesse' },
        { value: 'execucao_contrato', label: 'Execução de Contrato' },
        { value: 'cumprimento_obrigacao', label: 'Cumprimento de Obrigação Legal' }
      ],
      value: baseLegalFilter,
      onChange: setBaseLegalFilter
    }
  ];

  // Solicitações DataTable columns
  const solicitacoesColumns = [
    {
      key: 'tipo_solicitacao',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => <Badge variant="outline">{value}</Badge>
    },
    {
      key: 'dados_titular',
      label: 'Titular',
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
      label: 'Canal',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'prazo_resposta',
      label: 'Prazo',
      sortable: true,
      render: (value: string) => formatDateOnly(value)
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_: any, solicitacao: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedSolicitacao(solicitacao); setShowSolicitacaoDialog(true); }}>
              <Edit className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(solicitacao.id, 'solicitacao')} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const solicitacoesFilters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'em_analise', label: 'Em Análise' },
        { value: 'atendida', label: 'Atendida' },
        { value: 'rejeitada', label: 'Rejeitada' }
      ],
      value: statusSolicitacoesFilter,
      onChange: setStatusSolicitacoesFilter
    },
    {
      key: 'tipo_solicitacao',
      label: 'Tipo',
      type: 'select' as const,
      options: [
        { value: 'acesso', label: 'Acesso' },
        { value: 'correcao', label: 'Correção' },
        { value: 'exclusao', label: 'Exclusão' },
        { value: 'portabilidade', label: 'Portabilidade' },
        { value: 'oposicao', label: 'Oposição' },
        { value: 'revogacao_consentimento', label: 'Revogação de Consentimento' }
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
          throw new Error('Tipo inválido');
      }

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Item excluído com sucesso!",
      });

      invalidatePrivacidade();
      setDeleteConfirm({ open: false, id: '', type: '' });
    } catch (error: any) {
      logger.error('Erro ao excluir item de privacidade', { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir item",
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
          title="Total de Dados"
          value={stats.totalDados}
          description="Tipos catalogados"
          icon={<Database />}
          showAccent
          emptyHint="Cadastre o catálogo de dados pessoais."
        />
        <StatCard
          title="Dados Sensíveis"
          value={stats.dadosSensiveis}
          description="Requerem proteção especial"
          icon={<AlertTriangle />}
          variant="warning"
        />
        <StatCard
          title="Mapeamentos"
          value={stats.mapeamentos}
          description="Dados x Ativos"
          icon={<Database />}
        />
        <StatCard
          title="Solicitações Pendentes"
          value={stats.solicitacoesPendentes}
          description="De titulares"
          icon={<Users />}
          drillDown="privacidade"
        />
        <StatCard
          title="Fora do Prazo LGPD"
          value={solicitacoesForaPrazo}
          description="Excederam 15 dias"
          icon={<Clock />}
          variant={solicitacoesForaPrazo > 0 ? "destructive" : "default"}
          drillDown="privacidade"
        />
        <StatCard
          title="Incidentes Privacidade"
          value={incidentesPrivacidade}
          description={incidentesPrivacidade > 0 ? "Em aberto" : "Nenhum ativo"}
          icon={<ShieldAlert />}
          variant={incidentesPrivacidade > 0 ? "warning" : "default"}
          onClick={() => navigate('/incidentes')}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo & Mapeamento</TabsTrigger>
          <TabsTrigger value="ropa">ROPA</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          <TabsTrigger value="descobertas">Descobertas</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMapeamentoDialog(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Mapear Dado
            </Button>
            <Button size="sm" onClick={() => setShowDadosDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Dado
            </Button>
          </div>
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={dadosPessoais}
                columns={catalogoColumns}
                searchPlaceholder="Buscar dados pessoais..."
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
                  title: "Nenhum dado catalogado",
                  description: "Ainda não há dados pessoais catalogados. Comece criando o primeiro registro.",
                  action: {
                    label: "Novo Dado",
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
              Novo ROPA
            </Button>
          </div>
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={ropaRegistros}
                columns={ropaColumns}
                loading={false}
                searchable
                searchPlaceholder="Buscar ROPA..."
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
                  title: "Nenhum registro ROPA criado",
                  description: "Ainda não há registros ROPA cadastrados. Comece criando o primeiro registro.",
                  action: {
                    label: "Novo ROPA",
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
              Nova Solicitação
            </Button>
          </div>
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                data={solicitacoes}
                columns={solicitacoesColumns}
                loading={false}
                searchable
                searchPlaceholder="Buscar solicitações..."
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
                  title: "Nenhuma solicitação registrada",
                  description: "Ainda não há solicitações de titulares. Comece criando o primeiro registro.",
                  action: {
                    label: "Nova Solicitação",
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
            <SheetTitle>Detalhes do Dado Pessoal</SheetTitle>
          </SheetHeader>
          {selectedDado && (
            <div className="space-y-4 mt-6">
              <div>
                <h3 className="font-semibold mb-2">{selectedDado.nome}</h3>
                <p className="text-sm text-muted-foreground">{selectedDado.descricao}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Categoria</span>
                  <p className="font-medium">{selectedDado.categoria_dados}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Base Legal</span>
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
        title="Excluir Item"
        description="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}