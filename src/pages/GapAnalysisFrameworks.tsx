import { useState, useEffect, useMemo } from 'react';
import { getCategory, CATEGORIAS_DE_FRAMEWORK } from '@/lib/gap-analysis-tokens';
import { calcularScoreFramework } from '@/lib/gap-score';
import { useReusoFrameworks } from '@/hooks/useReusoFramework';
import { useMaturityTrend } from '@/hooks/useMaturityTrend';
import { useProximoMarcoDaEmpresa } from '@/hooks/useMarcoCertificacao';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { WelcomeHero } from '@/components/gap-analysis/WelcomeHero';
import { FrameworkCatalog } from '@/components/gap-analysis/FrameworkCatalog';
import {
  MaturityHero,
  AIRecommendedTile,
  ActiveFrameworkRow,
  SectionHead,
} from '@/components/gap-analysis/v2';
import type { StackSegment } from '@/components/gap-analysis/v2';
import { Badge } from '@/components/ui/badge';
import { ModuleToolbar } from '@/components/ui/module-toolbar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { fwDescricao } from "@/lib/gap-i18n";
import { useJurisdicao } from '@/hooks/useJurisdicao';
import type { JurisdicaoCodigo } from '@/lib/jurisdicao';
import { summarizeGaps, isGapCritico, EMPTY_GAP_SUMMARY, type GapSummary } from '@/lib/gap-criticality';
import { IconShield, IconChevronDown } from '@/components/icons';

interface Framework {
  id: string;
  nome: string;
  versao: string;
  tipo_framework: string;
  descricao?: string;
}

interface FrameworkProgress {
  totalRequirements: number;
  evaluatedRequirements: number;
  conformeCount: number;
  averageScore: number;
  /**
   * O score que este framework teria com todos os gaps CRÍTICOS fechados.
   *
   * Serve para dizer quantos pontos se ganham em vez de quantos gaps há —
   * eram coisas diferentes apresentadas com a mesma palavra.
   */
  scoreSeFechadosCriticos: number;
}

interface StatusCounts {
  conforme: number;
  parcial: number;
  nao_conforme: number;
  nao_aplicavel: number;
  nao_avaliado: number;
}

const SUGGESTED_NAMES = ['ISO 27001', 'ISO/IEC 27001', 'LGPD', 'NIST CSF 2.0', 'NIST CSF'];

/**
 * Ordem de relevância por jurisdição de proteção de dados. Nenhum framework é
 * removido do catálogo — muda apenas a ordem em "Recomendados para a empresa".
 */
const PRIORIDADE_POR_JURISDICAO: Record<JurisdicaoCodigo, string[]> = {
  BR: ['LGPD', 'ISO 27001', 'ISO/IEC 27001', 'NIST CSF 2.0', 'NIST CSF', 'ISO/IEC 27701'],
  PT_EU: ['RGPD', 'GDPR', 'NIS2', 'ISO/IEC 27701', 'ISO 27701', 'DORA', 'ISO 27001', 'ISO/IEC 27001', 'LGPD'],
  INTL: ['GDPR', 'ISO 27001', 'ISO/IEC 27001', 'NIST CSF 2.0', 'NIST CSF', 'SOC 2', 'ISO/IEC 27701'],
};

function prioridadeJurisdicao(nome: string, codigo: JurisdicaoCodigo): number {
  const lista = PRIORIDADE_POR_JURISDICAO[codigo];
  const alvo = (nome || '').toLowerCase();
  const idx = lista.findIndex((n) => alvo.includes(n.toLowerCase()));
  return idx === -1 ? 0 : (lista.length - idx) * 100;
}

// As pílulas de filtro vêm da mesma lista do catálogo: eram quatro para sete
// grupos, e filtrar por "Riscos" não era sequer oferecido.
const CATEGORY_OPTIONS: { id: string; labelKey: string }[] = [
  { id: 'all', labelKey: 'gapAnalysis.frameworks.category.all' },
  ...CATEGORIAS_DE_FRAMEWORK.map((c) => ({
    id: c,
    labelKey: `gapAnalysis.frameworks.category.${c}`,
  })),
];


function buildSegments(sc: StatusCounts): StackSegment[] {
  return [
    { kind: 'conforme', count: sc.conforme },
    { kind: 'parcial', count: sc.parcial },
    { kind: 'nao_conforme', count: sc.nao_conforme },
    { kind: 'nao_aplicavel', count: sc.nao_aplicavel },
    { kind: 'nao_avaliado', count: sc.nao_avaliado },
  ];
}

export default function GapAnalysisFrameworks() {
  const { t } = useLanguage();
  const { codigo: jurisdicaoCodigo } = useJurisdicao();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [requirementCounts, setRequirementCounts] = useState<Record<string, number>>({});
  const [frameworkProgress, setFrameworkProgress] = useState<Record<string, FrameworkProgress>>({});
  const [frameworkStatusCounts, setFrameworkStatusCounts] = useState<Record<string, StatusCounts>>({});
  const [frameworkGapSummary, setFrameworkGapSummary] = useState<Record<string, GapSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const debouncedSearch = useDebounce(searchTerm, 250);

  useEffect(() => {
    loadFrameworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const loadFrameworks = async () => {
    try {
      setLoading(true);
      const { data: fws, error: fwError } = await supabase
        .from('gap_analysis_frameworks')
        .select('*')
        .is('empresa_id', null)
        .eq('is_template', true)
        .order('nome', { ascending: true });

      if (fwError) throw fwError;
      setFrameworks(fws || []);

      const frameworkIds = (fws || []).map(fw => fw.id);
      const counts: Record<string, number> = {};
      const progress: Record<string, FrameworkProgress> = {};
      const statusCountsMap: Record<string, StatusCounts> = {};
      const gapSummaryMap: Record<string, GapSummary> = {};

      if (frameworkIds.length > 0) {
        // PostgREST caps queries at 1000 rows by default. Frameworks globais somam >1000 requisitos,
        // então paginamos em lotes para não truncar as contagens.
        const PAGE_SIZE = 1000;
        const fetchAllPaginated = async <T,>(
          builder: () => ReturnType<typeof supabase.from> extends infer _R
            ? ReturnType<ReturnType<typeof supabase.from>['select']>
            : never,
        ): Promise<{ data: T[]; error: unknown }> => {
          const acc: T[] = [];
          let from = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { data, error } = await (builder() as any).range(from, from + PAGE_SIZE - 1);
            if (error) return { data: acc, error };
            const batch = (data as T[]) || [];
            acc.push(...batch);
            if (batch.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
          }
          return { data: acc, error: null };
        };

        const { data: allRequirements, error: reqError } = await fetchAllPaginated<{ id: string; framework_id: string; peso: number | null }>(
          () =>
            supabase
              .from('gap_analysis_requirements')
              .select('id, framework_id, peso')
              .in('framework_id', frameworkIds) as any,
        );

        if (!reqError && allRequirements) {
          allRequirements.forEach(req => {
            counts[req.framework_id] = (counts[req.framework_id] || 0) + 1;
          });

          if (empresaId) {
            const pesoPorRequisito = new Map<string, number>(
              allRequirements.map(r => [r.id, Number(r.peso ?? 3)]),
            );

            const { data: allEvaluations, error: evalError } = await fetchAllPaginated<{
              conformity_status: string;
              framework_id: string;
              requirement_id: string;
              prazo_implementacao: string | null;
            }>(() =>
              supabase
                .from('gap_analysis_evaluations')
                .select('conformity_status, framework_id, requirement_id, prazo_implementacao')
                .in('framework_id', frameworkIds)
                .eq('empresa_id', empresaId) as any,
            );

            // Declaração de Aplicabilidade: o que a empresa tirou do escopo não
            // é lacuna. Sem isto a lista contava como gap um requisito que a
            // própria aba do SoA já mostrava como fora do escopo.
            const { data: soaRows } = await fetchAllPaginated<{ requirement_id: string; aplicavel: boolean }>(
              () =>
                supabase
                  .from('gap_analysis_soa')
                  .select('requirement_id, aplicavel')
                  .in('framework_id', frameworkIds)
                  .eq('empresa_id', empresaId) as any,
            );
            const foraDoEscopo = new Set(
              (soaRows || []).filter(s => s.aplicavel === false).map(s => s.requirement_id),
            );

            if (!evalError && allEvaluations) {
            /* O prazo entra no critério de «crítico» (peso alto OU prazo
               vencido), por isso é preciso ao simular o fecho. */
            const prazoPorRequisito = new Map<string, string | null>(
              (allEvaluations || []).map(e => [e.requirement_id, e.prazo_implementacao ?? null]),
            );
              const evalsByFramework = new Map<string, typeof allEvaluations>();
              allEvaluations.forEach(ev => {
                const existing = evalsByFramework.get(ev.framework_id) || [];
                existing.push(ev);
                evalsByFramework.set(ev.framework_id, existing);
              });

              const reqsPorFramework = new Map<string, typeof allRequirements>();
              allRequirements.forEach(r => {
                const lista = reqsPorFramework.get(r.framework_id) || [];
                lista.push(r);
                reqsPorFramework.set(r.framework_id, lista);
              });

              frameworkIds.forEach(fwId => {
                const evals = evalsByFramework.get(fwId) || [];
                const statusPorRequisito = new Map(
                  evals.map(e => [e.requirement_id, e.conformity_status]),
                );

                // Uma conta só, a de `lib/gap-score` — a mesma que o detalhe do
                // framework usa. Antes esta tela somava sem peso e mostrava 50%
                // onde o detalhe mostrava 53% para os mesmos dados.
                const resumo = calcularScoreFramework(
                  (reqsPorFramework.get(fwId) || []).map(r => ({
                    id: r.id,
                    peso: r.peso,
                    conformityStatus: statusPorRequisito.get(r.id),
                    aplicavel: !foraDoEscopo.has(r.id),
                  })),
                );

                const totalReqs = counts[fwId] || 0;

                statusCountsMap[fwId] = {
                  conforme: resumo.conforme,
                  parcial: resumo.parcial,
                  nao_conforme: resumo.naoConforme,
                  nao_aplicavel: resumo.naoAplicaveis,
                  nao_avaliado: resumo.naoAvaliado,
                };

                gapSummaryMap[fwId] = summarizeGaps(
                  evals.map(e => ({
                    conformity_status: e.conformity_status,
                    peso: pesoPorRequisito.get(e.requirement_id),
                    prazo_implementacao: e.prazo_implementacao,
                  })),
                );

                /*
                  O MESMO cálculo do score, com os gaps críticos já fechados.
                  É a única forma honesta de responder «quantos pontos ganho
                  se tratar isto»: o score é ponderado pelo peso e restrito
                  ao escopo, por isso o ganho não se deduz da contagem.
                */
                const resumoSeFechados = calcularScoreFramework(
                  (reqsPorFramework.get(fwId) || []).map(r => {
                    const st = statusPorRequisito.get(r.id);
                    const critico = isGapCritico({
                      conformity_status: st,
                      peso: r.peso,
                      prazo_implementacao: prazoPorRequisito.get(r.id),
                    });
                    return {
                      id: r.id,
                      peso: r.peso,
                      conformityStatus: critico ? 'conforme' : st,
                      aplicavel: !foraDoEscopo.has(r.id),
                    };
                  }),
                );

                progress[fwId] = {
                  totalRequirements: totalReqs,
                  evaluatedRequirements: resumo.avaliados,
                  conformeCount: resumo.conforme,
                  averageScore: resumo.score,
                  scoreSeFechadosCriticos: resumoSeFechados.score,
                };
              });
            }
          }
        }
      }

      setRequirementCounts(counts);
      setFrameworkProgress(progress);
      setFrameworkStatusCounts(statusCountsMap);
      setFrameworkGapSummary(gapSummaryMap);
    } catch (error) {
      logger.error('Erro ao carregar frameworks', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const { activeFrameworks, availableFrameworks } = useMemo(() => {
    const active: Framework[] = [];
    const available: Framework[] = [];
    frameworks.forEach(fw => {
      const p = frameworkProgress[fw.id];
      if (p && p.evaluatedRequirements > 0) active.push(fw);
      else available.push(fw);
    });
    return { activeFrameworks: active, availableFrameworks: available };
  }, [frameworks, frameworkProgress]);

  const matchesFilters = (fw: Framework) => {
    if (categoryFilter !== 'all' && getCategory(fw.tipo_framework) !== categoryFilter) return false;
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      fw.nome.toLowerCase().includes(term) ||
      fw.tipo_framework?.toLowerCase().includes(term) ||
      fw.descricao?.toLowerCase().includes(term)
    );
  };

  const filteredActiveFrameworks = useMemo(
    () => activeFrameworks.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFrameworks, debouncedSearch, categoryFilter]
  );

  const filteredAvailableFrameworks = useMemo(
    () => availableFrameworks.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableFrameworks, debouncedSearch, categoryFilter]
  );

  const hasActiveFrameworks = activeFrameworks.length > 0;
  const hasFilters = debouncedSearch.trim() !== '' || categoryFilter !== 'all';

  // Hero data + segmentos globais
  const heroData = useMemo(() => {
    if (!hasActiveFrameworks) return null;

    let totalWeightedScore = 0;
    let totalWeightedSeFechados = 0;
    let totalWeight = 0;
    let totalReqs = 0;
    let totalEvaluated = 0;
    const global: StatusCounts = {
      conforme: 0, parcial: 0, nao_conforme: 0, nao_aplicavel: 0, nao_avaliado: 0,
    };
    const gaps: GapSummary = { ...EMPTY_GAP_SUMMARY };

    activeFrameworks.forEach(fw => {
      const p = frameworkProgress[fw.id];
      const sc = frameworkStatusCounts[fw.id];
      if (p && p.evaluatedRequirements > 0) {
        totalWeightedScore += p.averageScore * p.evaluatedRequirements;
        totalWeightedSeFechados += p.scoreSeFechadosCriticos * p.evaluatedRequirements;
        totalWeight += p.evaluatedRequirements;
        totalReqs += p.totalRequirements;
        totalEvaluated += p.evaluatedRequirements;
      }
      const gs = frameworkGapSummary[fw.id];
      if (gs) {
        gaps.abertos += gs.abertos;
        gaps.criticos += gs.criticos;
        gaps.atrasados += gs.atrasados;
      }
      if (sc) {
        global.conforme += sc.conforme;
        global.parcial += sc.parcial;
        global.nao_conforme += sc.nao_conforme;
        global.nao_aplicavel += sc.nao_aplicavel;
        global.nao_avaliado += sc.nao_avaliado;
      }
    });

    const indiceAgora = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const indiceSeFechados = totalWeight > 0 ? totalWeightedSeFechados / totalWeight : 0;

    return {
      overallScore: Math.round(indiceAgora),
      /* Pontos de ÍNDICE, não número de gaps. Ver `scoreSeFechadosCriticos`. */
      ganhoSeFecharCriticos: Math.max(0, Math.round(indiceSeFechados - indiceAgora)),
      segments: buildSegments(global),
      totalRequirements: totalReqs,
      totalEvaluated,
      openGaps: gaps.abertos,
      criticalCount: gaps.criticos,
      overdueCount: gaps.atrasados,
    };
  }, [activeFrameworks, frameworkProgress, frameworkStatusCounts, frameworkGapSummary, hasActiveFrameworks]);

  // Δ 30 dias e marco de certificação — ambos existiam na tela sem origem.
  //
  // O "Δ 30D" era literalmente `delta30d = 0` por omissão, pintado de verde com
  // seta para cima; o "Próximo marco" era um convite com botão sem ação. Agora
  // o delta vem do histórico de score (que passou a ser escrito por trigger) e
  // o marco vem de `gap_analysis_marcos`. Sem histórico, o hook devolve `null`
  // e a linha simplesmente não aparece — que é a leitura honesta.
  const { data: tendencia } = useMaturityTrend(heroData?.overallScore ?? 0);
  // O marco pertence ao framework. Aqui mostra-se só o mais próximo entre os
  // frameworks ativos, dizendo de qual é — definir acontece lá dentro.
  const { data: marco } = useProximoMarcoDaEmpresa(empresaId ?? undefined);

  // Recomendados: ordenados por jurisdição e por adequação ao negócio.
  //
  // Havia aqui um "reuso estimado" que era Math.random() — um número diferente a
  // cada render, exibido sob o rótulo "baseado em sobreposição de evidências".
  // Num produto de GRC isso é pior que não ter: o cliente escolhe qual framework
  // adotar olhando esse número. Só volta quando existir mapeamento cruzado real
  // entre requisitos de frameworks diferentes, que o esquema hoje não tem.
  const aiRecommended = useMemo(() => {
    const activeTypes = new Set(activeFrameworks.map(fw => getCategory(fw.tipo_framework)));

    const candidates = availableFrameworks
      .map(fw => {
        const cat = getCategory(fw.tipo_framework);
        const priority = prioridadeJurisdicao(fw.nome, jurisdicaoCodigo)
          + (SUGGESTED_NAMES.includes(fw.nome) ? 50 : 0);
        return { fw, priority };
      })
      .sort((a, b) => (b.priority - a.priority) || a.fw.nome.localeCompare(b.fw.nome))
      .slice(0, 3);

    return candidates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableFrameworks, activeFrameworks.length, jurisdicaoCodigo]);

  // Quanto de cada candidato a empresa já tem pronto, pela equivalência entre
  // requisitos. É a resposta real à pergunta que o "reuso estimado" aleatório
  // fingia responder: "vale a pena começar este agora?".
  const { reuso: reusoPorFramework } = useReusoFrameworks(
    aiRecommended.map(({ fw }) => fw.id),
    empresaId,
  );

  const suggestedFrameworks = useMemo(() => {
    const found = SUGGESTED_NAMES
      .map(name => frameworks.find(fw => fw.nome === name))
      .filter(Boolean) as Framework[];
    const seen = new Set<string>();
    const unique = found.filter(fw => (seen.has(fw.id) ? false : seen.add(fw.id)));
    if (unique.length >= 3) return unique.slice(0, 3);
    const fallbacks = ['seguranca', 'privacidade', 'governanca']
      .map(cat => frameworks.find(fw => getCategory(fw.tipo_framework) === cat && !seen.has(fw.id)))
      .filter(Boolean) as Framework[];
    return [...unique, ...fallbacks].slice(0, 3);
  }, [frameworks]);

  const handleFrameworkClick = (framework: Framework) => {
    navigate(`/gap-analysis/framework/${framework.id}`);
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <div className="space-y-6">
          <PageHeader
            title={t('gapAnalysis.frameworks.title')}
            description={t('gapAnalysis.frameworks.description')}
          />
          <div className="flex items-center justify-center py-24">
            <AkurisPulse size={48} />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const FilterBar = (
    <ModuleToolbar
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t('gapAnalysis.frameworks.searchPlaceholder')}
      filters={
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORY_OPTIONS.map(opt => {
            const active = categoryFilter === opt.id;
            return (
              <Badge
                key={opt.id}
                variant={active ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setCategoryFilter(opt.id)}
              >
                {t(opt.labelKey)}
              </Badge>
            );
          })}
        </div>
      }
    />
  );

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        <PageHeader
          title={t('gapAnalysis.frameworks.title')}
          description={t('gapAnalysis.frameworks.description')}
        />

        {!hasActiveFrameworks ? (
          <WelcomeHero
            suggestedFrameworks={suggestedFrameworks}
            onFrameworkClick={(id) => navigate(`/gap-analysis/framework/${id}`)}
            onShowCatalog={() => setShowCatalog(true)}
          />
        ) : (
          <>
            {/* Hero editorial: maturidade + distribuição global */}
            {heroData && (
              <MaturityHero
                overallScore={heroData.overallScore}
                segments={heroData.segments}
                totalRequirements={heroData.totalRequirements}
                totalEvaluated={heroData.totalEvaluated}
                openGaps={heroData.openGaps}
                criticalCount={heroData.criticalCount}
                ganhoSeFecharCriticos={heroData.ganhoSeFecharCriticos}
                overdueCount={heroData.overdueCount}
                activeFrameworksCount={activeFrameworks.length}
                delta30d={tendencia?.delta ?? null}
                nextMilestone={
                  marco
                    ? {
                        label: marco.rotulo,
                        date: marco.data_alvo,
                        targetScore: marco.score_alvo,
                        frameworkName: marco.framework_nome,
                        frameworkScore: frameworkProgress[marco.framework_id]?.averageScore ?? 0,
                      }
                    : undefined
                }
                onOpenMilestone={() =>
                  marco
                    ? navigate(`/gap-analysis/framework/${marco.framework_id}`)
                    : document
                        .getElementById('frameworks-ativos')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              />
            )}

            {/* Recomendados para sua empresa */}
            {aiRecommended.length > 0 && (
              <section>
                <SectionHead
                  title={t('gapAnalysis.frameworks.recommended.title')}
                  count={aiRecommended.length}
                  right={
                    <span className="text-xs text-muted-foreground">
                      {t('gapAnalysis.frameworks.recommended.basedOn')}
                    </span>
                  }
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aiRecommended.map(({ fw }) => (
                    <AIRecommendedTile
                      key={fw.id}
                      nome={fw.nome}
                      versao={fw.versao}
                      tipo_framework={fw.tipo_framework}
                      descricao={fwDescricao(fw as any) || fw.descricao}
                      reuso={reusoPorFramework[fw.id]}
                      requirementCount={requirementCounts[fw.id] || 0}
                      onClick={() => handleFrameworkClick(fw)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Barra de filtros */}
            {FilterBar}

            {/* Frameworks ativos — linhas editoriais */}
            <section id="frameworks-ativos">
              <SectionHead
                title={t('gapAnalysis.frameworks.active.title')}
                count={hasFilters ? `${filteredActiveFrameworks.length}/${activeFrameworks.length}` : activeFrameworks.length}
              />
              {filteredActiveFrameworks.length > 0 ? (
                <div className="space-y-3">
                  {filteredActiveFrameworks.map((framework) => {
                    const sc = frameworkStatusCounts[framework.id];
                    const p = frameworkProgress[framework.id];
                    return (
                      <ActiveFrameworkRow
                        key={framework.id}
                        nome={framework.nome}
                        versao={framework.versao}
                        tipo_framework={framework.tipo_framework}
                        totalRequirements={p?.totalRequirements || 0}
                        evaluatedRequirements={p?.evaluatedRequirements || 0}
                        averageScore={p?.averageScore || 0}
                        segments={sc ? buildSegments(sc) : []}
                        onClick={() => handleFrameworkClick(framework)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {t('gapAnalysis.frameworks.active.noneMatchFilters')}
                </p>
              )}
            </section>
          </>
        )}

        {/* Outros disponíveis */}
        {(hasActiveFrameworks || showCatalog) && availableFrameworks.length > 0 && (
          hasActiveFrameworks ? (
            <Collapsible open={catalogOpen} onOpenChange={setCatalogOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center gap-2 group w-full text-left">
                  <IconChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${catalogOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                  <span className="text-xs font-semibold text-foreground/80 group-hover:text-primary transition-colors">
                    {t('gapAnalysis.frameworks.otherAvailable')}
                  </span>
                  <span className="font-mono text-micro tabular-nums text-muted-foreground">
                    {hasFilters && catalogOpen
                      ? `${filteredAvailableFrameworks.length}/${availableFrameworks.length}`
                      : String(availableFrameworks.length).padStart(2, '0')}
                  </span>
                  <div className="h-px flex-1 bg-border/60 ml-2" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <FrameworkCatalog
                  frameworks={filteredAvailableFrameworks}
                  requirementCounts={requirementCounts}
                  onFrameworkClick={handleFrameworkClick}
                />
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <section>
              <SectionHead title={t('gapAnalysis.frameworks.available.title')} count={availableFrameworks.length} />
              {FilterBar}
              <div className="mt-4">
                <FrameworkCatalog
                  frameworks={filteredAvailableFrameworks}
                  requirementCounts={requirementCounts}
                  onFrameworkClick={handleFrameworkClick}
                />
              </div>
            </section>
          )
        )}

        {frameworks.length === 0 && (
          <EmptyState
            icon={<IconShield className="h-8 w-8" />}
            title={t('gapAnalysis.frameworks.empty.title')}
            description={t('gapAnalysis.frameworks.empty.description')}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
