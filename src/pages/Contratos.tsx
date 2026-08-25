import { useState, useMemo, useEffect, useRef } from 'react';
import { IconHistory, IconAdd, IconSearch, IconEdit, IconDelete, IconDownload, IconUpload, IconMore, IconInfo, IconFile, IconMoney, IconTrendUp, IconOrg, IconChart, IconFlag } from '@/components/icons';
import { useSearchParams } from 'react-router-dom';
import { useFocusRow } from '@/hooks/useFocusRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useTableSort } from '@/components/ui/sortable-table-head';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { StatStrip } from '@/components/ui/stat-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { logger } from '@/lib/logger';
import { ContratoDialogWizard } from '@/components/contratos/ContratoDialogWizard';
import { FornecedoresManager, type FornecedoresManagerHandle } from '@/components/due-diligence/FornecedoresManager';
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
import { formatDateOnly, formatarDiaParaDB} from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { resolveContratoStatusTone, resolveCriticidadeTone } from '@/lib/status-tone';
import { estadoContrato } from '@/lib/metrics';
import { rowOpenProps } from '@/lib/row-interaction';
import { RecordDetailDrawer } from '@/components/common/RecordDetailDrawer';
import { TrilhaAuditoria } from '@/components/common/TrilhaAuditoria';

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

export default function Contratos() {
  const { t } = useLanguage();
  const { format: formatMoedaEmpresa } = useEmpresaMoeda();
  useFocusRow();
  const [searchParams, setSearchParams] = useSearchParams();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [detalheContrato, setDetalheContrato] = useState<Contrato | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [marcosDialogOpen, setMarcosDialogOpen] = useState(false);
  const [documentosDialogOpen, setDocumentosDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState('contratos');
  // Cada aba tem a sua acção no cabeçalho: contrato numa, fornecedor na outra.
  const gestorFornecedores = useRef<FornecedoresManagerHandle>(null);
  const [aditivosDialogOpen, setAditivosDialogOpen] = useState(false);
  const [trilhaDialogOpen, setTrilhaDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({
    open: false,
    id: '',
  });
  const { toast } = useToast();
  
  // Paginação
  
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
  // "Responsável" na gaveta de detalhe mostrava o UUID cru de
  // `gestor_contrato`. O mesmo campo, na tabela do Gap Analysis, resolve para
  // nome — aqui faltava o lookup.
  const { data: perfis = [] } = useQuery({
    queryKey: ['contratos-perfis', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .eq('empresa_id', empresaId!);
      return data || [];
    },
  });
  const nomePorUsuario = useMemo(
    () => new Map(perfis.map((p) => [p.user_id, p.nome || p.email || ''])),
    [perfis],
  );

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
      // Esta lista alimenta o selector do wizard de contrato e o selo de risco
      // na gaveta do contrato. A contagem de contratos por fornecedor -- que a
      // antiga aba mostrava -- vive agora no gestor unico (Due Diligence).
      return data || [];
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
    if (fornecedores.some((f) => f.id === focusId)) {
      // O gestor de fornecedores recebe o `focoId` e abre o registo sozinho.
      setCurrentTab('fornecedores');
    }
  }, [searchParams, contratos, fornecedores]);

  const loading = loadingContratos || loadingFornecedores;

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ['contratos'] });
    queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    queryClient.invalidateQueries({ queryKey: ['contratos-stats'] });
  };

  const handleEdit = (item: Contrato) => {
    setSelectedContrato(item);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, id });
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('contratos')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: t('fin.comum.sucesso'),
        description: `Contrato excluído com sucesso`,
      });

      invalidateData();
      setDeleteConfirm({ open: false, id: '' });
    } catch (error) {
      logger.error('Erro ao excluir', { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: t('fin.comum.erro'),
        description: `Erro ao excluir contrato`,
        variant: "destructive",
      });
    }
  };

  /** Estado derivado (camada única de métricas): vencido não fica "ativo". */
  const getContratoStatusBadge = (contrato: { status: string; data_fim: string | null }) => {
    const estado = estadoContrato(contrato);
    const label = estado === 'vigente' ? 'ativo' : estado === 'a_vencer' ? 'ativo' : estado;
    return (
      <StatusBadge {...resolveContratoStatusTone(label)}>
        {formatStatus(label)}
      </StatusBadge>
    );
  };

  const getRiskBadge = (risk: string, prefixo?: string) => {
    return (
      <StatusBadge {...resolveCriticidadeTone(risk)}>
        {prefixo ? `${prefixo}: ${formatStatus(risk)}` : formatStatus(risk)}
      </StatusBadge>
    );
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
    link.download = `contratos_${formatarDiaParaDB(new Date())}.csv`;
    link.click();
    toast({ title: t('fin.comum.exportacaoConcluida'), description: t('fin.comum.csvBaixado') });
  };

  const filteredContratos = useMemo(() => {
    return contratos.filter(contrato => {
      const matchesSearch = contrato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contrato.numero_contrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contrato.fornecedores?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'todos' || estadoContrato(contrato) === statusFilter || (statusFilter === 'ativo' && ['vigente','a_vencer'].includes(estadoContrato(contrato)));
      const matchesTipo = tipoFilter === 'todos' || contrato.tipo === tipoFilter;
      
      return matchesSearch && matchesStatus && matchesTipo;
    });
  }, [contratos, searchTerm, statusFilter, tipoFilter]);

  // Ordenação A-Z / Z-A
  const contratoAccessors = useMemo(() => ({
    fornecedor: (c: any) => c.fornecedores?.nome ?? '',
    valor: (c: any) => (c.valor === null || c.valor === undefined ? null : Number(c.valor)),
  }), []);
  const { sorted: sortedContratos, sort: sortContratos, toggleSort: toggleSortContratos } = useTableSort(filteredContratos as any[], contratoAccessors);

  /*
    A paginacao manual saiu -- o `DataTable` traz a sua, ja traduzida.

    A ORDENACAO fica, e e de proposito. `useTableSort` leva acessadores para
    os campos que nao existem na linha: "fornecedor" vem de
    `c.fornecedores.nome`, e "valor" tem de ser comparado como numero e nao
    como texto. Deixar o `DataTable` ordenar sozinho -- ele le
    `item[coluna.key]` -- faria a coluna Fornecedor deixar de ordenar e a
    coluna Valor ordenar 1000 antes de 900.
  */

  if (loading) {
    return <PageSkeleton />;
  }

  /*
    Contratos era a ultima tabela artesanal do produto -- Table cru, com a sua
    propria ordenacao, a sua propria paginacao e a sua propria barra de
    ferramentas. Custava tres coisas:

     · **No telemovel era ilegivel.** O `DataTable` troca a tabela por cartoes
       abaixo de `md`; aqui a tabela ficava, espremida em 375px, com os
       cabecalhos a partirem-se numa coluna de letras -- "N O M E",
       "F O R N E C E D O R" -- e o texto das celulas cortado a meio da
       palavra: "Lice/ncia/men/to M36/5".
     · **A paginacao estava so em portugues.** "Mostrando 1 a 10 de 3" era
       texto cravado, fora do `t()`.
     · Um segundo sitio para corrigir sempre que a tabela do produto muda.
  */
  const colunasContratos: Column<any>[] = [
    {
      key: 'nome',
      label: t('fin.comum.nome'),
      sortable: true,
      render: (_: any, c: any) => (
        <div>
          <div className="font-medium">{c.nome}</div>
          <div className="text-sm text-muted-foreground">{c.numero_contrato}</div>
        </div>
      ),
    },
    {
      key: 'fornecedor',
      label: t('fin.comum.fornecedor'),
      sortable: true,
      render: (_: any, c: any) => c.fornecedores?.nome || '-',
    },
    {
      key: 'status',
      label: t('fin.comum.status'),
      sortable: true,
      render: (_: any, c: any) => getContratoStatusBadge(c),
    },
    {
      key: 'tipo',
      label: t('fin.comum.tipo'),
      sortable: true,
      render: (_: any, c: any) => (
        <Badge variant="outline" className="capitalize whitespace-nowrap">{formatStatus(c.tipo)}</Badge>
      ),
    },
    {
      key: 'valor',
      label: t('fin.comum.valor'),
      sortable: true,
      render: (_: any, c: any) => (c.valor ? formatMoedaEmpresa(Number(c.valor)) : 'N/A'),
    },
    {
      key: 'data_fim',
      label: t('cardsKpi.sweep.contratos.vencimento'),
      sortable: true,
      render: (_: any, c: any) => (
        <span className="whitespace-nowrap">{formatDateOnly(c.data_fim)}</span>
      ),
    },
    {
      key: 'acoes',
      label: t('fin.comum.acoes'),
      render: (_: any, contrato: any) => (
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <IconMore className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => handleEdit(contrato)}>
                <IconEdit className="mr-2 h-4 w-4" />
                {t('sweepDados.contratos.editar')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setSelectedContrato(contrato); setDocumentosDialogOpen(true); }}>
                <IconFile className="mr-2 h-4 w-4" />
                {t('sweepDados.contratos.documentos')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedContrato(contrato); setMarcosDialogOpen(true); }}>
                <IconFlag className="mr-2 h-4 w-4" />
                {t('sweepDados.contratos.marcos')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedContrato(contrato); setTrilhaDialogOpen(true); }}>
                <IconHistory className="mr-2 h-4 w-4" />{t('fin.contratos.trilhaAuditoria')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedContrato(contrato); setAditivosDialogOpen(true); }}>
                <IconAdd className="mr-2 h-4 w-4" />
                {t('sweepDados.contratos.aditivos')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(contrato.id)}
                className="text-destructive"
              >
                <IconDelete className="mr-2 h-4 w-4" />{t('fin.comum.excluir')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];


  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title={t('modules.contratos.title')}
          description={t('modules.contratos.description')}
          actions={
            currentTab === 'contratos' ? (
              <Button onClick={() => { setSelectedContrato(null); setDialogOpen(true); }}>
                <IconAdd className="h-4 w-4 mr-2" />
                {t('fin.contratos.novo')}
              </Button>
            ) : (
              <Button onClick={() => gestorFornecedores.current?.abrirNovo()}>
                <IconAdd className="h-4 w-4 mr-2" />
                {t('fin.fornecedores.novo')}
              </Button>
            )
          }
          secondaryActions={[
            { label: t('cardsKpi.sweep.contratos.exportarCsv'), icon: <IconDownload className="h-4 w-4" />, onClick: handleExportCSV },
            { label: t('cardsKpi.denuncias.relatorios'), icon: <IconChart className="h-4 w-4" />, onClick: () => setRelatoriosOpen(true) },
            { label: t('modules.dueDiligence.templates'), icon: <IconFile className="h-4 w-4" />, onClick: () => setTemplatesOpen(true) },
            { label: t('p3Import.importButtonLabel'), icon: <IconUpload className="h-4 w-4" />, onClick: () => setImportDialogOpen(true), separatorBefore: true },
          ]}
        />

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList>
            <TabsTrigger value="contratos" className="flex items-center gap-2">
              <IconFile className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cardsKpi.sweep.contratos.contratos')}</span>
            </TabsTrigger>
            <TabsTrigger value="fornecedores" className="flex items-center gap-2">
              <IconOrg className="h-4 w-4" />
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
              drillDown: 'contratos_vigentes',
            },
            {
              key: 'valorVencido',
              label: t('cardsKpi.contratos.valorVencido'),
              value: formatMoedaEmpresa(statsContratos?.valorVencido || 0, true),
              tone: (statsContratos?.valorVencido || 0) > 0 ? 'destructive' : undefined,
              hint: t('cardsKpi.contratos.valorVencidoHint'),
              drillDown: 'contratos_vencidos',
            },
            {
              key: 'vencendo',
              label: t('cardsKpi.sweep.contratos.vencimentos'),
              value: statsContratos?.vencendo30Dias || 0,
              tone: 'warning',
              hint: t('fin.comum.proximos30'),
              drillDown: 'contratos_vencendo',
            },
            {
              key: 'renovacao',
              label: t('fin.contratos.renovacaoAutomatica'),
              value: statsContratos?.renovacaoAutomatica || 0,
              drillDown: 'contratos_renovacao',
            },
          ]}
        />

        <RelatoriosContratos open={relatoriosOpen} onOpenChange={setRelatoriosOpen} hideTrigger />
        <TemplatesContratos open={templatesOpen} onOpenChange={setTemplatesOpen} hideTrigger />

        {/* Tabs */}

          <TabsContent value="contratos" className="space-y-4">
            <Card className="rounded-lg border overflow-hidden">
              <CardContent className="p-0">
                <DataTable
                  data={sortedContratos}
                  columns={colunasContratos}
                  sortField={sortContratos?.field}
                  sortDirection={sortContratos?.direction}
                  onSort={toggleSortContratos}
                  loading={loadingContratos}
                  onRowClick={(c) => setDetalheContrato(c)}
                  searchValue={searchTerm}
                  onSearchChange={setSearchTerm}
                  searchPlaceholder={t('fin.contratos.buscar')}
                  filters={[
                    {
                      key: 'status',
                      label: t('fin.comum.status'),
                      value: statusFilter,
                      onChange: setStatusFilter,
                      options: [
                        { value: 'todos', label: t('campos.filtros.todos') },
                        { value: 'ativo', label: t('campos.opcoes.ativo') },
                        { value: 'a_vencer', label: t('fin.contratos.aVencer') },
                        { value: 'vencido', label: t('campos.opcoes.vencido') },
                        { value: 'rascunho', label: t('campos.opcoes.rascunho') },
                        { value: 'negociacao', label: t('fin.contratos.negociacao') },
                        { value: 'aprovacao', label: t('fin.comum.aprovacao') },
                        { value: 'suspenso', label: t('campos.opcoes.suspenso') },
                        { value: 'encerrado', label: t('campos.opcoes.encerrado') },
                      ],
                    },
                    {
                      key: 'tipo',
                      label: t('fin.comum.tipo'),
                      value: tipoFilter,
                      onChange: setTipoFilter,
                      options: [
                        { value: 'todos', label: t('campos.filtros.todos') },
                        { value: 'servicos', label: t('campos.opcoes.servicos') },
                        { value: 'licenciamento', label: t('campos.opcoes.licenciamento') },
                        { value: 'manutencao', label: t('fin.comum.manutencao') },
                        { value: 'consultoria', label: t('campos.opcoes.consultoria') },
                        { value: 'produto', label: t('campos.opcoes.produto') },
                      ],
                    },
                  ]}
                  emptyState={{
                    icon: <IconFile className="h-8 w-8" />,
                    title: t('fin.contratos.nenhum'),
                    description: t('cardsKpi.contratos.emptyContratos'),
                    action: {
                      label: t('fin.contratos.novo'),
                      onClick: () => { setSelectedContrato(null); setDialogOpen(true); },
                    },
                  }}
                  paginated
                  pageSize={10}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fornecedores Tab */}
          <TabsContent value="fornecedores" className="space-y-4">
            {/*
              Um só gestor de fornecedores, partilhado com Due Diligence: mesma
              tabela, consulta à Receita, PJ/PF e avaliação de risco. O `focoId`
              vindo da busca global abre o fornecedor pedido. As avaliações de
              due diligence ficam no seu módulo — aqui não se injectam acções.
            */}
            <FornecedoresManager
              ref={gestorFornecedores}
              botaoNovoNoCabecalho
              focoId={searchParams.get('focus')}
            />
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

        {selectedContrato && (
          <TrilhaAuditoria
            open={trilhaDialogOpen}
            onOpenChange={setTrilhaDialogOpen}
            registroId={selectedContrato.id}
            registroNome={selectedContrato.nome}
            tabela="contratos"
          />
        )}

        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
          title={t('sweepDados.contratos.excluirTitleContrato')}
          description={t('sweepDados.contratos.excluirDescContrato')}
          confirmText={t('fin.comum.excluir')}
          variant="destructive"
          onConfirm={confirmDelete}
        />
        <RecordDetailDrawer
          open={!!detalheContrato}
          onOpenChange={(o) => !o && setDetalheContrato(null)}
          title={detalheContrato?.nome}
          subtitle={detalheContrato?.numero_contrato}
          badges={detalheContrato ? (
            <>
              {getContratoStatusBadge(detalheContrato)}
              {/* O risco é do FORNECEDOR, não do contrato — sem o prefixo, um
                  "Baixo" ao lado do nome do contrato lia-se como risco dele. */}
              {detalheContrato.fornecedores?.avaliacao_risco
                ? getRiskBadge(detalheContrato.fornecedores.avaliacao_risco, t('fin.contratos.riscoFornecedor'))
                : null}
            </>
          ) : undefined}
          actions={detalheContrato ? (
            <Button variant="outline" size="sm" onClick={() => { const c = detalheContrato; setDetalheContrato(null); handleEdit(c); }}>
              {t('fin.comum.editar')}
            </Button>
          ) : undefined}
          fields={detalheContrato ? [
            { label: t('fin.comum.fornecedor'), value: detalheContrato.fornecedores?.nome },
            { label: t('fin.comum.tipo'), value: formatStatus(detalheContrato.tipo) },
            { label: t('fin.comum.valor'), value: detalheContrato.valor != null ? formatMoedaEmpresa(detalheContrato.valor) : null },
            { label: t('fin.comum.dataInicio'), value: detalheContrato.data_inicio ? formatDateOnly(detalheContrato.data_inicio) : null },
            { label: t('detalheRegisto.dataFim'), value: detalheContrato.data_fim ? formatDateOnly(detalheContrato.data_fim) : null },
            { label: t('detalheRegisto.responsavel'), value: detalheContrato.gestor_contrato ? (nomePorUsuario.get(detalheContrato.gestor_contrato) || detalheContrato.gestor_contrato) : null },
            { label: t('fin.contratos.objeto'), value: detalheContrato.objeto, full: true },
            { label: t('detalheRegisto.observacoes'), value: detalheContrato.observacoes, full: true },
          ] : []}
        />

      </div>
    </TooltipProvider>
  );
}
