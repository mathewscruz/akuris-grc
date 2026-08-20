import { useState, useEffect, useMemo, useCallback } from 'react';
import { buscarForaDoEscopo } from '@/lib/gap-soa';
import { calcularScoreFramework, type RequisitoParaScore } from '@/lib/gap-score';
import { DefinirMarcoDialog } from '@/components/gap-analysis/v2/DefinirMarcoDialog';
import { useMarcoCertificacao } from '@/hooks/useMarcoCertificacao';
import { fasesDe, chaveDoFramework } from '@/lib/gap-fases';
import { escopoDe } from '@/lib/gap-escopo';
import { HerancaCrossFramework } from '@/components/gap-analysis/v2/HerancaCrossFramework';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { IconDownload, IconMore, IconFile, IconChevronLeft, IconChart, IconHelp } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { CriarTarefaMenuItem } from '@/components/projetos/CriarTarefaMenuItem';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GenericRequirementsTable } from '@/components/gap-analysis/GenericRequirementsTable';
import { FrameworkHistoryTab } from '@/components/gap-analysis/FrameworkHistoryTab';
import { AdherenceAssessmentView } from '@/components/gap-analysis/adherence/AdherenceAssessmentView';
import { AdherenceResultView } from '@/components/gap-analysis/adherence/AdherenceResultView';
import { AIRecommendationsButton } from '@/components/gap-analysis/AIRecommendationsCard';
import { FrameworkOnboarding } from '@/components/gap-analysis/FrameworkOnboarding';
import { EvidenceLibraryHub } from '@/components/gap-analysis/EvidenceLibraryHub';
import {
  SectionHeatmap,
  AssistenteDeEscopo,
  PainelDeFases,
  PriorityQueueCard,
  FrameworkHeader,
  RequirementDrawerProvider,
  useRequirementDrawer,
  CommandPalette,
  DocumentsHero,
  RemediationTabV2,
  SoATabV2,
  type HeatCell,
} from '@/components/gap-analysis/v2';
import { useDocGen } from '@/contexts/DocGenContext';

import { exportFrameworkPDF } from '@/components/gap-analysis/ExportFrameworkPDF';
import { exportBoardPDF } from '@/components/gap-analysis/ExportBoardPDF';
import { supabase } from '@/integrations/supabase/client';
import { getFrameworkConfig } from '@/lib/framework-configs';
import { useFrameworkScore } from '@/hooks/useFrameworkScore';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { FRAMEWORK_DESCRIPTIONS } from '@/lib/framework-descriptions';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { reqTitulo, reqCategoria, fwNome, fwDescricao } from "@/lib/gap-i18n";

interface Framework {
  id: string;
  nome: string;
  versao: string;
  tipo_framework: string;
  descricao?: string;
}

export default function GapAnalysisFrameworkDetail() {
  return (
    <RequirementDrawerProvider>
      <GapAnalysisFrameworkDetailInner />
    </RequirementDrawerProvider>
  );
}

function GapAnalysisFrameworkDetailInner() {
  const { t, locale } = useLanguage();
  const { frameworkId } = useParams<{ frameworkId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { openRequirement } = useRequirementDrawer();
  const [framework, setFramework] = useState<Framework | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('avaliacao');
  const [scoreRefreshKey, setScoreRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedAdherenceAssessment, setSelectedAdherenceAssessment] = useState<any>(null);
  const [adherenceView, setAdherenceView] = useState<'list' | 'result'>('list');
  const [docUploadSignal, setDocUploadSignal] = useState(0);
  const [marcoDialogAberto, setMarcoDialogAberto] = useState(false);
  const { openDocGen } = useDocGen();

  useEffect(() => {
    if (!frameworkId) return;
    const loadFramework = async () => {
      try {
        const { data, error } = await supabase
          .from('gap_analysis_frameworks')
          .select('*')
          .eq('id', frameworkId)
          .single();
        if (error) throw error;
        setFramework(data);
      } catch (error: any) {
        logger.error('Erro ao carregar framework', { error: error instanceof Error ? error.message : String(error) });
        toast.error(t('gapAnalysis.detail.notFound'));
        navigate('/gap-analysis/frameworks');
      } finally {
        setLoading(false);
      }
    };
    loadFramework();
  }, [frameworkId, navigate]);

  const loadCategoryData = useCallback(async () => {
    if (!frameworkId || !empresaId) return;
    try {
      const [reqsRes, evalsRes] = await Promise.all([
        supabase.from('gap_analysis_requirements').select('id, categoria, categoria_en, peso').eq('framework_id', frameworkId),
        supabase.from('gap_analysis_evaluations').select('requirement_id, conformity_status').eq('framework_id', frameworkId).eq('empresa_id', empresaId),
      ]);
      const reqs = reqsRes.data || [];
      const evals = evalsRes.data || [];
      const evalMap = new Map(evals.map(e => [e.requirement_id, e.conformity_status || 'nao_avaliado']));
      // Fora do escopo pelo SoA conta como não aplicável, não como lacuna.
      const foraDoEscopo = await buscarForaDoEscopo(frameworkId, empresaId);
      foraDoEscopo.forEach(id => evalMap.set(id, 'nao_aplicavel'));
      const catMap: Record<string, { conforme: number; parcial: number; nao_conforme: number; nao_aplicavel: number; nao_avaliado: number; total: number }> = {};
      // Guarda os requisitos de cada categoria para a conta de score sair de
      // `calcularScoreFramework`, e não de uma fórmula local.
      const reqsPorCategoria: Record<string, RequisitoParaScore[]> = {};
      reqs.forEach(r => {
        const cat = reqCategoria(r as any) || 'Outros';
        if (!catMap[cat]) catMap[cat] = { conforme: 0, parcial: 0, nao_conforme: 0, nao_aplicavel: 0, nao_avaliado: 0, total: 0 };
        catMap[cat].total++;
        const st = evalMap.get(r.id) || 'nao_avaliado';
        if (st in catMap[cat]) (catMap[cat] as any)[st]++;
        else catMap[cat].nao_avaliado++;
        (reqsPorCategoria[cat] ||= []).push({
          id: r.id,
          peso: (r as any).peso,
          conformityStatus: st,
        });
      });
      setCategoryData(
        Object.entries(catMap)
          .map(([categoria, data]) => ({
            categoria,
            ...data,
            // Aderência da categoria pela mesma conta do score do framework:
            // ponderada pelo peso e restrita ao escopo do SoA. O cartão do
            // heatmap tinha aqui `(conforme*100 + parcial*50)/aplicáveis` e a
            // barra da aba logo abaixo tinha `conforme/aplicáveis` — dois
            // números diferentes para a mesma categoria, a quarenta pixels um
            // do outro.
            ...calcularScoreFramework(reqsPorCategoria[categoria] || []),
          }))
          .sort((a, b) => a.categoria.localeCompare(b.categoria)),
      );
    } catch (e: any) {
      // Antes silenciávamos qualquer falha aqui, o que mascarava problemas de
      // permissão/RLS. Loga com contexto para diagnóstico sem quebrar a UI.
      logger.error('Erro ao carregar contagem por categoria', {
        error: e instanceof Error ? e.message : String(e),
        frameworkId,
      });
    }
  }, [frameworkId, empresaId]);

  useEffect(() => { loadCategoryData(); }, [loadCategoryData]);

  const config = useMemo(() =>
    framework ? getFrameworkConfig(framework.nome, framework.tipo_framework) : null,
    [framework?.nome, framework?.tipo_framework]
  );

  const defaultConfig = useMemo(() => getFrameworkConfig('default')!, []);

  // Declarar o que está fora do escopo vale para qualquer framework.
  //
  // Esta aba estava atrás de `nome.includes('27001') || nome.includes('27701')`,
  // porque a Declaração de Aplicabilidade é vocabulário ISO. Só que a coisa que
  // ela faz — registrar por escrito que um requisito não se aplica, com
  // justificativa — é universal: a LGPD tem tratamento que a empresa não
  // realiza, o PCI DSS tem requisito coberto por controlo compensatório, o NIST
  // CSF é explicitamente um perfil que se recorta. Quem escolhesse qualquer
  // outro framework perdia a funcionalidade **e** via o score calculado sobre
  // requisitos que não lhe dizem respeito, sem forma de os excluir.

  const {
    overallScore, pillarScores, domainScores, areaScores, sectionScores,
    categoryScores, totalRequirements, evaluatedRequirements, loading: scoreLoading,
  } = useFrameworkScore(frameworkId || '', config || defaultConfig, scoreRefreshKey);

  const [autoOnboardingShown, setAutoOnboardingShown] = useState(false);
  useEffect(() => {
    if (autoOnboardingShown) return;
    if (!scoreLoading && evaluatedRequirements === 0 && totalRequirements > 0) {
      setShowOnboarding(true);
      setAutoOnboardingShown(true);
    }
  }, [scoreLoading, evaluatedRequirements, totalRequirements, autoOnboardingShown]);

  // "Edição completa" no painel de triagem grava `?req=<id>`. O diálogo que
  // abre esse requisito vive dentro da tabela, e a tabela só existe na aba de
  // avaliação — quem pediu a edição a partir do ⌘K noutra aba ficaria a olhar
  // para nada.
  useEffect(() => {
    if (searchParams.get('req')) setActiveTab('avaliacao');
  }, [searchParams]);

  /**
   * Dados do PDF/CSV do framework.
   *
   * As duas consultas descartavam `error`: uma falha de rede ou de RLS gerava
   * um relatório de "0% de conformidade, 0 requisitos avaliados" — assinado,
   * datado e indistinguível de um framework realmente por avaliar. Um auditor
   * arquiva isso como evidência.
   */
  const getExportData = async () => {
    const { data: reqs, error: erroReqs } = await supabase
      .from('gap_analysis_requirements')
      .select('id, codigo, titulo, categoria, peso, area_responsavel, titulo_en, categoria_en')
      .eq('framework_id', frameworkId)
      .order('ordem', { ascending: true });

    if (erroReqs) throw erroReqs;

    const { data: evals, error: erroEvals } = await supabase
      .from('gap_analysis_evaluations')
      .select('requirement_id, conformity_status')
      .eq('framework_id', frameworkId)
      .eq('empresa_id', empresaId);

    if (erroEvals) throw erroEvals;

    const evalMap = new Map(evals?.map(e => [e.requirement_id, e.conformity_status]) || []);
    // O PDF vai para o auditor: ele não pode listar como lacuna um requisito que
    // a própria Declaração de Aplicabilidade excluiu.
    const foraDoEscopo = await buscarForaDoEscopo(frameworkId, empresaId);
    foraDoEscopo.forEach(id => evalMap.set(id, 'nao_aplicavel'));
    const requirements = (reqs || []).map(r => ({
      codigo: r.codigo || '', titulo: reqTitulo(r as any), categoria: reqCategoria(r as any) || '',
      conformity_status: evalMap.get(r.id) || 'nao_avaliado', peso: r.peso, area_responsavel: r.area_responsavel,
    }));

    const { data: empresa } = await supabase.from('empresas').select('nome').eq('id', empresaId).single();

    return {
      frameworkName: framework!.nome, frameworkVersion: framework!.versao,
      frameworkType: framework!.tipo_framework, overallScore, totalRequirements,
      evaluatedRequirements, pillarScores, categoryScores, requirements,
      empresaNome: empresa?.nome || 'Empresa',
      maxScore: 100,
    };
  };

  const handleExportPDF = async () => {
    if (!framework || !config) return;
    setExporting(true);
    try {
      const data = await getExportData();
      await exportFrameworkPDF(data);
      toast.success(t('gapAnalysis.detail.toast.pdfExported'));
    } catch (error: any) {
      logger.error('Erro ao exportar PDF', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapAnalysis.detail.toast.pdfExportError'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportBoard = async () => {
    if (!framework || !config) return;
    setExporting(true);
    try {
      const data = await getExportData();
      await exportBoardPDF({ ...data, t, locale });
      toast.success(t('gapAnalysis.detail.toast.boardExported'));
    } catch (error: any) {
      logger.error('Erro ao exportar PDF Board', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapAnalysis.detail.toast.boardExportError'));
    } finally {
      setExporting(false);
    }
  };

  // As contagens eram recalculadas com `categoryData.reduce(...)` oito vezes no
  // JSX, duas vezes por cartão. Uma vez só, e os cartões passam a receber.
  const contagem = useMemo(() => ({
    conforme: categoryData.reduce((s, c) => s + c.conforme, 0),
    parcial: categoryData.reduce((s, c) => s + c.parcial, 0),
    naoConforme: categoryData.reduce((s, c) => s + c.nao_conforme, 0),
    naoAplicavel: categoryData.reduce((s, c) => s + c.nao_aplicavel, 0),
    naoAvaliado: categoryData.reduce((s, c) => s + c.nao_avaliado, 0),
  }), [categoryData]);

  const { data: marco } = useMarcoCertificacao(empresaId ?? undefined, frameworkId);

  /*
    O assistente de escopo aparece antes da lista, e só enquanto faz sentido.

    Quem já declarou aplicabilidade — pelo assistente ou a mão, na aba
    Aplicabilidade — não precisa de ser convidado outra vez. Quem nunca
    declarou nada recebe 121 linhas em branco, que é o problema que isto
    resolve.
  */
  const [escopoAberto, setEscopoAberto] = useState(false);
  const [jaDeclarouEscopo, setJaDeclarouEscopo] = useState<boolean | null>(null);
  const temAssistente = !!escopoDe(chaveDoFramework(framework?.nome || ''));

  useEffect(() => {
    if (!empresaId || !frameworkId || !temAssistente) return;
    let cancelado = false;
    (async () => {
      const { count } = await supabase
        .from('gap_analysis_soa')
        .select('id', { count: 'exact', head: true })
        .eq('framework_id', frameworkId)
        .eq('empresa_id', empresaId);
      if (!cancelado) setJaDeclarouEscopo((count ?? 0) > 0);
    })();
    return () => { cancelado = true; };
  }, [empresaId, frameworkId, temAssistente, scoreRefreshKey]);

  /** Filtra a tabela por estado e leva o utilizador até ela. */
  const filtrarPorEstado = useCallback((estado: string) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set('status', estado);
    sp.delete('prio');
    setSearchParams(sp, { replace: true });
    document.getElementById('reqs-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [setSearchParams]);

  const handleScoreChange = useCallback(() => {
    setScoreRefreshKey(k => k + 1);
    loadCategoryData();
  }, [loadCategoryData]);

  if (loading || !framework || !config) {
    return (
      <ErrorBoundary>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <AkurisPulse size={64} />
          <p className="text-sm text-muted-foreground">{t('gapAnalysis.detail.loading')}</p>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/gap-analysis/frameworks')}>
            <IconChevronLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />{t('gapAnalysis.detail.back')}
          </Button>
        </div>

        <PageHeader
          title={`${framework.nome} ${framework.versao}`}
          description={fwDescricao(framework) || FRAMEWORK_DESCRIPTIONS[framework.nome] || t('gapAnalysis.detail.defaultDescription', { tipo: framework.tipo_framework })}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ação primária — Consultor IA (ícone proprietário Akuris) */}
              {empresaId && totalRequirements > 0 && (
                <AIRecommendationsButton
                  frameworkId={frameworkId!}
                  frameworkNome={framework.nome}
                  empresaId={empresaId}
                  overallScore={overallScore}
                  totalRequirements={totalRequirements}
                  evaluatedRequirements={evaluatedRequirements}
                  onGoToRemediation={() => setActiveTab('remediacao')}
                />
              )}

              {/* Exportar — ação utilitária visível */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting}>
                    <IconDownload className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    {exporting ? t('gapAnalysis.detail.exporting') : t('gapAnalysis.detail.export')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPDF} disabled={exporting}>
                    <IconDownload className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    {t('gapAnalysis.detail.exportTechnical')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportBoard} disabled={exporting}>
                    <IconChart className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    {t('gapAnalysis.detail.exportBoard')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mais ações — agrupa Gerador de Documentos e Tour */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label={t('gapAnalysis.detail.moreActions')}>
                    <IconMore className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => openDocGen({ frameworkId, frameworkName: framework.nome })}>
                    {t('gapAnalysis.detail.documentGenerator')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <CriarTarefaMenuItem
                    entidadeTipo="gap_assessment"
                    entidadeId={frameworkId}
                    tituloSugerido={t('gapAnalysis.detail.taskTitle', { nome: framework.nome })}
                    descricaoSugerida={t('gapAnalysis.detail.taskDescription', { nome: framework.nome })}
                  />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setActiveTab('avaliacao'); setShowOnboarding(true); }}>
                    <IconHelp className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    {t('gapAnalysis.detail.revisitTour')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="avaliacao">{t('gapAnalysis.detail.tabs.evaluation')}</TabsTrigger>
            <TabsTrigger value="documentos">{t('gapAnalysis.detail.tabs.documents')}</TabsTrigger>
            <TabsTrigger value="remediacao">{t('gapAnalysis.detail.tabs.remediation')}</TabsTrigger>
            <TabsTrigger value="soa">{t('gapAnalysis.detail.tabs.soa')}</TabsTrigger>
            <TabsTrigger value="biblioteca">{t('gapAnalysis.detail.tabs.evidenceLibrary')}</TabsTrigger>
            <TabsTrigger value="historico">{t('gapAnalysis.detail.tabs.history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="avaliacao" className="space-y-5">
            {/* Fica FORA do condicional de onboarding de propósito.

                O momento de maior valor desta secção é exatamente antes de
                começar: quem abre um framework novo e vê "doze destes trinta
                requisitos já estão respondidos noutro que você avaliou" decide
                de outra maneira. Escondê-la atrás do onboarding era mostrar a
                boa notícia só depois de a pessoa aceitar o trabalho todo. */}
            {empresaId && (
              <HerancaCrossFramework
                frameworkId={frameworkId!}
                empresaId={empresaId}
                onAplicado={() => {
                  loadCategoryData();
                  setScoreRefreshKey(k => k + 1);
                  setShowOnboarding(false);
                }}
              />
            )}

            {/* Montado fora do ramo: o onboarding pode abri-lo, e o dialogo
                precisa de existir nos dois estados. */}
            {empresaId && (
              <AssistenteDeEscopo
                open={escopoAberto}
                onOpenChange={setEscopoAberto}
                frameworkId={frameworkId!}
                frameworkName={framework.nome}
                empresaId={empresaId}
                totalRequisitos={totalRequirements}
                onAplicado={() => { setJaDeclarouEscopo(true); handleScoreChange(); }}
              />
            )}

            {showOnboarding ? (
              <FrameworkOnboarding
                frameworkNome={framework.nome}
                frameworkVersao={framework.versao}
                frameworkTipo={framework.tipo_framework}
                totalRequirements={totalRequirements}
                onStart={() => setShowOnboarding(false)}
                /* O caminho recomendado a partir daqui e' recortar o escopo,
                   nao abrir a lista inteira. So aparece se o framework tiver
                   assistente e a empresa ainda nao tiver declarado nada. */
                onEscopo={temAssistente && jaDeclarouEscopo === false
                  ? () => { setShowOnboarding(false); setEscopoAberto(true); }
                  : undefined}
              />
            ) : (
              <>
                {/* Um cabeçalho, três perguntas: quanto está de pé, dá para ir
                    à auditoria, e até quando. Eram dois cartões empilhados que
                    respondiam à mesma coisa com os mesmos números — 556px e
                    quatro botões formando dois pares idênticos. */}
                <FrameworkHeader
                  frameworkName={framework.nome}
                  overallScore={overallScore}
                  totalRequirements={totalRequirements}
                  conforme={contagem.conforme}
                  parcial={contagem.parcial}
                  naoConforme={contagem.naoConforme}
                  naoAplicavel={contagem.naoAplicavel}
                  naoAvaliado={contagem.naoAvaliado}
                  marco={marco ? {
                    rotulo: marco.rotulo,
                    dataAlvo: marco.data_alvo,
                    scoreAlvo: marco.score_alvo,
                  } : null}
                  onFiltrarPorEstado={filtrarPorEstado}
                  onGoToRemediation={() => setActiveTab('remediacao')}
                  onAbrirMarco={empresaId ? () => setMarcoDialogAberto(true) : undefined}
                />

                {/* A fila é o "o que eu faço agora" e estava espremida em um
                    terço de uma linha, debaixo de um cartão que dizia quase o
                    mesmo. Passa a largura inteira, logo abaixo do cabeçalho. */}
                {/*
                    O convite ao escopo, antes de tudo.

                    Vanta, Drata, Sprinto e Secureframe abrem todos por
                    contexto e recortam a norma antes de a mostrar. Aqui a
                    pessoa via 121 linhas em branco e a instrucao implicita de
                    as classificar uma a uma.
                */}
                {empresaId && temAssistente && jaDeclarouEscopo === false && (
                  <section className="rounded-lg border border-primary/30 bg-primary/5 p-5">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t('gapEscopo.conviteTitulo')}
                    </h3>
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {t('gapEscopo.conviteTexto', { total: totalRequirements })}
                    </p>
                    <Button className="mt-3" size="sm" onClick={() => setEscopoAberto(true)}>
                      {t('gapEscopo.conviteBotao')}
                    </Button>
                  </section>
                )}

                {/*
                    O plano, antes da fila.

                    A ordem da pagina passa a ser: onde estou (cabecalho), para
                    onde vou (fases), o que faco agora (fila), onde estou fraco
                    (mapa de calor), e o trabalho (tabela). Era medicao a seguir
                    a medicao ate a tabela.
                */}
                <PainelDeFases
                  frameworkName={framework.nome}
                  categorias={categoryData}
                  faseAtiva={searchParams.get('fase')}
                  onEscolherFase={(categorias) => {
                    const fase = (fasesDe(framework.nome) || []).find(
                      (f) => f.categorias.join('|') === categorias.join('|'),
                    );
                    const sp = new URLSearchParams(window.location.search);
                    if (fase) sp.set('fase', fase.id); else sp.delete('fase');
                    // A fase substitui o recorte por categoria: sao dois cortes
                    // do mesmo eixo e mante-los juntos daria lista vazia.
                    sp.delete('cat');
                    setSearchParams(sp, { replace: true });
                    setActiveCategoryFilter(undefined);
                    document.getElementById('reqs-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />

                {/*
                    Sem `evaluatedRequirements > 0`.

                    A fila é a resposta a "o que eu faço agora", e estava atrás
                    de já se ter feito alguma coisa: quem mais precisava dela
                    era exactamente quem não a via. E ela nunca precisou do
                    portão — `statusPenalty` já dá 0,35 a um requisito por
                    avaliar, portanto no dia um ela ordena por peso e devolve os
                    seis primeiros sem uma única avaliação registada.
                */}
                {empresaId && (
                  <PriorityQueueCard
                    frameworkId={frameworkId!}
                    empresaId={empresaId}
                    limit={6}
                    onRequirementClick={(req) => {
                      openRequirement({
                        requirementId: req.id,
                        empresaId,
                        onSaved: handleScoreChange,
                      });
                    }}
                    onSeeAll={() => {
                      document.getElementById('reqs-table')?.scrollIntoView({
                        behavior: 'smooth', block: 'start',
                      });
                    }}
                  />
                )}

                {/* Heatmap de aderência por categoria */}
                {categoryData.length > 0 && (
                  <SectionHeatmap
                    cells={categoryData.map<HeatCell>(c => ({
                      id: c.categoria,
                      label: c.categoria,
                      total: c.total,
                      score: c.score,
                      aplicaveis: c.aplicaveis,
                      avaliados: c.avaliados,
                    }))}
                    activeId={activeCategoryFilter}
                    onCellClick={(id) =>
                      setActiveCategoryFilter(prev => prev === id ? undefined : id)
                    }
                  />
                )}

                {/* A barra de chips saiu daqui.

                    Eram quatro atalhos de estado ("Todos / Sem evidência /
                    Críticos / Parciais") a duplicar o filtro que já existe na
                    tabela e a legenda que já existe no cabeçalho — três
                    controlos para a mesma coisa, um deles com rótulo errado
                    ("sem evidência" filtrava por `nao_avaliado`, que é outra
                    coisa). Ao lado vinha um seletor Tabela/Quadro em que o
                    Quadro estava permanentemente desativado com "em breve".

                    Hoje a distribuição do cabeçalho é o atalho, e cobre os
                    cinco estados em vez de três. */}
                <div id="reqs-table">
                  <GenericRequirementsTable
                    frameworkId={frameworkId!}
                    frameworkName={framework.nome}
                    config={config}
                    onStatusChange={handleScoreChange}
                    initialCategoryFilter={activeCategoryFilter}
                    onCategoryFilterChange={setActiveCategoryFilter}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="documentos" className="space-y-5">
            {adherenceView === 'result' && selectedAdherenceAssessment ? (
              <AdherenceResultView
                assessment={selectedAdherenceAssessment}
                onBack={() => setAdherenceView('list')}
                frameworkId={frameworkId!}
                onApplied={handleScoreChange}
              />
            ) : (
              <>
                {empresaId && (
                  <DocumentsHero
                    frameworkId={frameworkId!}
                    empresaId={empresaId}
                    onUploadClick={() => setDocUploadSignal(s => s + 1)}
                    onLinkClick={() => setDocUploadSignal(s => s + 1)}
                    onAIGenerate={() => setDocUploadSignal(s => s + 1)}
                  />
                )}
                <AdherenceAssessmentView
                  embedded
                  openSignal={docUploadSignal}
                  onViewResult={(assessment) => { setSelectedAdherenceAssessment(assessment); setAdherenceView('result'); }}
                  frameworkId={frameworkId}
                  frameworkNome={framework.nome}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="remediacao">
            <RemediationTabV2 frameworkId={frameworkId!} frameworkName={framework.nome} />
          </TabsContent>

          <TabsContent value="historico">
            <FrameworkHistoryTab
              frameworkId={frameworkId!}
              frameworkName={framework.nome}
              frameworkVersion={framework.versao}
              frameworkType={framework.tipo_framework}
              currentScore={overallScore}
              totalRequirements={totalRequirements}
              evaluatedRequirements={evaluatedRequirements}
            />
          </TabsContent>
          <TabsContent value="soa">
            <SoATabV2
              frameworkId={frameworkId!}
              frameworkName={framework.nome}
              frameworkVersion={framework.versao}
              sections={config.sections}
            />
          </TabsContent>
          <TabsContent value="biblioteca">
            <EvidenceLibraryHub />
          </TabsContent>
        </Tabs>

        {empresaId && frameworkId && (
          <DefinirMarcoDialog
            open={marcoDialogAberto}
            onOpenChange={setMarcoDialogAberto}
            empresaId={empresaId}
            frameworkId={frameworkId}
            marco={marco}
            scoreAtual={overallScore}
          />
        )}

        {/* Onda 4 — Command Palette (⌘K) */}
        {empresaId && frameworkId && (
          <CommandPalette
            frameworkId={frameworkId}
            empresaId={empresaId}
            onSaved={handleScoreChange}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
