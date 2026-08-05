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
        title: "Documento excluído",
        description: "O documento foi excluído com sucesso.",
      });

      invalidateDocumentos();
      setDeleteConfirm({ open: false, documentoId: '' });
    } catch (error) {
      logger.error('Erro ao excluir documento', { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: "Erro ao excluir documento",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  const handleBuscaAvancada = (filtros: any) => {
    setFiltrosAvancados(filtros);
    toast({
      title: "Filtros aplicados",
      description: "Os filtros avançados foram aplicados com sucesso.",
    });
  };

  const limparFiltros = () => {
    setSearchTerm('');
    setSelectedCategoria('all');
    setSelectedStatus('all');
    setSelectedTipo('all');
    setFiltrosAvancados(null);
    toast({
      title: "Filtros limpos",
      description: "Todos os filtros foram removidos.",
    });
  };

  const handleExportCSV = () => {
    const headers = ["Nome", "Tipo", "Classificação", "Status", "Versão", "Validade", "Data Criação"];
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
      title: "Exportação concluída",
      description: "O arquivo CSV foi baixado com sucesso.",
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
            title="Total de Documentos"
            value={statsDocumentos?.total || 0}
            description={`${statsDocumentos?.ativos || 0} ativos`}
            icon={<FileText />}
            loading={!statsDocumentos}
            drillDown="documentos"
            showAccent
            emptyHint="Cadastre políticas e procedimentos para começar."
          />

          <StatCard
            title="Aprovados"
            value={statsDocumentos?.aprovados || 0}
            description={`${statsDocumentos?.pendentesAprovacao || 0} pendentes`}
            icon={<CheckCircle />}
            variant="success"
            loading={!statsDocumentos}
            drillDown="documentos"
          />

          <StatCard
            title="Vencendo em 30 dias"
            value={statsDocumentos?.vencendo30Dias || 0}
            description={`${statsDocumentos?.vencidos || 0} já vencidos`}
            icon={<Clock />}
            variant={statsDocumentos?.vencendo30Dias ? "warning" : "default"}
            loading={!statsDocumentos}
            drillDown="documentos"
          />

          <StatCard
            title="Confidenciais"
            value={statsDocumentos?.confidenciais || 0}
            description="Acesso restrito"
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
                    placeholder="Buscar documentos..."
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
                    <TooltipContent>Exportar CSV</TooltipContent>
                  </Tooltip>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setUploadMultiplos(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCategoriasDialog(true)}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Categorias
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
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
                    Relatórios
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => openDocGen({ onDone: invalidateDocumentos })} 
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <AkurisAIIcon className="h-4 w-4 mr-2" />
                    Gerador de Documentos (IA)
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setDocumentoDialog({ open: true })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo
                  </Button>
                </div>
              </div>
              
              {/* Filtros básicos */}
              {showFilters && (
                <div className="flex gap-4 items-center flex-wrap p-4 bg-muted/50 rounded-lg mb-4">
                  <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Classificação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as classificações</SelectItem>
                      <SelectItem value="publica">Pública</SelectItem>
                      <SelectItem value="interna">Interna</SelectItem>
                      <SelectItem value="restrita">Restrita</SelectItem>
                      <SelectItem value="confidencial">Confidencial</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="politica">Política</SelectItem>
                      <SelectItem value="procedimento">Procedimento</SelectItem>
                      <SelectItem value="instrucao">Instrução</SelectItem>
                      <SelectItem value="formulario">Formulário</SelectItem>
                      <SelectItem value="certificado">Certificado</SelectItem>
                      <SelectItem value="contrato">Contrato</SelectItem>
                      <SelectItem value="relatorio">Relatório</SelectItem>
                      <SelectItem value="documento">Documento</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
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
                      Limpar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setBuscaAvancada(true)}>
                    <Search className="h-3 w-3 mr-1" />
                    Busca Avançada
                  </Button>
                </div>
              )}

              {/* Indicador de filtros aplicados */}
              {filtrosAvancados && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Filter className="h-4 w-4" />
                  Filtros avançados aplicados
                  <Badge variant="secondary">
                    {Object.keys(filtrosAvancados).length} filtro(s)
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
                    ? 'Nenhum documento encontrado'
                    : 'Nenhum documento cadastrado'}
                  description={temFiltrosAtivos
                    ? 'Tente ajustar os filtros para encontrar o que procura.'
                    : 'Comece criando documentos para gerenciar suas políticas e procedimentos.'}
                  action={!temFiltrosAtivos ? {
                    label: 'Novo Documento',
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
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, documentosFiltrados.length)} de {documentosFiltrados.length}
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
          title="Excluir Documento"
          description="Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita."
          confirmText="Excluir"
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
