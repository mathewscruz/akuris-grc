import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useFocusRow } from '@/hooks/useFocusRow';
import { Plus, Search, Filter, Upload, FileText, FolderOpen, Download, CheckCircle, Clock, Shield, TrendingUp } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentoDialog } from '@/components/documentos/DocumentoDialog';
import { CategoriasDialog } from '@/components/documentos/CategoriasDialog';
import { VinculacoesDialog } from '@/components/documentos/VinculacoesDialog';
import { AprovacaoDialog } from '@/components/documentos/AprovacaoDialog';
import { ComentariosDialog } from '@/components/documentos/ComentariosDialog';
import { DocumentosRelatorios } from '@/components/documentos/DocumentosRelatorios';
import { BuscaAvancadaDocumentos } from '@/components/documentos/BuscaAvancadaDocumentos';
import { UploadMultiplosDialog } from '@/components/documentos/UploadMultiplosDialog';
import { DocumentoPreview } from '@/components/documentos/DocumentoPreview';
import { TrilhaAuditoriaDocumentos } from '@/components/documentos/TrilhaAuditoriaDocumentos';
import { useDocGen } from '@/contexts/DocGenContext';
import { RenovarDocumentoDialog } from '@/components/documentos/RenovarDocumentoDialog';
import { DocumentosLista } from '@/components/documentos/DocumentosLista';
import { HistoricoVersoesDialog } from '@/components/documentos/HistoricoVersoesDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';
import { useDocumentosStats } from '@/hooks/useDocumentosStats';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly } from '@/lib/date-utils';

interface Documento {
  id: string;
  empresa_id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  classificacao?: string;
  tags?: string[];
  arquivo_url?: string;
  arquivo_nome?: string;
  arquivo_tipo?: string;
  arquivo_tamanho?: number;
  versao: number;
  is_current_version: boolean;
  requer_aprovacao?: boolean;
  status: string;
  data_vencimento?: string;
  data_aprovacao?: string;
  aprovado_por?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
}

export default function Documentos() {
  const { t } = useLanguage();
  useFocusRow();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();
  const [documentosFiltrados, setDocumentosFiltrados] = useState<Documento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTipo, setSelectedTipo] = useState<string>('all');
  const [documentoDialog, setDocumentoDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [categoriasDialog, setCategoriasDialog] = useState(false);
  const [vinculacoesDialog, setVinculacoesDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [aprovacaoDialog, setAprovacaoDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [comentariosDialog, setComentariosDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [auditoriaDialog, setAuditoriaDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [buscaAvancada, setBuscaAvancada] = useState(false);
  const [uploadMultiplos, setUploadMultiplos] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState<any>(null);
  const { openDocGen } = useDocGen();
  const [relatoriosDialog, setRelatoriosDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [renovarDialog, setRenovarDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [historicoDialog, setHistoricoDialog] = useState<{ open: boolean; documento?: Documento }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; documentoId: string }>({
    open: false,
    documentoId: ''
  });
  const { toast } = useToast();
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Buscar estatísticas dos documentos
  const { data: statsDocumentos } = useDocumentosStats();

  // React Query para documentos
  const { data: documentos = [], isLoading: loading } = useQuery({
    queryKey: ['documentos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Documento[];
    },
    enabled: !!empresaId,
  });

  const invalidateDocumentos = () => {
    queryClient.invalidateQueries({ queryKey: ['documentos'] });
    queryClient.invalidateQueries({ queryKey: ['documentos-stats'] });
  };

  // Fetch categorias via React Query
  const { data: categoriasData = [] } = useQuery({
    queryKey: ['documentos-categorias', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('documentos_categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome');
      if (error) throw error;
      return (data || []) as Categoria[];
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    setCategorias(categoriasData);
  }, [categoriasData]);

  useEffect(() => {
    aplicarFiltros();
  }, [documentos, searchTerm, selectedCategoria, selectedStatus, selectedTipo, filtrosAvancados]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategoria, selectedStatus, selectedTipo, filtrosAvancados]);

  // Detectar se veio com itemId do dashboard
  useEffect(() => {
    const itemId = location.state?.itemId;
    if (itemId && documentos.length > 0) {
      const documento = documentos.find(d => d.id === itemId);
      if (documento) {
        setDocumentoDialog({ open: true, documento });
      }
    }
  }, [location.state, documentos]);

  // Detectar parâmetro de aprovação na URL (deep link do e-mail)
  useEffect(() => {
    const aprovarId = searchParams.get('aprovar');
    if (aprovarId && documentos.length > 0) {
      const documento = documentos.find(d => d.id === aprovarId);
      if (documento) {
        // Abrir o popup de aprovação automaticamente
        setAprovacaoDialog({ open: true, documento });
        // Limpar o parâmetro da URL para evitar reabrir em refresh
        searchParams.delete('aprovar');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, documentos, setSearchParams]);

  const aplicarFiltros = () => {
    let filtered = [...documentos];

    // Filtro de busca simples
    if (searchTerm) {
      filtered = filtered.filter(documento => 
        documento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        documento.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        documento.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtros básicos
    if (selectedCategoria !== 'all') {
      filtered = filtered.filter(doc => doc.classificacao === selectedCategoria);
    }

    if (selectedStatus !== 'all') {
      if (selectedStatus === 'vencido') {
        const hoje = new Date();
        filtered = filtered.filter(doc => {
          if (!doc.data_vencimento) return false;
          return new Date(doc.data_vencimento) < hoje;
        });
      } else {
        filtered = filtered.filter(doc => doc.status === selectedStatus);
      }
    }

    if (selectedTipo !== 'all') {
      filtered = filtered.filter(doc => doc.tipo === selectedTipo);
    }

    // Filtros avançados
    if (filtrosAvancados) {
      if (filtrosAvancados.dataInicio) {
        filtered = filtered.filter(doc => 
          new Date(doc.created_at) >= filtrosAvancados.dataInicio
        );
      }

      if (filtrosAvancados.dataFim) {
        filtered = filtered.filter(doc => 
          new Date(doc.created_at) <= filtrosAvancados.dataFim
        );
      }

      if (filtrosAvancados.dataVencimentoInicio && filtrosAvancados.dataVencimentoInicio) {
        filtered = filtered.filter(doc => 
          doc.data_vencimento && 
          new Date(doc.data_vencimento) >= filtrosAvancados.dataVencimentoInicio
        );
      }

      if (filtrosAvancados.dataVencimentoFim) {
        filtered = filtered.filter(doc => 
          doc.data_vencimento && 
          new Date(doc.data_vencimento) <= filtrosAvancados.dataVencimentoFim
        );
      }

      if (filtrosAvancados.confidencial !== undefined) {
        filtered = filtered.filter(doc => doc.classificacao === 'confidencial');
      }

      if (filtrosAvancados.comArquivo !== undefined) {
        if (filtrosAvancados.comArquivo) {
          filtered = filtered.filter(doc => doc.arquivo_url);
        } else {
          filtered = filtered.filter(doc => !doc.arquivo_url);
        }
      }

      if (filtrosAvancados.tamanhoMin) {
        const minBytes = filtrosAvancados.tamanhoMin * 1024 * 1024;
        filtered = filtered.filter(doc => 
          doc.arquivo_tamanho && doc.arquivo_tamanho >= minBytes
        );
      }

      if (filtrosAvancados.tamanhoMax) {
        const maxBytes = filtrosAvancados.tamanhoMax * 1024 * 1024;
        filtered = filtered.filter(doc => 
          doc.arquivo_tamanho && doc.arquivo_tamanho <= maxBytes
        );
      }

      if (filtrosAvancados.tags) {
        const searchTags = filtrosAvancados.tags.split(',').map((tag: string) => tag.trim().toLowerCase());
        filtered = filtered.filter(doc => 
          doc.tags && searchTags.some(searchTag => 
            doc.tags!.some(docTag => docTag.toLowerCase().includes(searchTag))
          )
        );
      }
    }

    setDocumentosFiltrados(filtered);
  };

  const handleDeleteDocumento = (id: string) => {
    setDeleteConfirm({ open: true, documentoId: id });
  };

  const podeRenovar = (documento: Documento): boolean => {
    if (!documento.data_vencimento) return false;
    
    const hoje = new Date();
    const vencimento = new Date(documento.data_vencimento);
    const diasParaVencer = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    return diasParaVencer <= 30;
  };

  const confirmDeleteDocumento = async () => {
    try {
      const { error } = await supabase
        .from('documentos')
        .delete()
        .eq('id', deleteConfirm.documentoId);

      if (error) throw error;

      toast({
        title: t('documentos.lista.documentoExcluidoTitulo'),
        description: t('documentos.lista.documentoExcluidoDescricao'),
      });

      invalidateDocumentos();
      setDeleteConfirm({ open: false, documentoId: '' });
    } catch (error) {
      logger.error('Erro ao excluir documento', { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: t('documentos.lista.erroExcluirTitulo'),
        description: t('documentos.lista.erroExcluirDescricao'),
        variant: "destructive",
      });
    }
  };

  const handleBuscaAvancada = (filtros: any) => {
    setFiltrosAvancados(filtros);
    toast({
      title: t('documentos.lista.filtrosAplicadosToastTitulo'),
      description: t('documentos.lista.filtrosAplicadosToastDescricao'),
    });
  };

  const limparFiltros = () => {
    setSearchTerm('');
    setSelectedCategoria('all');
    setSelectedStatus('all');
    setSelectedTipo('all');
    setFiltrosAvancados(null);
    toast({
      title: t('documentos.lista.filtrosLimposToastTitulo'),
      description: t('documentos.lista.filtrosLimposToastDescricao'),
    });
  };

  const handleExportCSV = () => {
    const headers = [t('documentos.lista.nome'), t('documentos.lista.tipo'), t('documentos.lista.classificacao'), t('documentos.lista.status'), t('documentos.lista.versao'), t('documentos.lista.validade'), t('sweepDocumentos.lista.dataCriacao')];
    const rows = documentosFiltrados.map(doc => [
      doc.nome,
      doc.tipo,
      doc.classificacao || "",
      doc.status,
      doc.versao,
      doc.data_vencimento ? formatDateOnly(doc.data_vencimento) : "",
      formatDateOnly(doc.created_at)
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `documentos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({
      title: t('documentos.lista.exportacaoConcluidaTitulo'),
      description: t('documentos.lista.exportacaoConcluidaDescricao'),
    });
  };

  const temFiltrosAtivos = Boolean(
    filtrosAvancados ||
    searchTerm ||
    selectedCategoria !== 'all' ||
    selectedStatus !== 'all' ||
    selectedTipo !== 'all'
  );

  // Paginação
  const totalPages = Math.ceil(documentosFiltrados.length / itemsPerPage);

  const paginatedDocumentos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return documentosFiltrados.slice(start, start + itemsPerPage);
  }, [documentosFiltrados, currentPage, itemsPerPage]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('modules.documentos.title')}
          description={t('modules.documentos.description')}
        />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
          <PageHeader
          title={t('modules.documentos.title')}
          description={t('modules.documentos.description')}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('documentos.lista.totalDocumentos')}
            value={statsDocumentos?.total || 0}
            description={t('documentos.lista.ativos', { count: statsDocumentos?.ativos || 0 })}
            icon={<FileText />}
            loading={!statsDocumentos}
            drillDown="documentos"
            showAccent
            emptyHint={t('documentos.lista.comeceCriando')}
          />

          <StatCard
            title={t('documentos.lista.aprovados')}
            value={statsDocumentos?.aprovados || 0}
            description={t('documentos.lista.pendentes', { count: statsDocumentos?.pendentesAprovacao || 0 })}
            icon={<CheckCircle />}
            variant="success"
            loading={!statsDocumentos}
            drillDown="documentos"
          />

          <StatCard
            title={t('documentos.lista.vencendo30')}
            value={statsDocumentos?.vencendo30Dias || 0}
            description={t('documentos.lista.jaVencidos', { count: statsDocumentos?.vencidos || 0 })}
            icon={<Clock />}
            variant={statsDocumentos?.vencendo30Dias ? "warning" : "default"}
            loading={!statsDocumentos}
            drillDown="documentos"
          />

          <StatCard
            title={t('documentos.lista.confidenciais')}
            value={statsDocumentos?.confidenciais || 0}
            description={t('documentos.lista.acessoRestrito')}
            icon={<Shield />}
            variant="info"
            loading={!statsDocumentos}
            drillDown="documentos"
          />
        </div>

        {/* Tabela de documentos com estrutura integrada */}
        <Card className="rounded-lg border overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('documentos.lista.buscarDocumentos')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={handleExportCSV}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('documentos.lista.exportarCSV')}</TooltipContent>
                  </Tooltip>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setUploadMultiplos(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t('documentos.lista.upload')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCategoriasDialog(true)}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {t('documentos.lista.categorias')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {t('documentos.lista.filtros')}
                    {showFilters && (
                      <span className="ml-1 text-xs text-muted-foreground">▲</span>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setRelatoriosDialog(true)}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {t('documentos.lista.relatorios')}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => openDocGen({ onDone: invalidateDocumentos })} 
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <AkurisAIIcon className="h-4 w-4 mr-2" />
                    {t('documentos.lista.geradorIA')}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setDocumentoDialog({ open: true })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('documentos.lista.novo')}
                  </Button>
                </div>
              </div>
              
              {/* Filtros básicos */}
              {showFilters && (
                <div className="flex gap-4 items-center flex-wrap p-4 bg-muted/50 rounded-lg mb-4">
                  <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={t('documentos.lista.classificacao')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('documentos.lista.todasClassificacoes')}</SelectItem>
                      <SelectItem value="publica">{t('documentos.lista.publica')}</SelectItem>
                      <SelectItem value="interna">{t('documentos.lista.interna')}</SelectItem>
                      <SelectItem value="restrita">{t('documentos.lista.restrita')}</SelectItem>
                      <SelectItem value="confidencial">{t('documentos.lista.confidencial')}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder={t('documentos.lista.status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('documentos.lista.todos')}</SelectItem>
                      <SelectItem value="ativo">{t('documentos.lista.ativo')}</SelectItem>
                      <SelectItem value="inativo">{t('documentos.lista.inativo')}</SelectItem>
                      <SelectItem value="arquivado">{t('documentos.lista.arquivado')}</SelectItem>
                      <SelectItem value="vencido">{t('documentos.lista.vencido')}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t('documentos.lista.tipo')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('documentos.lista.todosOsTipos')}</SelectItem>
                      <SelectItem value="politica">{t('documentos.lista.politica')}</SelectItem>
                      <SelectItem value="procedimento">{t('documentos.lista.procedimento')}</SelectItem>
                      <SelectItem value="instrucao">{t('documentos.lista.instrucao')}</SelectItem>
                      <SelectItem value="formulario">{t('documentos.lista.formulario')}</SelectItem>
                      <SelectItem value="certificado">{t('documentos.lista.certificado')}</SelectItem>
                      <SelectItem value="contrato">{t('documentos.lista.contrato')}</SelectItem>
                      <SelectItem value="relatorio">{t('documentos.lista.relatorio')}</SelectItem>
                      <SelectItem value="documento">{t('documentos.lista.documento')}</SelectItem>
                      <SelectItem value="manual">{t('documentos.lista.manual')}</SelectItem>
                    </SelectContent>
                  </Select>

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

                  {(searchTerm || selectedCategoria !== 'all' || selectedStatus !== 'all' || selectedTipo !== 'all' || filtrosAvancados) && (
                    <Button variant="ghost" size="sm" onClick={limparFiltros}>
                      {t('documentos.lista.limpar')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setBuscaAvancada(true)}>
                    <Search className="h-3 w-3 mr-1" />
                    {t('documentos.lista.buscaAvancada')}
                  </Button>
                </div>
              )}

              {/* Indicador de filtros aplicados */}
              {filtrosAvancados && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Filter className="h-4 w-4" />
                  {t('documentos.lista.filtrosAplicados')}
                  <Badge variant="secondary">
                    {t('documentos.lista.filtrosCount', { count: Object.keys(filtrosAvancados).length })}
                  </Badge>
                </div>
              )}
            </div>
            
            <DocumentosLista
              documentos={paginatedDocumentos}
              podeRenovar={podeRenovar}
              emptyState={
                <EmptyState
                  icon={<FileText className="h-8 w-8" />}
                  title={temFiltrosAtivos
                    ? t('documentos.lista.nenhumEncontrado')
                    : t('documentos.lista.nenhumCadastrado')}
                  description={temFiltrosAtivos
                    ? t('documentos.lista.ajusteFiltros')
                    : t('documentos.lista.comeceCriando')}
                  action={!temFiltrosAtivos ? {
                    label: t('documentos.lista.novoDocumento'),
                    onClick: () => setDocumentoDialog({ open: true })
                  } : undefined}
                />
              }
              onPreview={(documento) => setPreviewDialog({ open: true, documento })}
              onEditar={(documento) => setDocumentoDialog({ open: true, documento })}
              onVinculacoes={(documento) => setVinculacoesDialog({ open: true, documento })}
              onComentarios={(documento) => setComentariosDialog({ open: true, documento })}
              onAprovacao={(documento) => setAprovacaoDialog({ open: true, documento })}
              onRenovar={(documento) => setRenovarDialog({ open: true, documento })}
              onHistorico={(documento) => setHistoricoDialog({ open: true, documento })}
              onAuditoria={(documento) => setAuditoriaDialog({ open: true, documento })}
              onExcluir={(documento) => handleDeleteDocumento(documento.id)}
            />

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {t('documentos.lista.mostrando', { inicio: ((currentPage - 1) * itemsPerPage) + 1, fim: Math.min(currentPage * itemsPerPage, documentosFiltrados.length), total: documentosFiltrados.length })}
                </span>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page = i + 1;
                      if (totalPages > 5) {
                        if (currentPage > 3) {
                          page = currentPage - 2 + i;
                        }
                        if (page > totalPages) {
                          page = totalPages - 4 + i;
                        }
                      }
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <DocumentoDialog
          open={documentoDialog.open}
          onOpenChange={(open) => setDocumentoDialog({ open })}
          documento={documentoDialog.documento}
          onSuccess={() => {
            invalidateDocumentos();
            setDocumentoDialog({ open: false });
          }}
        />

        <CategoriasDialog
          open={categoriasDialog}
          onOpenChange={setCategoriasDialog}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documentos-categorias'] })}
          empresaId={empresaId}
        />

        {vinculacoesDialog.documento && (
          <VinculacoesDialog
            open={vinculacoesDialog.open}
            onOpenChange={(open) => setVinculacoesDialog({ open })}
            documento={vinculacoesDialog.documento}
            empresaId={empresaId}
          />
        )}

        {aprovacaoDialog.documento && (
          <AprovacaoDialog
            open={aprovacaoDialog.open}
            onOpenChange={(open) => setAprovacaoDialog({ open })}
            documento={aprovacaoDialog.documento}
            onSuccess={invalidateDocumentos}
            empresaId={empresaId}
          />
        )}

        {comentariosDialog.documento && (
          <ComentariosDialog
            open={comentariosDialog.open}
            onOpenChange={(open) => setComentariosDialog({ open })}
            documento={comentariosDialog.documento}
          />
        )}

        {previewDialog.documento && (
          <DocumentoPreview
            open={previewDialog.open}
            onOpenChange={(open) => setPreviewDialog({ open })}
            documento={previewDialog.documento}
          />
        )}

        {auditoriaDialog.documento && (
          <TrilhaAuditoriaDocumentos
            open={auditoriaDialog.open}
            onOpenChange={(open) => setAuditoriaDialog({ open })}
            documentoId={auditoriaDialog.documento.id}
            documentoNome={auditoriaDialog.documento.nome}
          />
        )}

        <BuscaAvancadaDocumentos
          open={buscaAvancada}
          onOpenChange={setBuscaAvancada}
          onSearch={handleBuscaAvancada}
          categorias={categorias}
        />

        <UploadMultiplosDialog
          open={uploadMultiplos}
          onOpenChange={setUploadMultiplos}
          onSuccess={invalidateDocumentos}
          categorias={categorias}
        />

        <DocumentosRelatorios
          open={relatoriosDialog}
          onOpenChange={setRelatoriosDialog}
          documentos={documentos}
          categorias={categorias}
        />

        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
          title={t('documentos.lista.excluirDocumentoTitulo')}
          description={t('documentos.lista.excluirDocumentoDescricao')}
          confirmText={t('documentos.lista.excluir')}
          variant="destructive"
          onConfirm={confirmDeleteDocumento}
        />

        <RenovarDocumentoDialog
          open={renovarDialog.open}
          onOpenChange={(open) => setRenovarDialog({ open, documento: undefined })}
          documento={renovarDialog.documento || null}
          onSuccess={invalidateDocumentos}
        />

        <HistoricoVersoesDialog
          open={historicoDialog.open}
          onOpenChange={(open) => setHistoricoDialog({ open, documento: undefined })}
          documento={historicoDialog.documento || null}
        />
      </div>
    </TooltipProvider>
  );
}
