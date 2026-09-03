import { matchesSearch } from '@/lib/search-utils';
import { buscarForaDoEscopo } from '@/lib/gap-soa';
import { fasesDe, chaveDoFramework } from '@/lib/gap-fases';
import { IconClose, IconSearch, IconWarning, IconChevron, IconChevronLeft, IconAttach, IconCheckbox, IconHelp, IconCalendarClock, IconPerson, RiscosIcon, ControlesIcon } from '@/components/icons';
import { rowOpenProps } from '@/lib/row-interaction';
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead, compareSortValues } from "@/components/ui/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "@/lib/toast";
import { logger } from "@/lib/logger";
import { FrameworkConfig, NIST_PILLAR_NAMES } from "@/lib/framework-configs";
import { RequirementDetailDialog } from "./dialogs/RequirementDetailDialog";
import { saveScoreHistory } from "@/hooks/useScoreHistory";
import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { reqTitulo, reqDescricao, reqOrientacao, reqEvidencias } from "@/lib/gap-i18n";
import { getAppLocale } from "@/lib/i18n-locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRequisitoRiscos } from "@/hooks/useRiscoRequisitos";
import { useRequisitoControles } from "@/hooks/useControleRequisitos";
import { datePattern } from '@/lib/date-utils';

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
  /** `true` quando a Declaração de Aplicabilidade dispensou o requisito. */
  fora_do_escopo?: boolean;
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
  /** Categoria escolhida no mapa de calor, que é o seletor único. */
  initialCategoryFilter?: string;
  /** Muda quando o escopo ou uma avaliacao muda, forcando recarga. */
  refreshKey?: number;
  /** Avisa o mapa de calor quando a categoria é limpa a partir da tabela. */
  onCategoryFilterChange?: (categoria: string | undefined) => void;
}

type StatusFilter = 'all' | 'conforme' | 'parcial' | 'nao_conforme' | 'nao_avaliado' | 'nao_aplicavel';

export const GenericRequirementsTable: React.FC<GenericRequirementsTableProps> = ({
  frameworkId,
  frameworkName,
  config,
  onStatusChange,
  initialCategoryFilter,
  refreshKey = 0,
  onCategoryFilterChange,
}) => {
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  // Quantos riscos dependem de cada requisito (prioriza remediação).
  const { data: riscosPorRequisito } = useRequisitoRiscos(frameworkId);
  // Falhas de controlo interno marcam os requisitos que dependem deles.
  const { data: controlosPorRequisito } = useRequisitoControles(frameworkId);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  // Categoria em foco. Chamava-se `activeTab` de quando havia uma fileira de
  // abas por categoria dentro da tabela — a mesma lista que o mapa de calor já
  // mostrava logo acima, com o mesmo número. Ficou o estado, saíram as abas.
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>(searchParams.get('cat') || 'all');
  /*
    O filtro por FASE, ao lado do filtro por categoria.

    Uma fase do plano de trabalho agrupa varias categorias: "Escopo fechado"
    sao Contexto, Lideranca e Apoio. Em vez de ensinar `categoriaAtiva` a
    guardar listas, a fase viaja como chave propria no endereco e a tabela
    resolve as categorias a partir de `gap-fases.ts`. O endereco continua
    legivel e partilhavel, e a pilula mostra o nome da fase em vez de tres
    categorias soltas.
  */
  const faseAtiva = searchParams.get('fase');
  const chaveDoPlano = chaveDoFramework(frameworkName);
  const categoriasDaFase = useMemo(() => {
    if (!faseAtiva) return null;
    const fase = (fasesDe(frameworkName) || []).find((f) => f.id === faseAtiva);
    return fase ? new Set(fase.categorias) : null;
  }, [faseAtiva, frameworkName]);

  const [activeSection, setActiveSection] = useState<string>(searchParams.get('sec') || config.sections?.[0]?.id || '');

  /*
    A fase manda na seccao aberta.

    Uma fase cruza as seccoes: "Controles no ar" vive todo no Anexo A. Escolher
    a fase e ficar na aba das Clausulas mostrava uma lista vazia, ou pior, a
    lista errada. Ao escolher a fase, abre-se a seccao que tem os requisitos
    dela; se houver em mais do que uma, fica na primeira com conteudo.
  */
  useEffect(() => {
    if (!categoriasDaFase || !config.sections?.length) return;
    const temFase = (id: string) => {
      const sec = config.sections!.find((x) => x.id === id);
      return !!sec && requirements.some(
        (r) => sec.filter(r.codigo) && categoriasDaFase.has(r.categoria || 'Outros'),
      );
    };
    if (temFase(activeSection)) return;
    const outra = config.sections.find((sec) => temFase(sec.id));
    if (outra) setActiveSection(outra.id);
  }, [categoriasDaFase, requirements, config.sections, activeSection]);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(Number(searchParams.get('size')) || 10);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [sort, setSort] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const toggleSort = (field: string) => {
    setSort((prev) => (prev?.field === field
      ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'asc' }));
    setCurrentPage(1);
  };
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((searchParams.get('status') as StatusFilter) || 'all');
  const [onlyMandatory, setOnlyMandatory] = useState(searchParams.get('prio') === '1');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [usersById, setUsersById] = useState<Map<string, UserLite>>(new Map());

  // A URL manda quando muda por fora — é ela que os chips escrevem.
  //
  // Estes filtros só eram lidos no `useState` inicial, e o efeito seguinte
  // escreve estado→URL a cada alteração. Resultado: quando um chip da barra
  // ("Críticos") ou o botão "Ver bloqueadores" gravavam `?status=…&prio=1`, o
  // estado continuava em `all` e o efeito de escrita apagava o parâmetro no
  // render seguinte. O chip acendia, a URL mudava, e a legenda continuava a
  // dizer "8 de 8 requisitos". Aqui o ciclo fecha-se: quando a URL traz algo
  // diferente do estado, o estado adota-o; quando é o estado que muda, as
  // comparações batem e este efeito não faz nada.
  useEffect(() => {
    const urlStatus = (searchParams.get('status') as StatusFilter) || 'all';
    const urlPrio = searchParams.get('prio') === '1';
    const urlCat = searchParams.get('cat') || 'all';
    const urlSec = searchParams.get('sec') || config.sections?.[0]?.id || '';
    const urlQ = searchParams.get('q') || '';
    if (urlStatus !== statusFilter) setStatusFilter(urlStatus);
    if (urlPrio !== onlyMandatory) setOnlyMandatory(urlPrio);
    if (urlCat !== categoriaAtiva) setCategoriaAtiva(urlCat);
    if (urlSec !== activeSection) setActiveSection(urlSec);
    if (urlQ !== searchTerm) setSearchTerm(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    setOrDelete('cat', categoriaAtiva, 'all');
    setOrDelete('sec', activeSection, config.sections?.[0]?.id || '');
    setOrDelete('size', String(itemsPerPage), '10');
    setOrDelete('page', String(currentPage), '1');
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, onlyMandatory, categoriaAtiva, activeSection, itemsPerPage, currentPage]);

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

      // A Declaração de Aplicabilidade também vale aqui.
      //
      // A exclusão pelo SoA já era respeitada no score, na contagem por
      // categoria, na fila de prioridades, na remediação e no PDF do auditor —
      // mas não nesta tabela, que é onde o utilizador passa a maior parte do
      // tempo. O efeito era visível: o cartão da categoria dizia 56 e a barra
      // da aba, quarenta pixels abaixo, dizia 45, porque uma contava o
      // requisito dispensado e a outra não.
      const foraDoEscopo = await buscarForaDoEscopo(frameworkId, empresaId);

      const merged = (reqs || []).map((req: any) => {
        const evaluation = evalMap.get(req.id);
        return {
          ...req,
          codigo: req.codigo || '',
          // Exibição bilíngue: o campo PT segue como chave de agrupamento/scoring,
          // apenas o texto mostrado troca conforme o idioma ativo.
          titulo: reqTitulo(req),
          descricao: reqDescricao(req) || '',
          orientacao_implementacao: reqOrientacao(req) || null,
          exemplos_evidencias: reqEvidencias(req) || null,
          categoria: req.categoria || 'Outros',
          conformity_status: foraDoEscopo.has(req.id)
            ? 'nao_aplicavel'
            : evaluation?.conformity_status || 'nao_avaliado',
          fora_do_escopo: foraDoEscopo.has(req.id),
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
      toast.error(t('gapUi.table.errorLoadRequirements'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequirements();
  /*
    A chave que diz "o escopo mudou, recarrega".

    Depois de responder as 27 perguntas do assistente e declarar que a empresa
    nao tem escritorio proprio, a fila continuava a mandar tratar "Perimetro de
    seguranca fisica" e a tabela continuava a mostrar esses requisitos. O
    cabecalho e o painel de fases actualizavam; estes dois nao, porque so
    recarregavam por frameworkId/empresaId.

    O utilizador acabava de responder a vinte e sete perguntas e a tela dizia
    que nao tinham servido para nada.
  */
  }, [frameworkId, empresaId, refreshKey]);

  // Não abrir numa secção vazia.
  //
  // A secção inicial é a primeira do ficheiro de configuração, não a primeira
  // que tem requisitos. Numa ISO 27001 avaliada só no Anexo A, o utilizador
  // rolava um ecrã inteiro de resumo para chegar a uma tabela a dizer "nenhum
  // requisito disponível" — com a legenda a dizer "8 de 8 requisitos" quatro
  // linhas acima. Corre uma vez, e nunca por cima de uma escolha explícita
  // (`?sec=` na URL).
  const secaoJaAjustada = useRef(false);
  useEffect(() => {
    if (secaoJaAjustada.current) return;
    if (!config.sections?.length || requirements.length === 0) return;
    secaoJaAjustada.current = true;
    if (searchParams.get('sec')) return;
    const atual = config.sections.find(sec => sec.id === activeSection);
    if (atual && requirements.some(r => atual.filter(r.codigo))) return;
    const comConteudo = config.sections.find(sec => requirements.some(r => sec.filter(r.codigo)));
    if (comConteudo) setActiveSection(comConteudo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements, config.sections]);

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

  // Categoria escolhida no heatmap. Clicar de novo na mesma célula desliga o
  // anel de seleção lá em cima; sem o `else` a tabela ficava presa ao filtro
  // que a tela já não indicava.
  const heatmapJaMontou = useRef(false);
  useEffect(() => {
    // No primeiro render quem manda é a URL (`?cat=`), não o heatmap.
    if (!heatmapJaMontou.current) { heatmapJaMontou.current = true; return; }
    setCategoriaAtiva(initialCategoryFilter || 'all');
  }, [initialCategoryFilter]);

  const handleStatusChange = async (requirementId: string, newStatus: string) => {
    if (!empresaId) {
      toast.error(t('gapUi.table.errorCompanyNotIdentified'));
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
      toast.error(t('gapUi.detail.errorUpdateStatus'));
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

  // Mapa categoria (PT, chave de agrupamento) -> rótulo em inglês vindo do banco.
  const categoriaEnMap = useMemo(() => {
    const map: Record<string, string> = {};
    requirements.forEach((r: any) => {
      if (r.categoria && r.categoria_en) map[r.categoria] = r.categoria_en;
    });
    return map;
  }, [requirements]);

  const translateCategory = (cat: string) => {
    // Pelo conteúdo da categoria, não pelo nome do framework: qualquer
    // framework que use os pilares GOVERN/IDENTIFY/... recebe o mesmo rótulo,
    // e nenhum outro é afetado porque as chaves não colidem.
    if (NIST_PILLAR_NAMES[cat]) return NIST_PILLAR_NAMES[cat];
    if (getAppLocale() === 'en') return categoriaEnMap[cat] || cat;
    return cat;
  };

  const handleRowClick = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setDetailDialogOpen(true);
  };

  // Ponte entre a triagem rápida e a edição completa.
  //
  // O painel lateral tinha um botão "Edição completa" que dependia da
  // propriedade `onOpenFullDialog` — e nenhuma tela alguma vez a passava, pelo
  // que o botão nunca chegou a ser desenhado. Quem chegava pela fila de
  // prioridades ou pelo ⌘K ficava sem saída: tinha de fechar o painel,
  // procurar o mesmo requisito na tabela e abri-lo outra vez. Agora o painel
  // grava `?req=<id>` e é a tabela — que já está na página — que abre o
  // diálogo, sem prop drilling entre telas.
  useEffect(() => {
    const reqId = searchParams.get('req');
    if (!reqId || requirements.length === 0) return;
    if (detailDialogOpen && selectedRequirement?.id === reqId) return;
    const alvo = requirements.find(r => r.id === reqId);
    if (!alvo) return;
    setSelectedRequirement(alvo);
    setDetailDialogOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, requirements]);

  /** Tira `?req=` da URL para o diálogo não voltar a abrir sozinho. */
  const limparReqDaUrl = useCallback(() => {
    if (!searchParams.get('req')) return;
    const sp = new URLSearchParams(searchParams);
    sp.delete('req');
    setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams]);

  // Fechar pelo X ou pelo Cancelar passa só por aqui — `onClose` é chamado no
  // gravar. Sem limpar a URL nos dois caminhos, o parâmetro ficava para trás e
  // o diálogo reabria à primeira mudança de filtro.
  const handleDetailDialogOpenChange = (aberto: boolean) => {
    setDetailDialogOpen(aberto);
    if (!aberto) limparReqDaUrl();
  };

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false);
    setSelectedRequirement(null);
    limparReqDaUrl();
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
      const label = newStatus === 'conforme' ? t('gapUi.status.conforme') : newStatus === 'parcial' ? t('gapUi.status.parcial') : newStatus === 'nao_conforme' ? t('gapUi.status.naoConforme') : t('gapUi.status.na');
      toast.success(t('gapUi.table.bulkUpdated', { count: ids.length, label }));
    } catch (error: any) {
      setRequirements(previous);
      logger.error('Erro na atualização em lote de requisitos', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapUi.table.errorBulkUpdate'));
    } finally {
      setBulkUpdating(false);
    }
  };

  /**
   * Atribuir responsável e prazo em lote.
   *
   * As colunas "Responsável" e "Prazo" existem na tabela desde sempre, mas a
   * barra de seleção só sabia mudar estado. Dava para marcar quarenta
   * requisitos como não conformes de uma vez e depois era preciso abrir os
   * quarenta, um a um, para dizer de quem eram e para quando. É o passo que
   * transforma uma avaliação num plano — e era o mais caro do módulo.
   */
  const handleBulkCampo = async (
    campo: 'responsavel_avaliacao' | 'prazo_implementacao',
    valor: string | null,
    rotulo: string,
  ) => {
    if (!empresaId || selectedIds.size === 0) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedIds);
    const anterior = [...requirements];

    setRequirements(prev =>
      prev.map(r => (selectedIds.has(r.id) ? { ...r, [campo]: valor } : r)),
    );

    try {
      // O upsert precisa de `conformity_status`, que é NOT NULL: para um
      // requisito ainda sem avaliação, atribuir dono não pode inventar estado.
      const estadoAtual = new Map(anterior.map(r => [r.id, r.conformity_status || 'nao_avaliado']));
      const linhas = ids.map(reqId => {
        const base = {
          framework_id: frameworkId,
          requirement_id: reqId,
          empresa_id: empresaId,
          conformity_status: estadoAtual.get(reqId) || 'nao_avaliado',
          updated_at: new Date().toISOString(),
        };

        return campo === 'responsavel_avaliacao'
          ? { ...base, responsavel_avaliacao: valor }
          : { ...base, prazo_implementacao: valor };
      });

      const { error } = await supabase
        .from('gap_analysis_evaluations')
        .upsert(linhas, { onConflict: 'framework_id,requirement_id,empresa_id' });
      if (error) throw error;

      setSelectedIds(new Set());
      onStatusChange?.();
      toast.success(t('gapUi.table.bulkUpdated', { count: ids.length, label: rotulo }));
    } catch (error: unknown) {
      setRequirements(anterior);
      logger.error('Erro na atribuição em lote', {
        error: error instanceof Error ? error.message : String(error),
        campo,
      });
      toast.error(t('gapUi.table.errorBulkUpdate'));
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

  const statusTriggerClass: Record<string, string> = {
    conforme: 'border-success/30 bg-success/5 text-success hover:bg-success/10',
    parcial: 'border-warning/35 bg-warning/5 text-warning hover:bg-warning/10',
    nao_conforme: 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10',
    nao_aplicavel: 'border-info/30 bg-info/5 text-info hover:bg-info/10',
    nao_avaliado: 'border-border bg-muted/30 text-muted-foreground hover:bg-accent',
  };

  const statusLabel: Record<string, string> = {
    conforme: t('gapUi.status.conforme'),
    parcial: t('gapUi.status.parcial'),
    nao_conforme: t('gapUi.status.naoConforme'),
    nao_aplicavel: t('gapUi.status.na'),
    nao_avaliado: t('gapUi.status.naoAvaliado'),
  };

  const getPriorityBadge = (peso: number | null, obrigatorio?: boolean | null) => {
    if (obrigatorio) return <Badge variant="destructive" className="text-xs">{t('gapUi.table.priorityMandatory')}</Badge>;
    if ((peso || 0) >= 3) return <Badge variant="warning" className="text-xs">{t('gapUi.table.priorityHigh')}</Badge>;
    if ((peso || 0) >= 2) return <Badge variant="outline" className="text-xs">{t('gapUi.table.priorityMedium')}</Badge>;
    return <Badge variant="secondary" className="text-xs">{t('gapUi.table.priorityLow')}</Badge>;
  };

  /** Coluna "Prazo": cor semântica (vermelho atrasado / âmbar em até 7d / neutro) + tooltip. */
  const renderDueDate = (raw: string | null | undefined) => {
    if (!raw) return <span className="text-xs text-muted-foreground">—</span>;
    let date: Date;
    try { date = parseISO(raw); } catch { return <span className="text-xs text-muted-foreground">—</span>; }
    if (isNaN(date.getTime())) return <span className="text-xs text-muted-foreground">—</span>;

    const diff = differenceInCalendarDays(date, new Date());
    let toneClass = "text-foreground";
    const dayUnit = (n: number) => n === 1 ? t('gapUi.table.day') : t('gapUi.table.days');
    let tooltipText = t('gapUi.table.dueInDays', { diff, unit: dayUnit(diff) });
    let icon = null as React.ReactNode;

    if (diff < 0) {
      toneClass = "text-destructive font-medium";
      tooltipText = t('gapUi.table.overdueDays', { diff: Math.abs(diff), unit: dayUnit(Math.abs(diff)) });
      icon = <IconWarning className="h-3.5 w-3.5 text-destructive shrink-0" strokeWidth={1.5} />;
    } else if (diff === 0) {
      toneClass = "text-destructive font-medium";
      tooltipText = t('gapUi.table.dueToday');
      icon = <IconCalendarClock className="h-3.5 w-3.5 text-destructive shrink-0" strokeWidth={1.5} />;
    } else if (diff <= 7) {
      toneClass = "text-warning font-medium";
      tooltipText = t('gapUi.table.dueSoon', { diff, unit: dayUnit(diff) });
      icon = <IconCalendarClock className="h-3.5 w-3.5 text-warning shrink-0" strokeWidth={1.5} />;
    }

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 text-sm ${toneClass}`}>
              {icon}
              <span>{format(date, datePattern())}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  /** Coluna "Responsável": avatar com iniciais + nome truncado + tooltip com email. */
  const renderOwner = (userId: string | null | undefined) => {
    if (!userId) return <span className="text-xs text-muted-foreground">—</span>;
    const user = usersById.get(userId);
    if (!user) {
      // Lookup ainda carregando ou usuário fora da empresa
      return <span className="text-xs text-muted-foreground">•••</span>;
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
                <AvatarFallback className="text-micro bg-primary/10 text-primary font-medium">
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

  // Filters
  const applyFilters = (reqs: Requirement[]) => {
    let filtered = reqs;
    if (searchTerm.trim()) {
      filtered = filtered.filter(r => matchesSearch(searchTerm, r.codigo, r.titulo, r.descricao));
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.conformity_status === statusFilter);
    }
    if (onlyMandatory) {
      filtered = filtered.filter(r => r.obrigatorio === true || (r.peso || 0) >= 3);
    }
    return filtered;
  };


  const getFilteredRequirements = (baseReqs: Requirement[]) => {
    // A fase manda sobre a categoria: quem clicou numa fase quer aquele
    // recorte inteiro, nao a interseccao com uma categoria escolhida antes.
    if (categoriasDaFase) {
      return applyFilters(baseReqs.filter(r => categoriasDaFase.has(r.categoria || 'Outros')));
    }
    const filtered = categoriaAtiva === 'all'
      ? baseReqs
      : baseReqs.filter(r => (r.categoria || 'Outros') === categoriaAtiva);
    return applyFilters(filtered);
  };

  const filteredRequirements = getFilteredRequirements(requirements);
  const totalPages = Math.ceil(filteredRequirements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequirements = filteredRequirements.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoriaAtiva, faseAtiva, activeSection, itemsPerPage, searchTerm, statusFilter, onlyMandatory]);

  const limparFase = () => {
    const sp = new URLSearchParams(window.location.search);
    sp.delete('fase');
    setSearchParams(sp, { replace: true });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setOnlyMandatory(false);
    setCategoriaAtiva('all');
    onCategoryFilterChange?.(undefined);
    limparFase();
  };
  const hasActiveFilters =
    searchTerm.trim() !== '' || statusFilter !== 'all' || onlyMandatory || categoriaAtiva !== 'all' || !!faseAtiva;

  // Legenda de ícones agora unificada dentro do popover "?" da SearchAndFilterBar.

  const SearchAndFilterBar = () => (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5}/>
        <Input placeholder={t('gapUi.table.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-9" />
        {searchTerm && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}>
            <IconClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('gapUi.table.filterByStatus')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('gapUi.table.allStatuses')}</SelectItem>
          <SelectItem value="conforme">{t('gapUi.status.conforme')}</SelectItem>
          <SelectItem value="parcial">{t('gapUi.status.parcial')}</SelectItem>
          <SelectItem value="nao_conforme">{t('gapUi.status.naoConforme')}</SelectItem>
          <SelectItem value="nao_avaliado">{t('gapUi.status.naoAvaliado')}</SelectItem>
          <SelectItem value="nao_aplicavel">{t('gapUi.status.na')}</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch id="mandatory-filter" checked={onlyMandatory} onCheckedChange={setOnlyMandatory} />
        <Label htmlFor="mandatory-filter" className="text-sm cursor-pointer">{t('gapUi.table.onlyMandatory')}</Label>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('gapUi.table.viewLegend')}>
            <IconHelp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5}/>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-xs space-y-3">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">{t('gapUi.table.complianceStatusTitle')}</p>
            <div className="flex items-center gap-1.5"><Badge variant="success" className="text-micro px-1.5 py-0">{t('gapUi.status.conforme')}</Badge><span className="text-muted-foreground">{t('gapUi.table.legendConforme')}</span></div>
            <div className="flex items-center gap-1.5"><Badge variant="warning" className="text-micro px-1.5 py-0">{t('gapUi.status.parcial')}</Badge><span className="text-muted-foreground">{t('gapUi.table.legendParcial')}</span></div>
            <div className="flex items-center gap-1.5"><Badge variant="destructive" className="text-micro px-1.5 py-0">{t('gapUi.status.naoConforme')}</Badge><span className="text-muted-foreground">{t('gapUi.table.legendNaoConforme')}</span></div>
            <div className="flex items-center gap-1.5"><Badge variant="outline" className="text-micro px-1.5 py-0">{t('gapUi.status.na')}</Badge><span className="text-muted-foreground">{t('gapUi.table.legendNa')}</span></div>
          </div>
          <div className="space-y-1.5 border-t pt-2">
            <p className="font-medium text-foreground">{t('gapUi.table.iconsAndFlagsTitle')}</p>
            <div className="flex items-center gap-1.5"><IconWarning className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5}/><span className="text-muted-foreground">{t('gapUi.table.legendHighPriorityNonCompliant')}</span></div>
            <div className="flex items-center gap-1.5"><IconAttach className="h-3.5 w-3.5" strokeWidth={1.5}/><span className="text-muted-foreground">{t('gapUi.table.legendHasEvidence')}</span></div>
            <div className="flex items-center gap-1.5"><IconCalendarClock className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5}/><span className="text-muted-foreground">{t('gapUi.table.legendOverdueOrToday')}</span></div>
            <div className="flex items-center gap-1.5"><IconCalendarClock className="h-3.5 w-3.5 text-warning" strokeWidth={1.5}/><span className="text-muted-foreground">{t('gapUi.table.legendDueSoon')}</span></div>
          </div>
        </PopoverContent>
      </Popover>
      {/* O filtro de categoria vem do mapa de calor, que fica bem acima. Sem
          isto o utilizador via a tabela encolher sem nada na própria tabela a
          dizer porquê. */}
      {faseAtiva && chaveDoPlano && (
        <button
          type="button"
          onClick={limparFase}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-sm text-primary hover:bg-primary/10 transition-colors"
        >
          <span className="text-muted-foreground">{t('gapFases.pilula')}</span>
          <span className="font-medium">{t(`gapFases.${chaveDoPlano}.${faseAtiva}.nome`)}</span>
          <IconClose className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      )}

      {!faseAtiva && categoriaAtiva !== 'all' && (
        <button
          type="button"
          onClick={() => { setCategoriaAtiva('all'); onCategoryFilterChange?.(undefined); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-sm text-foreground hover:bg-accent transition-colors"
        >
          <span className="text-muted-foreground">{t('gapUi.table.categoryLabel')}</span>
          <span className="font-medium">{translateCategory(categoriaAtiva)}</span>
          <IconClose className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        </button>
      )}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          <IconClose className="h-4 w-4 mr-1" />{t('gapUi.common.clear')}
        </Button>
      )}
      <span className="text-sm text-muted-foreground ml-auto">{t('gapUi.table.showingXOfY', { filtered: filteredRequirements.length, total: requirements.length })}</span>
    </div>
  );

  const PaginationControls = ({ total, filtered }: { total: number; filtered: number }) => {
    const pages = Math.ceil(filtered / itemsPerPage);
    return (
      <div className="flex items-center justify-between mt-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('gapUi.table.itemsPerPage')}</span>
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
          <span className="text-sm text-muted-foreground">{t('gapUi.table.pageXOfY', { current: currentPage, total: pages || 1, filtered })}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <IconChevronLeft className="h-4 w-4" strokeWidth={1.5}/>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(pages || 1, p + 1))} disabled={currentPage === (pages || 1)}>
              <IconChevron className="h-4 w-4" strokeWidth={1.5}/>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const sortRows = (rows: Requirement[]) => {
    if (!sort) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    const valor = (req: any) => {
      if (sort.field === 'evidencias') return req.evidence_files?.length ?? 0;
      if (sort.field === 'score') return req.score ?? req.compliance_score ?? null;
      return req[sort.field];
    };
    return [...rows].sort((a, b) => factor * compareSortValues(valor(a), valor(b)));
  };

  const renderTableContent = (reqs: Requirement[]) => {
    const filtered = applyFilters(reqs);
    const sortedFiltered = sortRows(filtered);
    const pages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = sortedFiltered.slice(startIndex, startIndex + itemsPerPage);
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
                  aria-label={t('gapUi.table.selectAll')}
                />
              </TableHead>
              <SortableTableHead field="codigo" sort={sort} onSort={toggleSort} className="w-28">{t('gapUi.table.colCode')}</SortableTableHead>
              <SortableTableHead field="titulo" sort={sort} onSort={toggleSort}>{t('gapUi.table.colRequirement')}</SortableTableHead>
              <SortableTableHead field="prazo_implementacao" sort={sort} onSort={toggleSort} className="w-32">
                <span className="inline-flex items-center gap-1.5">
                  <IconCalendarClock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  {t('gapUi.table.colDeadline')}
                </span>
              </SortableTableHead>
              <SortableTableHead field="responsavel_avaliacao" sort={sort} onSort={toggleSort} className="w-44">
                <span className="inline-flex items-center gap-1.5">
                  <IconPerson className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  {t('gapUi.table.colResponsible')}
                </span>
              </SortableTableHead>
              <SortableTableHead field="conformity_status" sort={sort} onSort={toggleSort} className="w-48">{t('gapUi.table.colStatus')}</SortableTableHead>
              <SortableTableHead field="evidencias" sort={sort} onSort={toggleSort} className="w-20">{t('gapUi.table.colEvidence')}</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? t('gapUi.table.noResultsFiltered') : t('gapUi.table.noRequirementsAvailable')}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(req => (
                <TableRow
                  key={req.id}
                  {...(() => {
                    const props = rowOpenProps(() => handleRowClick(req), (req as any).codigo || (req as any).titulo);
                    return { ...props, className: `${props.className} ${selectedIds.has(req.id) ? 'bg-primary/5' : ''}` };
                  })()}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(req.id)}
                      onCheckedChange={() => toggleSelect(req.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-1">
                      {(req.peso || 0) >= 3 && req.conformity_status === 'nao_conforme' && (
                        <IconWarning className="h-3.5 w-3.5 text-destructive shrink-0" strokeWidth={1.5}/>
                      )}
                      {req.codigo}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{req.titulo}</p>
                      {req.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.descricao}</p>}
                      {(riscosPorRequisito?.get(req.id)?.length || 0) > 0 && (
                        <span
                          className="mt-1.5 inline-flex items-center gap-1 text-micro text-warning"
                          title={(riscosPorRequisito?.get(req.id) || []).map(r => r.nome).join(', ')}
                        >
                          <RiscosIcon className="h-3.5 w-3.5" />
                          {t('riscosControles.requisito.riscosDependentes', { count: riscosPorRequisito!.get(req.id)!.length })}
                        </span>
                      )}
                      {(controlosPorRequisito?.get(req.id) || []).some(c => c.emFalha) && (
                        <span
                          className="mt-1.5 inline-flex items-center gap-1 text-micro text-destructive"
                          title={(controlosPorRequisito?.get(req.id) || []).filter(c => c.emFalha).map(c => c.nome).join(', ')}
                        >
                          <ControlesIcon className="h-3.5 w-3.5" />
                          {t('vinculoReq.controloEmFalha')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{renderDueDate(req.prazo_implementacao)}</TableCell>
                  <TableCell>{renderOwner(req.responsavel_avaliacao)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={req.conformity_status || 'nao_avaliado'}
                      onValueChange={(value) => handleStatusChange(req.id, value)}
                      disabled={loadingEmpresa || !empresaId}
                    >
                      <SelectTrigger
                        aria-label={`${t('gapUi.table.colStatus')}: ${statusLabel[req.conformity_status || 'nao_avaliado']}`}
                        className={`h-9 min-w-[10.5rem] px-2 text-sm font-medium ${statusTriggerClass[req.conformity_status || 'nao_avaliado']}`}
                      >
                        <SelectValue placeholder={loadingEmpresa ? t('gapUi.table.loadingShort') : t('gapUi.table.selectShort')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_avaliado">{t('gapUi.status.naoAvaliado')}</SelectItem>
                        <SelectItem value="conforme">{t('gapUi.status.conforme')}</SelectItem>
                        <SelectItem value="parcial">{t('gapUi.status.parcial')}</SelectItem>
                        <SelectItem value="nao_conforme">{t('gapUi.status.naoConforme')}</SelectItem>
                        <SelectItem value="nao_aplicavel">{t('gapUi.status.na')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {(req.evidence_files?.length || 0) > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <IconAttach className="h-3.5 w-3.5" strokeWidth={1.5}/>
                        <span>{req.evidence_files!.length}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationControls total={reqs.length} filtered={filtered.length} />

        {/* Floating Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border shadow-lg rounded-lg px-4 py-2.5 flex items-center gap-3 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2">
              <IconCheckbox className="h-4 w-4 text-primary" strokeWidth={1.5}/>
              <span className="text-sm font-medium">{t('gapUi.table.selectedCount', { count: selectedIds.size })}</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="success" onClick={() => handleBulkStatusChange('conforme')} disabled={bulkUpdating} className="text-xs h-7">
                {t('gapUi.status.conforme')}
              </Button>
              <Button size="sm" variant="warning" onClick={() => handleBulkStatusChange('parcial')} disabled={bulkUpdating} className="text-xs h-7">
                {t('gapUi.status.parcial')}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkStatusChange('nao_conforme')} disabled={bulkUpdating} className="text-xs h-7">
                {t('gapUi.status.naoConforme')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('nao_aplicavel')} disabled={bulkUpdating} className="text-xs h-7">
                {t('gapUi.status.na')}
              </Button>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" disabled={bulkUpdating} className="text-xs h-7 gap-1.5">
                    <IconPerson className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {t('gapUi.table.bulkAssign')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-64 p-1">
                  <div className="max-h-64 overflow-y-auto">
                    {[...usersById.entries()].map(([id, u]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleBulkCampo('responsavel_avaliacao', id, u.nome)}
                        className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors truncate"
                      >
                        {u.nome}
                      </button>
                    ))}
                    {usersById.size === 0 && (
                      <p className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t('gapUi.table.bulkNoUsers')}
                      </p>
                    )}
                  </div>
                  <div className="border-t mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleBulkCampo('responsavel_avaliacao', null, t('gapUi.table.bulkClearOwner'))}
                      className="w-full text-left rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                    >
                      {t('gapUi.table.bulkClearOwner')}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" disabled={bulkUpdating} className="text-xs h-7 gap-1.5">
                    <IconCalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {t('gapUi.table.bulkDeadline')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-60 p-3 space-y-2">
                  <Label htmlFor="bulk-prazo" className="text-sm">{t('gapUi.table.bulkDeadline')}</Label>
                  <Input
                    id="bulk-prazo"
                    type="date"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) handleBulkCampo('prazo_implementacao', v, v);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleBulkCampo('prazo_implementacao', null, t('gapUi.table.bulkClearDeadline'))}
                    className="w-full text-left rounded-md px-1 py-1 text-sm text-muted-foreground hover:bg-accent transition-colors"
                  >
                    {t('gapUi.table.bulkClearDeadline')}
                  </button>
                </PopoverContent>
              </Popover>
            </div>
            <div className="h-6 w-px bg-border" />
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs h-7">
              <IconClose className="h-3.5 w-3.5 mr-1" />{t('gapUi.common.clear')}
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
          <p className="text-sm text-muted-foreground">{t('gapUi.table.loadingRequirements')}</p>
        </CardContent>
      </Card>
    );
  }

  // Se framework tem seções, usar tabs por seção
  if (config.sections && config.sections.length > 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('gapUi.table.requirementsOf', { frameworkName })}</CardTitle></CardHeader>
        <CardContent>
          <SearchAndFilterBar />

          <Tabs value={activeSection} onValueChange={(v) => { setActiveSection(v); setCategoriaAtiva('all'); setCurrentPage(1); }}>
            <TabsList className="mb-4">
              {config.sections.map(section => (
                <TabsTrigger key={section.id} value={section.id}>{section.title}</TabsTrigger>
              ))}
            </TabsList>

            {config.sections.map(section => {
              const sectionReqs = requirements.filter(r => section.filter(r.codigo));
              /*
                O segundo caminho de filtragem.

                Quando o framework tem seccoes, a tabela nao passa por
                `getFilteredRequirements`: filtra aqui, a parte. Ao ligar o
                filtro por fase so' no primeiro caminho, clicar em "Controles no
                ar" - que e' todo o Anexo A - deixava a seccao das Clausulas 4-10
                a mostrar 4.1, 4.2, 4.3. A pilula dizia uma coisa e a lista
                mostrava outra.
              */
              const daFase = categoriasDaFase
                ? sectionReqs.filter(r => categoriasDaFase.has(r.categoria || 'Outros'))
                : categoriaAtiva === 'all'
                  ? sectionReqs
                  : sectionReqs.filter(r => (r.categoria || 'Outros') === categoriaAtiva);
              return (
                <TabsContent key={section.id} value={section.id}>
                  {renderTableContent(daFase)}
                </TabsContent>
              );
            })}
          </Tabs>

          {selectedRequirement && (
            <RequirementDetailDialog
              open={detailDialogOpen}
              onOpenChange={handleDetailDialogOpenChange}
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
      <CardHeader><CardTitle>{t('gapUi.table.requirementsOf', { frameworkName })}</CardTitle></CardHeader>
      <CardContent>
        <SearchAndFilterBar />

        {/*
            O TERCEIRO caminho de filtragem, e o unico que servia a maioria.

            Esta tabela tem tres sitios onde decide o que mostrar: o
            getFilteredRequirements, o map das seccoes, e este. Liguei o filtro
            por fase aos dois primeiros e falhei este - que e' justamente o que
            serve 23 dos 24 frameworks, porque so a ISO 27001 declara `sections`.

            O efeito era o pior possivel: clicar numa fase acendia o cartao,
            escrevia ?fase= no endereco, a pilula dizia o nome da fase, a
            legenda dizia "61 de 288", e a tabela mostrava os 288. Verifiquei a
            funcionalidade na ISO 27001, o unico caso onde funcionava, e dei-a
            por feita.

            Passa a usar getFilteredRequirements, que ja e' a conta usada pela
            legenda desta mesma tela. Uma conta so.
        */}
        {renderTableContent(getFilteredRequirements(requirements))}

        {selectedRequirement && (
          <RequirementDetailDialog
            open={detailDialogOpen}
            onOpenChange={handleDetailDialogOpenChange}
            requirement={selectedRequirement}
            frameworkId={frameworkId}
            onClose={handleDetailDialogClose}
          />
        )}
      </CardContent>
    </Card>
  );
};
