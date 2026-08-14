import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useLocation, useSearchParams } from "react-router-dom";
import { Plus, Shield, AlertTriangle, CheckCircle, Clock, Link, BarChart3, Edit, Trash2, Filter, TestTube, Download, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ControleDialog from "@/components/controles/ControleDialog";
import { ControleDetalheDialog } from "@/components/controles/ControleDetalheDialog";
import CategoriasDialog from "@/components/controles/CategoriasDialog";
import TestesDialog from "@/components/controles/TestesDialog";
import ControlesVinculacaoDialog from "@/components/controles/ControlesVinculacaoDialog";
import { RelatoriosDialog } from "@/components/controles/RelatoriosDialog";
import { useControlesStats } from "@/hooks/useControlesStats";
import { StatStrip } from "@/components/ui/stat-strip";
import {
  DropdownMenu as ActionsMenu,
  DropdownMenuContent as ActionsMenuContent,
  DropdownMenuItem as ActionsMenuItem,
  DropdownMenuTrigger as ActionsMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/ui/data-table";
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { capitalizeText, formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone, resolveControleStatusTone, resolveControleTipoTone } from '@/lib/status-tone';
import { formatDateOnly } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Controle {
  id: string;
  codigo?: string;
  nome: string;
  descricao?: string;
  tipo: string;
  processo?: string;
  area?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  responsavel_foto?: string;
  frequencia?: string;
  status: string;
  criticidade: string;
  data_implementacao?: string;
  proxima_avaliacao?: string;
  categoria?: {
    nome: string;
    cor: string;
  };
  testesCount?: number;
}

interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
}

export default function ControlesContent({ actionsSlot }: { actionsSlot?: HTMLElement | null } = {}) {
  const { t } = useLanguage();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [controleDialogOpen, setControleDialogOpen] = useState(false);
  const [categoriasDialogOpen, setCategoriasDialogOpen] = useState(false);
  const [testesDialogOpen, setTestesDialogOpen] = useState(false);
  const [vinculacaoDialogOpen, setVinculacaoDialogOpen] = useState(false);
  const [relatoriosDialogOpen, setRelatoriosDialogOpen] = useState(false);
  const [editingControle, setEditingControle] = useState<Controle | null>(null);
  const [selectedControleForTests, setSelectedControleForTests] = useState<Controle | null>(null);
  const [selectedControleForVinculacao, setSelectedControleForVinculacao] = useState<Controle | null>(null);
  const [selectedControleForDetail, setSelectedControleForDetail] = useState<Controle | null>(null);
  const [detalheDialogOpen, setDetalheDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; controleId: string }>({
    open: false,
    controleId: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [criticidadeFilter, setCriticidadeFilter] = useState<string>("todos");
  const [auditoriaFilter, setAuditoriaFilter] = useState<string>("todas");
  const [searchValue, setSearchValue] = useState<string>("");
  const [sortField, setSortField] = useState<string>("nome");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tipoFilter, criticidadeFilter, auditoriaFilter, searchValue]);

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Buscar estatísticas dos controles
  const { data: stats } = useControlesStats();

  // Buscar auditorias para o filtro
  const { data: auditorias = [] } = useQuery({
    queryKey: ['auditorias-lista', empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('auditorias')
        .select('id, nome')
        .eq('empresa_id', empresaId!)
        .order('nome');
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar controles
  const { data: controles = [], isLoading } = useQuery({
    queryKey: ['controles', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles')
        .select(`
          *,
          categoria:controles_categorias(nome, cor)
        `)
        .eq('empresa_id', empresaId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Buscar nomes e fotos dos responsáveis e contagem de testes
      if (data && data.length > 0) {
        const responsavelIds = data
          .map(c => c.responsavel_id)
          .filter(r => r && r.trim() !== '');
        
        // Buscar contagem de testes para cada controle (filtrado por IDs da empresa)
        const ids = data.map(c => c.id);
        const { data: testes } = await supabase
          .from('controles_testes')
          .select('controle_id')
          .in('controle_id', ids);
        
        const testesCountMap = new Map<string, number>();
        testes?.forEach(t => {
          const count = testesCountMap.get(t.controle_id) || 0;
          testesCountMap.set(t.controle_id, count + 1);
        });
        
        let profileMap = new Map<string, { nome: string; foto_url: string | null }>();
        
        if (responsavelIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, nome, foto_url')
            .in('user_id', responsavelIds);
          
          profileMap = new Map(
            profiles?.map(p => [p.user_id, { nome: p.nome, foto_url: p.foto_url }]) || []
          );
        }
        
        const mappedData = data.map(controle => {
          const profileData = (controle.responsavel_id && controle.responsavel_id.trim() !== '') 
            ? profileMap.get(controle.responsavel_id) 
            : null;
          return {
            ...controle,
            responsavel_nome: profileData?.nome || null,
            responsavel_foto: profileData?.foto_url || null,
            testesCount: testesCountMap.get(controle.id) || 0
          };
        });
        
        return mappedData as Controle[];
      }
      
      return data as Controle[];
    },
    enabled: !!empresaId,
  });

  // Buscar vínculos controles-auditorias (filtrado pelos controles da empresa)
  const controleIds = useMemo(() => controles.map(c => c.id), [controles]);
  const { data: vinculos = [] } = useQuery({
    queryKey: ['controles-auditorias-vinculos', empresaId, controleIds],
    queryFn: async () => {
      if (controleIds.length === 0) return [];
      const { data } = await supabase
        .from('controles_auditorias')
        .select('controle_id, auditoria_id')
        .in('controle_id', controleIds);
      return data || [];
    },
    enabled: !!empresaId && controleIds.length > 0
  });

  // Detectar se veio com itemId do dashboard
  useEffect(() => {
    const itemId = location.state?.itemId;
    if (itemId && controles.length > 0) {
      const controle = controles.find(c => c.id === itemId);
      if (controle) {
        setEditingControle(controle);
        setControleDialogOpen(true);
        // Limpar o state para evitar reaberturas
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, controles]);

  // Detectar parâmetro de controle na URL (deep link do e-mail)
  useEffect(() => {
    const controleId = searchParams.get('controle');
    if (controleId && controles.length > 0) {
      const controle = controles.find(c => c.id === controleId);
      if (controle) {
        setSelectedControleForDetail(controle);
        setDetalheDialogOpen(true);
        // Limpar o parâmetro da URL para evitar reabrir em refresh
        searchParams.delete('controle');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, controles, setSearchParams]);

  // Buscar categorias filtradas por empresa
  const { data: categorias = [] } = useQuery({
    queryKey: ['controles_categorias', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles_categorias')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('nome');
      
      if (error) throw error;
      return data as Categoria[];
    },
    enabled: !!empresaId
  });

  // Deletar controle
  const deleteControleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('controles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      toast({
        title: t("governancaComp.controles.toastDeletedTitle"),
        description: t("governancaComp.controles.toastDeletedDesc"),
      });
    },
    onError: () => {
      toast({
        title: t("governancaComp.controles.toastErrorTitle"),
        description: t("governancaComp.controles.toastErrorDesc"),
        variant: "destructive",
      });
    }
  });

  const handleEdit = (controle: Controle) => {
    setEditingControle(controle);
    setControleDialogOpen(true);
  };

  const handleOpenDetail = (controle: Controle) => {
    setSelectedControleForDetail(controle);
    setDetalheDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, controleId: id });
  };

  const confirmDelete = () => {
    deleteControleMutation.mutate(deleteConfirm.controleId);
    setDeleteConfirm({ open: false, controleId: '' });
  };

  // Filter and sort data
  const sortedControles = useMemo(() => {
    const filtered = controles.filter(controle => {
      const matchStatus = statusFilter === "todos" || controle.status === statusFilter;
      const matchTipo = tipoFilter === "todos" || controle.tipo === tipoFilter;
      const matchCriticidade = criticidadeFilter === "todos" || controle.criticidade === criticidadeFilter;
      const matchAuditoria = auditoriaFilter === "todas" || 
        vinculos.some(v => v.controle_id === controle.id && v.auditoria_id === auditoriaFilter);
      const matchSearch = !searchValue || 
        controle.nome.toLowerCase().includes(searchValue.toLowerCase()) ||
        controle.descricao?.toLowerCase().includes(searchValue.toLowerCase());
      
      return matchStatus && matchTipo && matchCriticidade && matchAuditoria && matchSearch;
    });

    return filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof Controle];
      let bVal: any = b[sortField as keyof Controle];
      
      // Tratamento especial para datas
      if (sortField === 'proxima_avaliacao' || sortField === 'data_implementacao') {
        aVal = aVal ? new Date(aVal as string).getTime() : 0;
        bVal = bVal ? new Date(bVal as string).getTime() : 0;
      }
      
      // Tratamento para categoria (objeto aninhado)
      if (sortField === 'categoria') {
        aVal = a.categoria?.nome || '';
        bVal = b.categoria?.nome || '';
      }
      
      // Tratamento para responsável
      if (sortField === 'responsavel') {
        aVal = a.responsavel_nome || '';
        bVal = b.responsavel_nome || '';
      }
      
      // Comparação
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [controles, sortField, sortDirection, statusFilter, tipoFilter, criticidadeFilter, auditoriaFilter, vinculos, searchValue]);

  const getStatusBadge = (status: string) => {
    return (
      <StatusBadge size="sm" {...resolveControleStatusTone(status)}>
        {formatStatus(status)}
      </StatusBadge>
    );
  };

  const getCriticidadeBadge = (criticidade: string) => {
    return (
      <StatusBadge size="sm" {...resolveCriticidadeTone(criticidade)}>
        {formatStatus(criticidade)}
      </StatusBadge>
    );
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'preventivo': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'detectivo': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'corretivo': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const controlesColumns = [
    {
      key: 'codigo' as keyof Controle,
      label: t("governancaComp.controles.columnCodigo"),
      sortable: true,
      render: (value: any, controle: Controle) => (
        <span className="font-mono text-xs text-muted-foreground">
          {controle.codigo || '-'}
        </span>
      )
    },
    {
      key: 'nome' as keyof Controle,
      label: t("governancaComp.controles.columnNome"),
      sortable: true,
      render: (value: any, controle: Controle) => (
        <button 
          className="font-medium text-left hover:text-primary hover:underline transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetail(controle);
          }}
        >
          {controle.nome}
        </button>
      )
    },
    {
      key: 'categoria' as keyof Controle,
      label: t("governancaComp.controles.columnCategoria"),
      sortable: true,
      render: (value: any, controle: Controle) => controle.categoria ? (
        <Badge 
          variant="outline" 
          style={{ borderColor: controle.categoria.cor, color: controle.categoria.cor }}
        >
          {controle.categoria.nome}
        </Badge>
      ) : <span className="text-muted-foreground">-</span>
    },
    {
      key: 'tipo' as keyof Controle,
      label: t("governancaComp.controles.columnTipo"),
      sortable: true,
      render: (value: any, controle: Controle) => (
        <StatusBadge size="sm" {...resolveControleTipoTone(controle.tipo)}>
          {capitalizeText(controle.tipo)}
        </StatusBadge>
      )
    },
    {
      key: 'status' as keyof Controle,
      label: t("governancaComp.controles.columnStatus"),
      sortable: true,
      render: (value: any, controle: Controle) => getStatusBadge(controle.status)
    },
    {
      key: 'criticidade' as keyof Controle,
      label: t("governancaComp.controles.columnCriticidade"),
      sortable: true,
      render: (value: any, controle: Controle) => getCriticidadeBadge(controle.criticidade)
    },
    {
      key: 'responsavel' as keyof Controle,
      label: t("governancaComp.controles.columnResponsavel"),
      sortable: true,
      render: (value: any, controle: Controle) => {
        if (controle.responsavel_nome) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    {controle.responsavel_foto && (
                      <AvatarImage src={controle.responsavel_foto} alt={controle.responsavel_nome} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {controle.responsavel_nome
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{controle.responsavel_nome}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      }
    },
    {
      key: 'testesCount' as keyof Controle,
      label: t("governancaComp.controles.columnTestes"),
      sortable: true,
      render: (value: any, controle: Controle) => (
        <Badge 
          variant={controle.testesCount && controle.testesCount > 0 ? "secondary" : "outline"}
          className="whitespace-nowrap"
        >
          {controle.testesCount || 0}
        </Badge>
      )
    },
    {
      key: 'proxima_avaliacao' as keyof Controle,
      label: t("governancaComp.controles.columnVencimento"),
      sortable: true,
      render: (value: any, controle: Controle) => {
        if (!controle.proxima_avaliacao) {
          return <span className="text-muted-foreground">-</span>;
        }
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataAvaliacao = new Date(controle.proxima_avaliacao);
        dataAvaliacao.setHours(0, 0, 0, 0);
        const isVencido = dataAvaliacao < hoje;
        
        return (
          <span className={isVencido ? "text-destructive font-medium" : ""}>
            {formatDateOnly(controle.proxima_avaliacao)}
            {isVencido && <span className="ml-1 text-xs">{t("governancaComp.controles.vencido")}</span>}
          </span>
        );
      }
    },
    {
      key: 'actions' as keyof Controle,
      label: t("governancaComp.controles.columnAcoes"),
      sortable: false,
      render: (value: any, controle: Controle) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(controle)}>
              <Edit className="h-4 w-4 mr-2" />
              {t("governancaComp.controles.buttonEditar")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setSelectedControleForTests(controle);
              setTestesDialogOpen(true);
            }}>
              <TestTube className="h-4 w-4 mr-2" />
              {t("governancaComp.controles.buttonGerenciarTestes")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setSelectedControleForVinculacao(controle);
              setVinculacaoDialogOpen(true);
            }}>
              <Link className="h-4 w-4 mr-2" />
              {t("governancaComp.controles.buttonGerenciarVinculacoes")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(controle.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              {t("governancaComp.controles.buttonExcluir")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <StatStrip
        loading={isLoading}
        items={[
          { key: 'total', label: t("governancaComp.controles.statTotal"), value: stats?.total || 0, drillDown: 'controles' },
          { key: 'vencidas', label: t("governancaComp.controles.statVencidas"), value: stats?.vencidos || 0, tone: 'destructive', drillDown: 'controles' },
          { key: 'vencendo', label: t("governancaComp.controles.statVencendo"), value: stats?.vencendoAvaliacao || 0, tone: 'warning', drillDown: 'controles' },
          {
            key: 'efetividade',
            label: t("governancaComp.controles.statEfetividade"),
            value: stats?.efetividade === null || stats?.efetividade === undefined
              ? t('cardsKpi.metricas.semDados')
              : `${stats.efetividade}%`,
            hint: stats?.efetividade === null || stats?.efetividade === undefined
              ? t('cardsKpi.metricas.efetividadeSemTestes')
              : t('cardsKpi.metricas.efetividadeTestada', { testados: stats?.controlesTestados ?? 0, total: stats?.total ?? 0 }),
            drillDown: 'controles',
          },
          {
            key: 'preventivos',
            label: t('cardsKpi.metricas.preventivosDe', { preventivos: stats?.preventivos ?? 0, total: stats?.total ?? 0 }),
            value: `${stats?.percentualPreventivos ?? 0}%`,
            drillDown: 'controles',
          },
        ]}
      />

      {actionsSlot && createPortal(
        <>
        <ActionsMenu>
          <ActionsMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("layout.moreActions")} title={t("layout.moreActions")}>
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </ActionsMenuTrigger>
          <ActionsMenuContent align="end" className="w-56">
            <ActionsMenuItem onClick={() => {
              const headers = [t("governancaComp.controles.columnCodigo"), t("governancaComp.controles.columnNome"), t("governancaComp.controles.columnTipo"), t("governancaComp.controles.columnStatus"), t("governancaComp.controles.columnCriticidade"), t("governancaComp.controles.columnResponsavel"), t("governancaComp.controles.columnTestes")];
              const rows = sortedControles.map(c => [
                c.codigo || '',
                c.nome,
                c.tipo,
                c.status,
                c.criticidade,
                c.responsavel_nome || '',
                c.testesCount || 0
              ]);
              const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
              const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = `controles_${new Date().toISOString().split("T")[0]}.csv`;
              link.click();
              toast({ title: t("governancaComp.controles.toastExportTitle"), description: t("governancaComp.controles.toastExportDesc") });
            }}>
              <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t("governancaComp.controles.exportarCsv")}
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => setCategoriasDialogOpen(true)}>
              {t("governancaComp.controles.buttonCategorias")}
            </ActionsMenuItem>
            <ActionsMenuItem onClick={() => setRelatoriosDialogOpen(true)}>
              <BarChart3 className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t("governancaComp.controles.buttonRelatorios")}
            </ActionsMenuItem>
          </ActionsMenuContent>
        </ActionsMenu>
        <Button
          size="sm"
          onClick={() => setControleDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
          {t("governancaComp.controles.buttonNovo")}
        </Button>
        </>,
        actionsSlot
      )}

      {/* DataTable with sorting */}
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            data={sortedControles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
            columns={controlesColumns}
            onRowClick={(controle) => handleOpenDetail(controle)}
            loading={isLoading}
            searchable={true}
            searchPlaceholder={t("governancaComp.controles.searchPlaceholder")}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            filters={[
              {
                key: 'status',
                label: t("governancaComp.controles.filterStatus"),
                options: [
                  { value: 'todos', label: t("governancaComp.controles.filterStatusAll") },
                  { value: 'ativo', label: t("governancaComp.controles.statusAtivo") },
                  { value: 'inativo', label: t("governancaComp.controles.statusInativo") },
                  { value: 'em_revisao', label: t("governancaComp.controles.statusEmRevisao") },
                  { value: 'descontinuado', label: t("governancaComp.controles.statusDescontinuado") },
                ],
                value: statusFilter,
                onChange: setStatusFilter,
              },
              {
                key: 'tipo',
                label: t("governancaComp.controles.filterTipo"),
                options: [
                  { value: 'todos', label: t("governancaComp.controles.filterTipoAll") },
                  { value: 'preventivo', label: t("governancaComp.controles.tipoPreventivo") },
                  { value: 'detectivo', label: t("governancaComp.controles.tipoDetectivo") },
                  { value: 'corretivo', label: t("governancaComp.controles.tipoCorretivo") },
                ],
                value: tipoFilter,
                onChange: setTipoFilter,
              },
              {
                key: 'criticidade',
                label: t("governancaComp.controles.filterCriticidade"),
                options: [
                  { value: 'todos', label: t("governancaComp.controles.filterCriticidadeAll") },
                  { value: 'baixo', label: t("governancaComp.controles.criticidadeBaixo") },
                  { value: 'medio', label: t("governancaComp.controles.criticidadeMedio") },
                  { value: 'alto', label: t("governancaComp.controles.criticidadeAlto") },
                  { value: 'critico', label: t("governancaComp.controles.criticidadeCritico") },
                ],
                value: criticidadeFilter,
                onChange: setCriticidadeFilter,
              },
              {
                key: 'auditoria',
                label: t("governancaComp.controles.filterAuditoria"),
                options: [
                  { value: 'todas', label: t("governancaComp.controles.filterAuditoriaAll") },
                  ...auditorias.map(a => ({ value: a.id, label: a.nome }))
                ],
                value: auditoriaFilter,
                onChange: setAuditoriaFilter,
              },
            ]}
            emptyState={{
              icon: <Shield className="h-12 w-12" />,
              title: t("governancaComp.controles.emptyTitle"),
              description: t("governancaComp.controles.emptyDescription"),
              action: {
                label: t("governancaComp.controles.emptyAction"),
                onClick: () => setControleDialogOpen(true)
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {sortedControles.length > itemsPerPage && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            {t("governancaComp.controles.showingRange", { from: ((currentPage - 1) * itemsPerPage) + 1, to: Math.min(currentPage * itemsPerPage, sortedControles.length), total: sortedControles.length })}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {[...Array(Math.ceil(sortedControles.length / itemsPerPage))].map((_, index) => {
                const pageNumber = index + 1;
                const totalPages = Math.ceil(sortedControles.length / itemsPerPage);
                
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (
                  pageNumber === currentPage - 2 ||
                  pageNumber === currentPage + 2
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(sortedControles.length / itemsPerPage)))}
                  className={currentPage === Math.ceil(sortedControles.length / itemsPerPage) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <ControleDialog
        open={controleDialogOpen}
        onOpenChange={(open) => {
          setControleDialogOpen(open);
          if (!open) setEditingControle(null);
        }}
        controle={editingControle}
        categorias={categorias}
      />

      <CategoriasDialog
        open={categoriasDialogOpen}
        onOpenChange={setCategoriasDialogOpen}
      />

      <TestesDialog
        open={testesDialogOpen}
        onOpenChange={(open) => {
          setTestesDialogOpen(open);
          if (!open) setSelectedControleForTests(null);
        }}
        controleId={selectedControleForTests?.id}
        controleNome={selectedControleForTests?.nome}
      />

      <ControlesVinculacaoDialog
        open={vinculacaoDialogOpen}
        onOpenChange={setVinculacaoDialogOpen}
        controleId={selectedControleForVinculacao?.id}
        controleNome={selectedControleForVinculacao?.nome}
      />

      <RelatoriosDialog
        open={relatoriosDialogOpen}
        onOpenChange={setRelatoriosDialogOpen}
      />

      <ControleDetalheDialog
        open={detalheDialogOpen}
        onOpenChange={(open) => {
          setDetalheDialogOpen(open);
          if (!open) setSelectedControleForDetail(null);
        }}
        controle={selectedControleForDetail}
        onEdit={() => {
          setDetalheDialogOpen(false);
          if (selectedControleForDetail) {
            handleEdit(selectedControleForDetail);
          }
        }}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t("governancaComp.controles.deleteTitle")}
        description={t("governancaComp.controles.deleteDescription")}
        confirmText={t("governancaComp.controles.deleteConfirm")}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
