import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Search, X, AlertTriangle, Paperclip, CheckSquare, HelpCircle, CalendarClock, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { FrameworkConfig, NIST_PILLAR_NAMES } from "@/lib/framework-configs";
import { RequirementDetailDialog } from "./dialogs/RequirementDetailDialog";
import { saveScoreHistory } from "@/hooks/useScoreHistory";
import { AkurisPulse } from "@/components/ui/AkurisPulse";

interface Requirement {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  area_responsavel: string | null;
  peso: number | null;
  obrigatorio?: boolean | null;
  conformity_status?: string | null;
  evidence_status?: string | null;
  evidence_files?: any[];
  observacoes?: string | null;
  plano_acao?: string | null;
  prazo_implementacao?: string | null;
  responsavel_avaliacao?: string | null;
  orientacao_implementacao?: string | null;
  exemplos_evidencias?: string | null;
  plano_acao_id?: string | null;
}

interface UserLite {
  nome: string;
  email: string;
}

interface GenericRequirementsTableProps {
  frameworkId: string;
  frameworkName: string;
  config: FrameworkConfig;
  onStatusChange?: () => void;
  initialCategoryFilter?: string;
}

type StatusFilter = 'all' | 'conforme' | 'parcial' | 'nao_conforme' | 'nao_avaliado' | 'nao_aplicavel';

interface CategoryStats {
  total: number;
  conforme: number;
  parcial: number;
  nao_conforme: number;
  nao_avaliado: number;
  nao_aplicavel: number;
  percentage: number;
}

export const GenericRequirementsTable: React.FC<GenericRequirementsTableProps> = ({
  frameworkId,
  frameworkName,
  config,
  onStatusChange,
  initialCategoryFilter,
}) => {
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('cat') || 'all');
  const [activeSection, setActiveSection] = useState<string>(searchParams.get('sec') || config.sections?.[0]?.id || '');
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(Number(searchParams.get('size')) || 10);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((searchParams.get('status') as StatusFilter) || 'all');
  const [onlyMandatory, setOnlyMandatory] = useState(searchParams.get('prio') === '1');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [usersById, setUsersById] = useState<Map<string, UserLite>>(new Map());

  // Sync filters → URL (replace, no history pollution)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string, defaultValue: string) => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete('q', searchTerm, '');
    setOrDelete('status', statusFilter, 'all');
    setOrDelete('prio', onlyMandatory ? '1' : '', '');
    setOrDelete('cat', activeTab, 'all');
    setOrDelete('sec', activeSection, config.sections?.[0]?.id || '');
    setOrDelete('size', String(itemsPerPage), '10');
    setOrDelete('page', String(currentPage), '1');
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, onlyMandatory, activeTab, activeSection, itemsPerPage, currentPage]);

  const loadRequirements = async () => {
    if (!empresaId) return;
    try {
      setLoading(true);
      // Paginação: frameworks grandes (PCI DSS 4.0 ~288, CIS ~153) podem ultrapassar
      // o teto padrão de 1000 do PostgREST ao unir com evaluations; usamos o helper
      // para evitar truncamento silencioso.
      const { fetchAllPaginated } = await import('@/lib/supabase-paginate');

      const { data: reqs, error: reqError } = await fetchAllPaginated<any>(() =>
        supabase
          .from('gap_analysis_requirements')
          .select('*')
          .eq('framework_id', frameworkId)
          .order('ordem', { ascending: true }),
      );
      if (reqError) throw reqError;

      const { data: evals, error: evalError } = await fetchAllPaginated<any>(() =>
        supabase
          .from('gap_analysis_evaluations')
          .select('id, requirement_id, conformity_status, plano_acao_id, evidence_files, prazo_implementacao, responsavel_avaliacao, updated_at')
          .eq('framework_id', frameworkId)
          .eq('empresa_id', empresaId),
      );
      if (evalError) throw evalError;

      const evalMap = new Map(
        evals?.map((e: any) => [e.requirement_id, {
          id: e.id,
          conformity_status: e.conformity_status,
          plano_acao_id: e.plano_acao_id,
          evidence_files: e.evidence_files,
          prazo_implementacao: e.prazo_implementacao,
          responsavel_avaliacao: e.responsavel_avaliacao,
          updated_at: e.updated_at,
        }]) || []
      );

      const merged = (reqs || []).map((req: any) => {
        const evaluation = evalMap.get(req.id);
        return {
          ...req,
          codigo: req.codigo || '',
          descricao: req.descricao || '',
          categoria: req.categoria || 'Outros',
          conformity_status: evaluation?.conformity_status || 'nao_avaliado',
          evaluation_id: evaluation?.id || null,
          evaluation_updated_at: evaluation?.updated_at || null,
          plano_acao_id: evaluation?.plano_acao_id || null,
          evidence_files: Array.isArray(evaluation?.evidence_files) ? evaluation.evidence_files : [],
          prazo_implementacao: evaluation?.prazo_implementacao || null,
          responsavel_avaliacao: evaluation?.responsavel_avaliacao || null,
        };
      });

      setRequirements(merged);
    } catch (error: any) {
      logger.error('Erro ao carregar requisitos', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao carregar requisitos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequirements();
  }, [frameworkId, empresaId]);

  // Carrega usuários da empresa para resolver UUID → nome na coluna "Responsável".
  // Multi-tenant: filtro obrigatório por empresa_id.
  useEffect(() => {
    if (!empresaId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .eq('empresa_id', empresaId)
        .eq('ativo', true);
      if (cancelled) return;
      if (error) {
        logger.error('Erro ao carregar usuários da empresa', { error: error.message });
        return;
      }
      const map = new Map<string, UserLite>();
      (data || []).forEach(u => {
        if (u.user_id) map.set(u.user_id, { nome: u.nome || u.email || '—', email: u.email || '' });
      });
      setUsersById(map);
    })();
    return () => { cancelled = true; };
  }, [empresaId]);

  // Sync with external category filter from CategoryStatusCards
  useEffect(() => {
    if (initialCategoryFilter) {
      setActiveTab(initialCategoryFilter);
    }
  }, [initialCategoryFilter]);

  const handleStatusChange = async (requirementId: string, newStatus: string) => {
    if (!empresaId) {
      toast.error('Erro: Empresa não identificada.');
      return;
    }

    // 1. Optimistic update — atualiza UI imediatamente
    const previousRequirements = [...requirements];
    setRequirements(prev =>
      prev.map(r => r.id === requirementId ? { ...r, conformity_status: newStatus } : r)
    );

    try {
      // 2. Persistir no banco
      const { data: existing } = await supabase
        .from('gap_analysis_evaluations')
        .select('id')
        .eq('requirement_id', requirementId)
        .eq('framework_id', frameworkId)
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .update({ conformity_status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .insert({ framework_id: frameworkId, requirement_id: requirementId, empresa_id: empresaId, conformity_status: newStatus });
        if (error) throw error;
      }

      // 3. Calcular score localmente com dados já em memória (sem queries extras)
      const updatedReqs = previousRequirements.map(r =>
        r.id === requirementId ? { ...r, conformity_status: newStatus } : r
      );
      const totalReqs = updatedReqs.length;
      const evaluatedReqs = updatedReqs.filter(r => r.conformity_status && r.conformity_status !== 'nao_aplicavel' && r.conformity_status !== 'nao_avaliado').length;
      const score = calculateScore(updatedReqs);

      // 4. Salvar histórico e notificar pai em background
      saveScoreHistory(frameworkId, empresaId, score, totalReqs, evaluatedReqs).catch(() => {});
      onStatusChange?.();
      // Sem toast em mudança individual — feedback visual da própria linha já indica sucesso.
      // Toast permanece apenas para ações em lote e para erros.
    } catch (error: any) {
      // Rollback optimistic update
      setRequirements(previousRequirements);
      logger.error('Erro ao atualizar status do requisito', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao atualizar status');
    }
  };

  const calculateScore = (reqs: Requirement[]): number => {
    const applicable = reqs.filter(r => r.conformity_status !== 'nao_aplicavel');
    if (applicable.length === 0) return 0;
    let totalWeight = 0;
    let weightedScore = 0;
    applicable.forEach(req => {
      const weight = req.peso || 1;
      const statusScore = config.statusScores[req.conformity_status || 'nao_conforme'] || 0;
      totalWeight += weight;
      weightedScore += statusScore * weight;
    });
    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  };

  const translateCategory = (cat: string) => {
    if (frameworkName.toLowerCase().includes('nist')) return NIST_PILLAR_NAMES[cat] || cat;
    return cat;
  };

  const handleRowClick = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setDetailDialogOpen(true);
  };

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false);
    setSelectedRequirement(null);
    loadRequirements();
    onStatusChange?.();
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!empresaId || selectedIds.size === 0) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedIds);
    const previous = [...requirements];

    // Optimistic update
    setRequirements(prev =>
      prev.map(r => selectedIds.has(r.id) ? { ...r, conformity_status: newStatus } : r)
    );

    try {
      // Single batch upsert (uses unique constraint framework_id+requirement_id+empresa_id)
      const rows = ids.map(reqId => ({
        framework_id: frameworkId,
        requirement_id: reqId,
        empresa_id: empresaId,
        conformity_status: newStatus,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('gap_analysis_evaluations')
        .upsert(rows, { onConflict: 'framework_id,requirement_id,empresa_id' });

      if (error) throw error;

      // Score history once after bulk
      const updatedReqs = previous.map(r =>
        selectedIds.has(r.id) ? { ...r, conformity_status: newStatus } : r
      );
      const totalReqs = updatedReqs.length;
      const evaluatedReqs = updatedReqs.filter(r => r.conformity_status && r.conformity_status !== 'nao_aplicavel' && r.conformity_status !== 'nao_avaliado').length;
      const score = calculateScore(updatedReqs);
      saveScoreHistory(frameworkId, empresaId, score, totalReqs, evaluatedReqs).catch(() => {});

      setSelectedIds(new Set());
      onStatusChange?.();
      const label = newStatus === 'conforme' ? 'Conforme' : newStatus === 'parcial' ? 'Parcial' : newStatus === 'nao_conforme' ? 'Não Conforme' : 'N/A';
      toast.success(`${ids.length} requisitos atualizados para "${label}"`);
    } catch (error: any) {
      setRequirements(previous);
      logger.error('Erro na atualização em lote de requisitos', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro na atualização em lote');
    } finally {
      setBulkUpdating(false);
    }
  };

  const toggleSelectAll = (reqs: Requirement[]) => {
    setSelectedIds(prev => {
      const allSelected = reqs.every(r => prev.has(r.id));
      const newSet = new Set(prev);
      if (allSelected) reqs.forEach(r => newSet.delete(r.id));
      else reqs.forEach(r => newSet.add(r.id));
      return newSet;
    });
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const getStatusBadge = (status?: string | null) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
      conforme: { label: 'Conforme', variant: 'success' },
      parcial: { label: 'Parcial', variant: 'warning' },
      nao_conforme: { label: 'Não Conforme', variant: 'destructive' },
      nao_aplicavel: { label: 'N/A', variant: 'outline' },
      nao_avaliado: { label: 'Não Avaliado', variant: 'outline' },
    };
    const s = statusMap[status || 'nao_avaliado'];
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getPriorityBadge = (peso: number | null, obrigatorio?: boolean | null) => {
    if (obrigatorio) return <Badge variant="destructive" className="text-xs">Obrigatório</Badge>;
    if ((peso || 0) >= 3) return <Badge variant="warning" className="text-xs">Alta</Badge>;
    if ((peso || 0) >= 2) return <Badge variant="outline" className="text-xs">Média</Badge>;
    return <Badge variant="secondary" className="text-xs">Baixa</Badge>;
  };

  /** Coluna "Prazo": cor semântica (vermelho atrasado / âmbar em até 7d / neutro) + tooltip. */
  const renderDueDate = (raw: string | null | undefined) => {
    if (!raw) return <span className="text-xs text-muted-foreground/40">—</span>;
    let date: Date;
    try { date = parseISO(raw); } catch { return <span className="text-xs text-muted-foreground/40">—</span>; }
    if (isNaN(date.getTime())) return <span className="text-xs text-muted-foreground/40">—</span>;

    const diff = differenceInCalendarDays(date, new Date());
    let toneClass = "text-foreground";
    let tooltipText = `Prazo em ${diff} ${diff === 1 ? 'dia' : 'dias'}`;
    let icon = null as React.ReactNode;

    if (diff < 0) {
      toneClass = "text-destructive font-medium";
      tooltipText = `Atrasado há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dia' : 'dias'}`;
      icon = <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" strokeWidth={1.5} />;
    } else if (diff === 0) {
      toneClass = "text-destructive font-medium";
      tooltipText = "Vence hoje";
      icon = <CalendarClock className="h-3.5 w-3.5 text-destructive shrink-0" strokeWidth={1.5} />;
    } else if (diff <= 7) {
      toneClass = "text-warning font-medium";
      tooltipText = `Vence em ${diff} ${diff === 1 ? 'dia' : 'dias'}`;
      icon = <CalendarClock className="h-3.5 w-3.5 text-warning shrink-0" strokeWidth={1.5} />;
    }

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 text-sm ${toneClass}`}>
              {icon}
              <span>{format(date, 'dd/MM/yyyy')}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  /** Coluna "Responsável": avatar com iniciais + nome truncado + tooltip com email. */
  const renderOwner = (userId: string | null | undefined) => {
    if (!userId) return <span className="text-xs text-muted-foreground/40">—</span>;
    const user = usersById.get(userId);
    if (!user) {
      // Lookup ainda carregando ou usuário fora da empresa
      return <span className="text-xs text-muted-foreground/60">•••</span>;
    }
    const initials = user.nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p.charAt(0).toUpperCase())
      .join('') || '?';

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{user.nome}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="font-medium">{user.nome}</div>
            {user.email && <div className="text-muted-foreground">{user.email}</div>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Compute category stats
  const categoryStatsMap = useMemo(() => {
    const map: Record<string, CategoryStats> = {};
    requirements.forEach(r => {
      const cat = r.categoria || 'Outros';
      if (!map[cat]) map[cat] = { total: 0, conforme: 0, parcial: 0, nao_conforme: 0, nao_avaliado: 0, nao_aplicavel: 0, percentage: 0 };
      map[cat].total++;
      const st = r.conformity_status || 'nao_avaliado';
      if (st in map[cat]) (map[cat] as any)[st]++;
    });
    Object.values(map).forEach(s => {
      const applicable = s.total - s.nao_aplicavel;
      s.percentage = applicable > 0 ? Math.round((s.conforme / applicable) * 100) : 0;
    });
    return map;
  }, [requirements]);

  // Filters
  const applyFilters = (reqs: Requirement[]) => {
    let filtered = reqs;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.codigo?.toLowerCase().includes(term) ||
        r.titulo?.toLowerCase().includes(term) ||
        r.descricao?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.conformity_status === statusFilter);
    }
    if (onlyMandatory) {
      filtered = filtered.filter(r => r.obrigatorio === true || (r.peso || 0) >= 3);
    }
    return filtered;
  };

  const categories = [...new Set(requirements.map(r => r.categoria || 'Outros'))].sort();

  const getFilteredRequirements = (baseReqs: Requirement[]) => {
    let filtered = activeTab === 'all'
      ? baseReqs
      : baseReqs.filter(r => (r.categoria || 'Outros') === activeTab);
    return applyFilters(filtered);
  };

  const filteredRequirements = getFilteredRequirements(requirements);
  const totalPages = Math.ceil(filteredRequirements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequirements = filteredRequirements.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeSection, itemsPerPage, searchTerm, statusFilter, onlyMandatory]);

  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setOnlyMandatory(false); };
  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'all' || onlyMandatory;

  // Legenda de ícones agora unificada dentro do popover "?" da SearchAndFilterBar.

  const SearchAndFilterBar = () => (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5}/>
        <Input placeholder="Buscar por código, título ou descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-9" />
        {searchTerm && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Status</SelectItem>
          <SelectItem value="conforme">Conforme</SelectItem>
          <SelectItem value="parcial">Parcial</SelectItem>
          <SelectItem value="nao_conforme">Não Conforme</SelectItem>
          <SelectItem value="nao_avaliado">Não Avaliado</SelectItem>
          <SelectItem value="nao_aplicavel">N/A</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch id="mandatory-filter" checked={onlyMandatory} onCheckedChange={setOnlyMandatory} />
        <Label htmlFor="mandatory-filter" className="text-sm cursor-pointer">Somente prioritários</Label>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver legenda">
            <HelpCircle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5}/>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-xs space-y-3">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">Status de conformidade</p>
            <div className="flex items-center gap-1.5"><Badge variant="success" className="text-[10px] px-1.5 py-0">Conforme</Badge><span className="text-muted-foreground">Atende 100% ao requisito</span></div>
            <div className="flex items-center gap-1.5"><Badge variant="warning" className="text-[10px] px-1.5 py-0">Parcial</Badge><span className="text-muted-foreground">Atende parcialmente</span></div>
            <div className="flex items-center gap-1.5"><Badge variant="destructive" className="text-[10px] px-1.5 py-0">Não Conforme</Badge><span className="text-muted-foreground">Não atende</span></div>
            <div className="flex items-center gap-1.5"><Badge variant="outline" className="text-[10px] px-1.5 py-0">N/A</Badge><span className="text-muted-foreground">Não aplicável ao escopo</span></div>
          </div>
          <div className="space-y-1.5 border-t pt-2">
            <p className="font-medium text-foreground">Ícones e sinalizações</p>
            <div className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5}/><span className="text-muted-foreground">Requisito de alta prioridade não conforme</span></div>
            <div className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" strokeWidth={1.5}/><span className="text-muted-foreground">Há evidências anexadas</span></div>
            <div className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5}/><span className="text-muted-foreground">Prazo vencido ou vence hoje</span></div>
            <div className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-warning" strokeWidth={1.5}/><span className="text-muted-foreground">Prazo nos próximos 7 dias</span></div>
          </div>
        </PopoverContent>
      </Popover>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />Limpar
        </Button>
      )}
      <span className="text-sm text-muted-foreground ml-auto">{filteredRequirements.length} de {requirements.length} requisitos</span>
    </div>
  );

  const PaginationControls = ({ total, filtered }: { total: number; filtered: number }) => {
    const pages = Math.ceil(filtered / itemsPerPage);
    return (
      <div className="flex items-center justify-between mt-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Itens por página:</span>
          <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Página {currentPage} de {pages || 1} ({filtered} itens)</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5}/>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(pages || 1, p + 1))} disabled={currentPage === (pages || 1)}>
              <ChevronRight className="h-4 w-4" strokeWidth={1.5}/>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const CategoryTabTrigger = ({ cat, reqs }: { cat: string; reqs: Requirement[] }) => {
    const stats = categoryStatsMap[cat];
    if (!stats) return <TabsTrigger value={cat}>{translateCategory(cat)}</TabsTrigger>;
    return (
      <TabsTrigger value={cat} className="flex flex-col items-start gap-0.5 py-2 px-3 h-auto">
        <span className="text-xs font-medium">{translateCategory(cat)}</span>
        <div className="flex items-center gap-1.5 w-full">
          <Progress value={stats.percentage} className="h-1.5 flex-1 min-w-[40px]" />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{stats.conforme}/{stats.total - stats.nao_aplicavel}</span>
        </div>
      </TabsTrigger>
    );
  };

  const renderTableContent = (reqs: Requirement[]) => {
    const filtered = applyFilters(reqs);
    const pages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);
    const allPageSelected = paginated.length > 0 && paginated.every(r => selectedIds.has(r.id));

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={() => toggleSelectAll(paginated)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Requisito</TableHead>
              <TableHead className="w-32">
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  Prazo
                </div>
              </TableHead>
              <TableHead className="w-44">
                <div className="flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  Responsável
                </div>
              </TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20">Evidências</TableHead>
              <TableHead className="w-48">Avaliação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? 'Nenhum requisito encontrado com os filtros aplicados' : 'Nenhum requisito disponível'}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(req => (
                <TableRow key={req.id} className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(req.id) ? 'bg-primary/5' : ''}`} onClick={() => handleRowClick(req)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(req.id)}
                      onCheckedChange={() => toggleSelect(req.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-1">
                      {(req.peso || 0) >= 3 && req.conformity_status === 'nao_conforme' && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" strokeWidth={1.5}/>
                      )}
                      {req.codigo}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{req.titulo}</p>
                      {req.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.descricao}</p>}
                    </div>
                  </TableCell>
                  <TableCell>{renderDueDate(req.prazo_implementacao)}</TableCell>
                  <TableCell>{renderOwner(req.responsavel_avaliacao)}</TableCell>
                  <TableCell>{getStatusBadge(req.conformity_status)}</TableCell>
                  <TableCell>
                    {(req.evidence_files?.length || 0) > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5" strokeWidth={1.5}/>
                        <span>{req.evidence_files!.length}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={req.conformity_status || 'nao_avaliado'}
                      onValueChange={(value) => handleStatusChange(req.id, value)}
                      disabled={loadingEmpresa || !empresaId}
                    >
                      <SelectTrigger onClick={(e) => e.stopPropagation()} className="px-2 text-sm">
                        <SelectValue placeholder={loadingEmpresa ? "Carregando..." : "Selecione..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conforme">Conforme</SelectItem>
                        <SelectItem value="parcial">Parcial</SelectItem>
                        <SelectItem value="nao_conforme">Não Conforme</SelectItem>
                        <SelectItem value="nao_aplicavel">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationControls total={reqs.length} filtered={filtered.length} />

        {/* Floating Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border shadow-lg rounded-xl px-4 py-2.5 flex items-center gap-3 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" strokeWidth={1.5}/>
              <span className="text-sm font-medium">{selectedIds.size} selecionados</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="success" onClick={() => handleBulkStatusChange('conforme')} disabled={bulkUpdating} className="text-xs h-7">
                Conforme
              </Button>
              <Button size="sm" variant="warning" onClick={() => handleBulkStatusChange('parcial')} disabled={bulkUpdating} className="text-xs h-7">
                Parcial
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkStatusChange('nao_conforme')} disabled={bulkUpdating} className="text-xs h-7">
                Não Conforme
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('nao_aplicavel')} disabled={bulkUpdating} className="text-xs h-7">
                N/A
              </Button>
            </div>
            <div className="h-6 w-px bg-border" />
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs h-7">
              <X className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 min-h-[280px] flex flex-col items-center justify-center gap-3">
          <AkurisPulse size={56} />
          <p className="text-sm text-muted-foreground">Carregando requisitos...</p>
        </CardContent>
      </Card>
    );
  }

  // Se framework tem seções, usar tabs por seção
  if (config.sections && config.sections.length > 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Requisitos do {frameworkName}</CardTitle></CardHeader>
        <CardContent>
          <SearchAndFilterBar />

          <Tabs value={activeSection} onValueChange={(v) => { setActiveSection(v); setActiveTab('all'); setCurrentPage(1); }}>
            <TabsList className="mb-4">
              {config.sections.map(section => (
                <TabsTrigger key={section.id} value={section.id}>{section.title}</TabsTrigger>
              ))}
            </TabsList>

            {config.sections.map(section => {
              const sectionReqs = requirements.filter(r => section.filter(r.codigo));
              const sectionCategories = [...new Set(sectionReqs.map(r => r.categoria || 'Outros'))].sort();

              return (
                <TabsContent key={section.id} value={section.id}>
                  <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
                    <TabsList className="mb-4 flex-wrap h-auto gap-1">
                      <TabsTrigger value="all">Todos</TabsTrigger>
                      {sectionCategories.map(cat => (
                        <CategoryTabTrigger key={cat} cat={cat} reqs={sectionReqs.filter(r => (r.categoria || 'Outros') === cat)} />
                      ))}
                    </TabsList>
                    <TabsContent value={activeTab}>
                      {renderTableContent(activeTab === 'all' ? sectionReqs : sectionReqs.filter(r => (r.categoria || 'Outros') === activeTab))}
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              );
            })}
          </Tabs>

          {selectedRequirement && (
            <RequirementDetailDialog
              open={detailDialogOpen}
              onOpenChange={setDetailDialogOpen}
              requirement={selectedRequirement}
              frameworkId={frameworkId}
              onClose={handleDetailDialogClose}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  // Caso padrão: tabs por categoria
  return (
    <Card>
      <CardHeader><CardTitle>Requisitos do {frameworkName}</CardTitle></CardHeader>
      <CardContent>
        <SearchAndFilterBar />


        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="all">Todos ({requirements.length})</TabsTrigger>
            {categories.map(cat => (
              <CategoryTabTrigger key={cat} cat={cat} reqs={requirements.filter(r => (r.categoria || 'Outros') === cat)} />
            ))}
          </TabsList>
          <TabsContent value={activeTab}>
            {renderTableContent(activeTab === 'all' ? requirements : requirements.filter(r => (r.categoria || 'Outros') === activeTab))}
          </TabsContent>
        </Tabs>

        {selectedRequirement && (
          <RequirementDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            requirement={selectedRequirement}
            frameworkId={frameworkId}
            onClose={handleDetailDialogClose}
          />
        )}
      </CardContent>
    </Card>
  );
};
