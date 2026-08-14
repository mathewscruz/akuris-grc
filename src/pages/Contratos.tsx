import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFocusRow } from '@/hooks/useFocusRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveRevisaoTone } from '@/lib/status-tone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { StatStrip } from '@/components/ui/stat-strip';
import { ModuleToolbar, ToolbarField } from '@/components/ui/module-toolbar';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Plus, Search, FileText, DollarSign, Users, AlertCircle, Edit, TrendingUp, Trash2, Building2, FileStack, Milestone, FilePlus2, Download, Upload, MoreHorizontal, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { logger } from '@/lib/logger';
import { ContratoDialogWizard } from '@/components/contratos/ContratoDialogWizard';
import { FornecedorDialog } from '@/components/contratos/FornecedorDialog';
import { MarcosDialog } from '@/components/contratos/MarcosDialog';
import { DocumentosDialog } from '@/components/contratos/DocumentosDialog';
import { AditivosDialog } from '@/components/contratos/AditivosDialog';
import ImportContratosDialog from '@/components/contratos/ImportContratosDialog';
import RelatoriosContratos from '@/components/contratos/RelatoriosContratos';
import TemplatesContratos from '@/components/contratos/TemplatesContratos';
import { useContratosStats } from '@/hooks/useContratosStats';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmpresaMoeda } from '@/hooks/useEmpresaMoeda';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { resolveContratoStatusTone, resolveCriticidadeTone } from '@/lib/status-tone';
import { estadoContrato } from '@/lib/metrics';

interface Contrato {
  id: string;
  numero_contrato: string;
  nome: string;
  tipo: string;
  status: string;
  valor: number;
  moeda: string;
  data_inicio: string;
  data_fim: string;
  data_assinatura: string;
  renovacao_automatica: boolean;
  prazo_renovacao: number;
  gestor_contrato: string;
  fornecedor_id: string;
  area_solicitante: string;
  objeto: string;
  observacoes: string;
  clausulas_especiais: string;
  penalidades: string;
  sla_principal: string;
  confidencial: boolean;
  fornecedores?: {
    nome: string;
    avaliacao_risco: string;
  } | null;
}

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  contato_responsavel: string;
  tipo: string;
  status: string;
  categoria: string;
  avaliacao_risco: string;
  data_cadastro: string;
  observacoes: string;
  contratos_count?: number;
}

export default function Contratos() {
  const { t } = useLanguage();
  const { format: formatMoedaEmpresa } = useEmpresaMoeda();
  useFocusRow();
  const [searchParams, setSearchParams] = useSearchParams();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTermFornecedor, setSearchTermFornecedor] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [statusFornecedorFilter, setStatusFornecedorFilter] = useState('todos');
  const [categoriaFornecedorFilter, setCategoriaFornecedorFilter] = useState('todos');
  const [riscoFornecedorFilter, setRiscoFornecedorFilter] = useState('todos');
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fornecedorDialogOpen, setFornecedorDialogOpen] = useState(false);
  const [marcosDialogOpen, setMarcosDialogOpen] = useState(false);
  const [documentosDialogOpen, setDocumentosDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState('contratos');
  const [aditivosDialogOpen, setAditivosDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; type: 'contrato' | 'fornecedor' }>({
    open: false,
    id: '',
    type: 'contrato'
  });
  const { toast } = useToast();
  
  // Paginação
  const [currentPageContratos, setCurrentPageContratos] = useState(1);
  const [currentPageFornecedores, setCurrentPageFornecedores] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Buscar estatísticas dos contratos
  const { data: statsContratos } = useContratosStats();

  // React Query para contratos
  const { data: contratos = [], isLoading: loadingContratos } = useQuery({
    queryKey: ['contratos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('contratos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        const fornecedorIds = [...new Set(data.map(c => c.fornecedor_id).filter(Boolean))];
        const { data: fornecedoresData } = await supabase
          .from('fornecedores')
          .select('id, nome, avaliacao_risco')
          .in('id', fornecedorIds);

        return data.map(contrato => ({
          ...contrato,
          fornecedores: fornecedoresData?.find(f => f.id === contrato.fornecedor_id) || null
        })) as Contrato[];
      }
      return [];
    },
    enabled: !!empresaId,
  });

  // React Query para fornecedores
  const { data: fornecedores = [], isLoading: loadingFornecedores } = useQuery({
    queryKey: ['fornecedores', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome');

      if (error) throw error;

      const { data: contratosData } = await supabase
        .from('contratos')
        .select('fornecedor_id')
        .eq('empresa_id', empresaId);

      const contratosCountMap: Record<string, number> = {};
      (contratosData || []).forEach(c => {
        if (c.fornecedor_id) {
          contratosCountMap[c.fornecedor_id] = (contratosCountMap[c.fornecedor_id] || 0) + 1;
        }
      });

      return (data || []).map(f => ({
        ...f,
        contratos_count: contratosCountMap[f.id] || 0
      }));
    },
    enabled: !!empresaId,
  });

  // Aplica a aba indicada via query param (ex.: deep link da busca global).
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'fornecedores' || tab === 'contratos') {
      setCurrentTab(tab);
    }
  }, [searchParams]);

  // Deep link vindo da busca global (Cmd+K): abre o registo focado.
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId) return;
    const contrato = contratos.find((c) => c.id === focusId);
    if (contrato) {
      setCurrentTab('contratos');
      setSelectedContrato(contrato);
      setDialogOpen(true);
      return;
    }
    const fornecedor = fornecedores.find((f) => f.id === focusId);
    if (fornecedor) {
      setCurrentTab('fornecedores');
      setSelectedFornecedor(fornecedor);
      setFornecedorDialogOpen(true);
    }
  }, [searchParams, contratos, fornecedores]);

  const loading = loadingContratos || loadingFornecedores;

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ['contratos'] });
    queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    queryClient.invalidateQueries({ queryKey: ['contratos-stats'] });
  };

  const handleEdit = (item: Contrato | Fornecedor, type: 'contrato' | 'fornecedor') => {
    if (type === 'contrato') {
      setSelectedContrato(item as Contrato);
      setDialogOpen(true);
    } else {
      setSelectedFornecedor(item as Fornecedor);
      setFornecedorDialogOpen(true);
    }
  };

  const handleDelete = (id: string, type: 'contrato' | 'fornecedor') => {
    setDeleteConfirm({ open: true, id, type });
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from(deleteConfirm.type === 'contrato' ? 'contratos' : 'fornecedores')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: t('fin.comum.sucesso'),
        description: `${deleteConfirm.type === 'contrato' ? 'Contrato' : t('fin.comum.fornecedor')} excluído com sucesso`,
      });

      invalidateData();
      setDeleteConfirm({ open: false, id: '', type: 'contrato' });
    } catch (error) {
      logger.error('Erro ao excluir', { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: t('fin.comum.erro'),
        description: `Erro ao excluir ${deleteConfirm.type === 'contrato' ? 'contrato' : 'fornecedor'}`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <StatusBadge size="sm" {...resolveContratoStatusTone(status)}>
        {formatStatus(status)}
      </StatusBadge>
    );
  };

  /** Estado derivado (camada única de métricas): vencido não fica "ativo". */
  const getContratoStatusBadge = (contrato: { status: string; data_fim: string | null }) => {
    const estado = estadoContrato(contrato);
    const label = estado === 'vigente' ? 'ativo' : estado === 'a_vencer' ? 'ativo' : estado;
    return (
      <StatusBadge size="sm" {...resolveContratoStatusTone(label)}>
        {formatStatus(label)}
      </StatusBadge>
    );
  };


  const getRiskBadge = (risk: string) => {
    return (
      <StatusBadge size="sm" {...resolveCriticidadeTone(risk)}>
        {formatStatus(risk)}
      </StatusBadge>
    );
  };

  const getVencimentoBadge = (dataFim: string | null) => {
    if (!dataFim) return null;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVenc = new Date(dataFim + 'T00:00:00');
    const diffDays = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <StatusBadge size="sm" {...resolveRevisaoTone(diffDays)} className="ml-2">{formatStatus('vencido')}</StatusBadge>;
    } else if (diffDays <= 30) {
      return <StatusBadge size="sm" {...resolveRevisaoTone(diffDays)} className="ml-2">{diffDays}d</StatusBadge>;
    }
    return null;
  };

  const handleExportCSV = () => {
    const headers = [t('fin.comum.numero'), t('fin.comum.nome'), t('fin.comum.fornecedor'), t('fin.comum.tipo'), t('fin.comum.status'), t('fin.comum.valor'), t('fin.comum.inicio'), t('fin.comum.fim')];
    const rows = filteredContratos.map(c => [
      c.numero_contrato,
      c.nome,
      c.fornecedores?.nome || '',
      c.tipo,
      c.status,
      c.valor || 0,
      c.data_inicio ? formatDateOnly(c.data_inicio) : '',
      c.data_fim ? formatDateOnly(c.data_fim) : ''
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contratos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({ title: t('fin.comum.exportacaoConcluida'), description: t('fin.comum.csvBaixado') });
  };

  // Categorias únicas de fornecedores
  const categoriasFornecedor = useMemo(() => {
    const cats = new Set(fornecedores.map(f => f.categoria).filter(Boolean));
    return Array.from(cats) as string[];
  }, [fornecedores]);

  const filteredContratos = useMemo(() => {
    return contratos.filter(contrato => {
      const matchesSearch = contrato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contrato.numero_contrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contrato.fornecedores?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'todos' || contrato.status === statusFilter;
      const matchesTipo = tipoFilter === 'todos' || contrato.tipo === tipoFilter;
      
      return matchesSearch && matchesStatus && matchesTipo;
    });
  }, [contratos, searchTerm, statusFilter, tipoFilter]);

  const filteredFornecedores = useMemo(() => {
    return fornecedores.filter(fornecedor => {
      const matchesSearch = fornecedor.nome.toLowerCase().includes(searchTermFornecedor.toLowerCase()) ||
             fornecedor.cnpj?.toLowerCase().includes(searchTermFornecedor.toLowerCase());
      const matchesStatus = statusFornecedorFilter === 'todos' || fornecedor.status === statusFornecedorFilter;
      const matchesCategoria = categoriaFornecedorFilter === 'todos' || fornecedor.categoria === categoriaFornecedorFilter;
      const matchesRisco = riscoFornecedorFilter === 'todos' || fornecedor.avaliacao_risco === riscoFornecedorFilter;
      return matchesSearch && matchesStatus && matchesCategoria && matchesRisco;
    });
  }, [fornecedores, searchTermFornecedor, statusFornecedorFilter, categoriaFornecedorFilter, riscoFornecedorFilter]);

  // Paginação
  const totalPagesContratos = Math.ceil(filteredContratos.length / itemsPerPage);
  const totalPagesFornecedores = Math.ceil(filteredFornecedores.length / itemsPerPage);

  const paginatedContratos = useMemo(() => {
    const start = (currentPageContratos - 1) * itemsPerPage;
    return filteredContratos.slice(start, start + itemsPerPage);
  }, [filteredContratos, currentPageContratos, itemsPerPage]);

  const paginatedFornecedores = useMemo(() => {
    const start = (currentPageFornecedores - 1) * itemsPerPage;
    return filteredFornecedores.slice(start, start + itemsPerPage);
  }, [filteredFornecedores, currentPageFornecedores, itemsPerPage]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title={t('modules.contratos.title')}
          description={t('modules.contratos.description')}
          actions={
            currentTab === 'contratos' ? (
              <Button onClick={() => { setSelectedContrato(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('fin.contratos.novo')}
              </Button>
            ) : (
              <Button onClick={() => { setSelectedFornecedor(null); setFornecedorDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('fin.fornecedores.novo')}
              </Button>
            )
          }
          secondaryActions={[
            { label: t('cardsKpi.sweep.contratos.exportarCsv'), icon: <Download className="h-4 w-4" />, onClick: handleExportCSV },
            { label: t('cardsKpi.denuncias.relatorios'), icon: <BarChart3 className="h-4 w-4" />, onClick: () => setRelatoriosOpen(true) },
            { label: t('modules.dueDiligence.templates'), icon: <FileText className="h-4 w-4" />, onClick: () => setTemplatesOpen(true) },
            { label: t('p3Import.importButtonLabel'), icon: <Upload className="h-4 w-4" />, onClick: () => setImportDialogOpen(true), separatorBefore: true },
          ]}
        />

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="contratos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cardsKpi.sweep.contratos.contratos')}</span>
            </TabsTrigger>
            <TabsTrigger value="fornecedores" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cardsKpi.sweep.contratos.fornecedores')}</span>
            </TabsTrigger>
          </TabsList>

        <StatStrip
          loading={!statsContratos}
          items={[
            {
              key: 'total',
              label: t('cardsKpi.contratos.totalContratos'),
              value: statsContratos?.total || 0,
              drillDown: 'contratos',
            },
            {
              key: 'valor',
              label: t('cardsKpi.contratos.valorVigente'),
              value: formatMoedaEmpresa(statsContratos?.valorTotal || 0, true),
              hint: t('cardsKpi.contratos.valorVigenteHint'),
              drillDown: 'contratos',
            },
            {
              key: 'valorVencido',
              label: t('cardsKpi.contratos.valorVencido'),
              value: formatMoedaEmpresa(statsContratos?.valorVencido || 0, true),
              tone: (statsContratos?.valorVencido || 0) > 0 ? 'destructive' : undefined,
              hint: t('cardsKpi.contratos.valorVencidoHint'),
              drillDown: 'contratos',
            },
            {
              key: 'vencendo',
              label: t('cardsKpi.sweep.contratos.vencimentos'),
              value: statsContratos?.vencendo30Dias || 0,
              tone: 'warning',
              hint: t('fin.comum.proximos30'),
              drillDown: 'contratos',
            },
          ]}
        />


        <RelatoriosContratos open={relatoriosOpen} onOpenChange={setRelatoriosOpen} hideTrigger />
        <TemplatesContratos open={templatesOpen} onOpenChange={setTemplatesOpen} hideTrigger />


        {/* Tabs */}


          <TabsContent value="contratos" className="space-y-4">
            <Card className="rounded-lg border overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 pb-4">
                  <ModuleToolbar
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchPlaceholder={t('fin.contratos.buscar')}
                    filters={
                      <>
                        <ToolbarField label={t('fin.comum.status')}>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder={t('fin.comum.status')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">{t('campos.filtros.todos')}</SelectItem>
                              <SelectItem value="ativo">{t('campos.opcoes.ativo')}</SelectItem>
                              <SelectItem value="rascunho">{t('campos.opcoes.rascunho')}</SelectItem>
                              <SelectItem value="negociacao">{t('fin.contratos.negociacao')}</SelectItem>
                              <SelectItem value="aprovacao">{t('fin.comum.aprovacao')}</SelectItem>
                              <SelectItem value="suspenso">{t('campos.opcoes.suspenso')}</SelectItem>
                              <SelectItem value="encerrado">{t('campos.opcoes.encerrado')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </ToolbarField>
                        <ToolbarField label={t('fin.comum.tipo')}>
                          <Select value={tipoFilter} onValueChange={setTipoFilter}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder={t('fin.comum.tipo')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">{t('campos.filtros.todos')}</SelectItem>
                              <SelectItem value="servicos">{t('campos.opcoes.servicos')}</SelectItem>
                              <SelectItem value="licenciamento">{t('campos.opcoes.licenciamento')}</SelectItem>
                              <SelectItem value="manutencao">{t('fin.comum.manutencao')}</SelectItem>
                              <SelectItem value="consultoria">{t('campos.opcoes.consultoria')}</SelectItem>
                              <SelectItem value="produto">{t('campos.opcoes.produto')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </ToolbarField>
                        <ToolbarField label={t('fin.comum.itensPorPagina')}>
                          <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                        </ToolbarField>
                      </>
                    }
                  />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('fin.comum.nome')}</TableHead>
                      <TableHead>{t('fin.comum.fornecedor')}</TableHead>
                      <TableHead>{t('fin.comum.status')}</TableHead>
                      <TableHead>{t('fin.comum.tipo')}</TableHead>
                      <TableHead>{t('fin.comum.valor')}</TableHead>
                      <TableHead>{t('cardsKpi.sweep.contratos.vencimento')}</TableHead>
                      <TableHead className="text-right">{t('fin.comum.acoes')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedContratos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <EmptyState
                            icon={<FileText className="h-8 w-8" />}
                            title={t('fin.contratos.nenhum')}
                            description={t('cardsKpi.contratos.emptyContratos')}
                            action={{
                              label: t('fin.contratos.novo'),
                              onClick: () => { setSelectedContrato(null); setDialogOpen(true); }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedContratos.map((contrato) => (
                        <TableRow key={contrato.id} data-focus-id={contrato.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{contrato.nome}</div>
                              <div className="text-sm text-muted-foreground">{contrato.numero_contrato}</div>
                            </div>
                          </TableCell>
                          <TableCell>{contrato.fornecedores?.nome || '-'}</TableCell>
                          <TableCell>{getStatusBadge(contrato.status)}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize whitespace-nowrap">{formatStatus(contrato.tipo)}</Badge></TableCell>
                          <TableCell>
                            {contrato.valor 
                              ? formatMoedaEmpresa(Number(contrato.valor))
                              : 'N/A'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center whitespace-nowrap">
                              {formatDateOnly(contrato.data_fim)}
                              {getVencimentoBadge(contrato.data_fim)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(contrato, 'contrato')}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    {t('sweepDados.contratos.editar')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setSelectedContrato(contrato); setDocumentosDialogOpen(true); }}>
                                    <FileStack className="mr-2 h-4 w-4" />
                                    {t('sweepDados.contratos.documentos')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedContrato(contrato); setMarcosDialogOpen(true); }}>
                                    <Milestone className="mr-2 h-4 w-4" />
                                    {t('sweepDados.contratos.marcos')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedContrato(contrato); setAditivosDialogOpen(true); }}>
                                    <FilePlus2 className="mr-2 h-4 w-4" />
                                    {t('sweepDados.contratos.aditivos')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(contrato.id, 'contrato')}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />{t('fin.comum.excluir')}</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Paginação */}
                {totalPagesContratos > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {((currentPageContratos - 1) * itemsPerPage) + 1} a {Math.min(currentPageContratos * itemsPerPage, filteredContratos.length)} de {filteredContratos.length}
                    </span>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPageContratos(p => Math.max(1, p - 1))}
                            className={currentPageContratos === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPagesContratos) }, (_, i) => {
                          let page = i + 1;
                          if (totalPagesContratos > 5) {
                            if (currentPageContratos > 3) {
                              page = currentPageContratos - 2 + i;
                            }
                            if (page > totalPagesContratos) {
                              page = totalPagesContratos - 4 + i;
                            }
                          }
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPageContratos(page)}
                                isActive={currentPageContratos === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPageContratos(p => Math.min(totalPagesContratos, p + 1))}
                            className={currentPageContratos === totalPagesContratos ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fornecedores Tab */}
          <TabsContent value="fornecedores" className="space-y-4">
            <Card className="rounded-lg border overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 pb-4">
                  <ModuleToolbar
                    searchValue={searchTermFornecedor}
                    onSearchChange={setSearchTermFornecedor}
                    searchPlaceholder={t('fin.fornecedores.buscar')}
                    filters={
                      <>
                        <ToolbarField label={t('fin.comum.status')}>
                          <Select value={statusFornecedorFilter} onValueChange={setStatusFornecedorFilter}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder={t('fin.comum.status')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">{t('campos.filtros.todosStatus')}</SelectItem>
                              <SelectItem value="ativo">{t('campos.opcoes.ativo')}</SelectItem>
                              <SelectItem value="inativo">{t('campos.opcoes.inativo')}</SelectItem>
                              <SelectItem value="suspenso">{t('campos.opcoes.suspenso')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </ToolbarField>
                        <ToolbarField label={t('campos.comum.categoria')}>
                          <Select value={categoriaFornecedorFilter} onValueChange={setCategoriaFornecedorFilter}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder={t('campos.comum.categoria')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">{t('campos.filtros.todasCategorias')}</SelectItem>
                              {categoriasFornecedor.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </ToolbarField>
                        <ToolbarField label={t('campos.comum.risco')}>
                          <Select value={riscoFornecedorFilter} onValueChange={setRiscoFornecedorFilter}>
                            <SelectTrigger className="w-[130px]">
                              <SelectValue placeholder={t('campos.comum.risco')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">{t('campos.filtros.todosRiscos')}</SelectItem>
                              <SelectItem value="baixo">{t('campos.opcoes.baixo')}</SelectItem>
                              <SelectItem value="medio">{t('campos.opcoes.medio')}</SelectItem>
                              <SelectItem value="alto">{t('campos.opcoes.alto')}</SelectItem>
                              <SelectItem value="critico">{t('fin.comum.critico')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </ToolbarField>
                        <ToolbarField label={t('fin.comum.itensPorPagina')}>
                          <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                        </ToolbarField>
                      </>
                    }
                  />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('fin.comum.nome')}</TableHead>
                      <TableHead>{t('fin.comum.tipo')}</TableHead>
                      <TableHead>{t('cardsKpi.sweep.contratos.categoria')}</TableHead>
                      <TableHead>{t('cardsKpi.sweep.contratos.contratos')}</TableHead>
                      <TableHead>{t('cardsKpi.sweep.contratos.risco')}</TableHead>
                      <TableHead>{t('fin.comum.status')}</TableHead>
                      <TableHead className="text-right">{t('fin.comum.acoes')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFornecedores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <EmptyState
                            icon={<Users className="h-8 w-8" />}
                            title={t('fin.fornecedores.nenhum')}
                            description={t('cardsKpi.contratos.emptyFornecedores')}
                            action={{
                              label: t('fin.fornecedores.novo'),
                              onClick: () => { setSelectedFornecedor(null); setFornecedorDialogOpen(true); }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedFornecedores.map((fornecedor) => (
                        <TableRow key={fornecedor.id} data-focus-id={fornecedor.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{fornecedor.nome}</div>
                              <div className="text-sm text-muted-foreground">{fornecedor.cnpj}</div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="capitalize whitespace-nowrap">{formatStatus(fornecedor.tipo)}</Badge></TableCell>
                          <TableCell><Badge variant="secondary" className="capitalize whitespace-nowrap">{fornecedor.categoria || '-'}</Badge></TableCell>
                          <TableCell>
                            <Badge variant="outline">{fornecedor.contratos_count || 0}</Badge>
                          </TableCell>
                          <TableCell>{fornecedor.avaliacao_risco ? getRiskBadge(fornecedor.avaliacao_risco) : '-'}</TableCell>
                          <TableCell>{getStatusBadge(fornecedor.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(fornecedor, 'fornecedor')}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {t('sweepDados.contratos.editar')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(fornecedor.id, 'fornecedor')}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />{t('fin.comum.excluir')}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Paginação */}
                {totalPagesFornecedores > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {((currentPageFornecedores - 1) * itemsPerPage) + 1} a {Math.min(currentPageFornecedores * itemsPerPage, filteredFornecedores.length)} de {filteredFornecedores.length}
                    </span>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPageFornecedores(p => Math.max(1, p - 1))}
                            className={currentPageFornecedores === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPagesFornecedores) }, (_, i) => {
                          let page = i + 1;
                          if (totalPagesFornecedores > 5) {
                            if (currentPageFornecedores > 3) {
                              page = currentPageFornecedores - 2 + i;
                            }
                            if (page > totalPagesFornecedores) {
                              page = totalPagesFornecedores - 4 + i;
                            }
                          }
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPageFornecedores(page)}
                                isActive={currentPageFornecedores === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPageFornecedores(p => Math.min(totalPagesFornecedores, p + 1))}
                            className={currentPageFornecedores === totalPagesFornecedores ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Dialogs */}
        <ContratoDialogWizard
          contrato={selectedContrato}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={invalidateData}
          fornecedores={fornecedores}
        />

        <FornecedorDialog
          fornecedor={selectedFornecedor}
          open={fornecedorDialogOpen}
          onOpenChange={setFornecedorDialogOpen}
          onSuccess={invalidateData}
        />

        <MarcosDialog
          contrato={selectedContrato}
          open={marcosDialogOpen}
          onOpenChange={setMarcosDialogOpen}
        />

        <DocumentosDialog
          contrato={selectedContrato}
          open={documentosDialogOpen}
          onOpenChange={setDocumentosDialogOpen}
        />

        <AditivosDialog
          contrato={selectedContrato}
          open={aditivosDialogOpen}
          onOpenChange={setAditivosDialogOpen}
        />

        <ImportContratosDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={invalidateData}
        />

        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
          title={deleteConfirm.type === 'contrato' ? t('sweepDados.contratos.excluirTitleContrato') : t('sweepDados.contratos.excluirTitleFornecedor')}
          description={deleteConfirm.type === 'contrato' ? t('sweepDados.contratos.excluirDescContrato') : t('sweepDados.contratos.excluirDescFornecedor')}
          confirmText={t('fin.comum.excluir')}
          variant="destructive"
          onConfirm={confirmDelete}
        />
      </div>
    </TooltipProvider>
  );
}
