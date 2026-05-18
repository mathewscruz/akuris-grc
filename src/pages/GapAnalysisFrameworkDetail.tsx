import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Download, FileBarChart, FileDown, HelpCircle, MoreHorizontal, FileText } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GenericRequirementsTable } from '@/components/gap-analysis/GenericRequirementsTable';
import { FrameworkHeroSummary } from '@/components/gap-analysis/FrameworkHeroSummary';
import { FrameworkHistoryTab } from '@/components/gap-analysis/FrameworkHistoryTab';
import { AdherenceAssessmentView } from '@/components/gap-analysis/adherence/AdherenceAssessmentView';
import { AdherenceResultView } from '@/components/gap-analysis/adherence/AdherenceResultView';
import { AIRecommendationsButton } from '@/components/gap-analysis/AIRecommendationsCard';
import { FrameworkOnboarding } from '@/components/gap-analysis/FrameworkOnboarding';
import { EvidenceLibraryHub } from '@/components/gap-analysis/EvidenceLibraryHub';
import {
  AssessmentInsightsStrip,
  SectionHeatmap,
  PriorityQueueCard,
  RequirementDrawerProvider,
  useRequirementDrawer,
  CommandPalette,
  DocumentsHero,
  RemediationTabV2,
  SoATabV2,
  type AssessmentInsight,
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
  const { frameworkId } = useParams<{ frameworkId: string }>();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
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
        toast.error('Framework não encontrado');
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
        supabase.from('gap_analysis_requirements').select('id, categoria').eq('framework_id', frameworkId),
        supabase.from('gap_analysis_evaluations').select('requirement_id, conformity_status').eq('framework_id', frameworkId).eq('empresa_id', empresaId),
      ]);
      const reqs = reqsRes.data || [];
      const evals = evalsRes.data || [];
      const evalMap = new Map(evals.map(e => [e.requirement_id, e.conformity_status || 'nao_avaliado']));
      const catMap: Record<string, { conforme: number; parcial: number; nao_conforme: number; nao_aplicavel: number; nao_avaliado: number; total: number }> = {};
      reqs.forEach(r => {
        const cat = r.categoria || 'Outros';
        if (!catMap[cat]) catMap[cat] = { conforme: 0, parcial: 0, nao_conforme: 0, nao_aplicavel: 0, nao_avaliado: 0, total: 0 };
        catMap[cat].total++;
        const st = evalMap.get(r.id) || 'nao_avaliado';
        if (st in catMap[cat]) (catMap[cat] as any)[st]++;
        else catMap[cat].nao_avaliado++;
      });
      setCategoryData(Object.entries(catMap).map(([categoria, data]) => ({ categoria, ...data })).sort((a, b) => a.categoria.localeCompare(b.categoria)));
    } catch (e) { /* silent */ }
  }, [frameworkId, empresaId]);

  useEffect(() => { loadCategoryData(); }, [loadCategoryData]);

  const config = useMemo(() =>
    framework ? getFrameworkConfig(framework.nome, framework.tipo_framework) : null,
    [framework?.nome, framework?.tipo_framework]
  );

  const defaultConfig = useMemo(() => getFrameworkConfig('default')!, []);

  // SoA (Statement of Applicability) só é exigida pela ISO 27001 e ISO 27701.
  const supportsSoA = useMemo(() => {
    if (!framework) return false;
    const n = framework.nome.toLowerCase();
    return n.includes('27001') || n.includes('27701');
  }, [framework]);

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

  // Se o usuário está na aba SoA mas o framework não a suporta, voltar para avaliação
  useEffect(() => {
    if (!supportsSoA && activeTab === 'soa') setActiveTab('avaliacao');
  }, [supportsSoA, activeTab]);

  const getExportData = async () => {
    const { data: reqs } = await supabase
      .from('gap_analysis_requirements')
      .select('id, codigo, titulo, categoria, peso, area_responsavel')
      .eq('framework_id', frameworkId)
      .order('ordem', { ascending: true });

    const { data: evals } = await supabase
      .from('gap_analysis_evaluations')
      .select('requirement_id, conformity_status')
      .eq('framework_id', frameworkId)
      .eq('empresa_id', empresaId);

    const evalMap = new Map(evals?.map(e => [e.requirement_id, e.conformity_status]) || []);
    const requirements = (reqs || []).map(r => ({
      codigo: r.codigo || '', titulo: r.titulo, categoria: r.categoria || '',
      conformity_status: evalMap.get(r.id) || 'nao_avaliado', peso: r.peso, area_responsavel: r.area_responsavel,
    }));

    const { data: empresa } = await supabase.from('empresas').select('nome').eq('id', empresaId).single();

    return {
      frameworkName: framework!.nome, frameworkVersion: framework!.versao,
      frameworkType: framework!.tipo_framework, overallScore, totalRequirements,
      evaluatedRequirements, pillarScores, categoryScores, requirements,
      empresaNome: empresa?.nome || 'Empresa',
      scoreType: config!.scoreType as 'decimal' | 'percentage',
      maxScore: config!.scoreType === 'percentage' ? 100 : 5,
    };
  };

  const handleExportPDF = async () => {
    if (!framework || !config) return;
    setExporting(true);
    try {
      const data = await getExportData();
      await exportFrameworkPDF(data);
      toast.success('PDF exportado com sucesso');
    } catch (error: any) {
      logger.error('Erro ao exportar PDF', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportBoard = async () => {
    if (!framework || !config) return;
    setExporting(true);
    try {
      const data = await getExportData();
      await exportBoardPDF(data);
      toast.success('Relatório executivo exportado com sucesso');
    } catch (error: any) {
      logger.error('Erro ao exportar PDF Board', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao exportar relatório executivo');
    } finally {
      setExporting(false);
    }
  };

  const handleScoreChange = useCallback(() => {
    setScoreRefreshKey(k => k + 1);
    loadCategoryData();
  }, [loadCategoryData]);

  if (loading || !framework || !config) {
    return (
      <ErrorBoundary>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <AkurisPulse size={64} />
          <p className="text-sm text-muted-foreground">Carregando framework...</p>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/gap-analysis/frameworks')}>
            <ChevronLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />Voltar
          </Button>
        </div>

        <PageHeader
          title={`${framework.nome} ${framework.versao}`}
          description={framework.descricao || FRAMEWORK_DESCRIPTIONS[framework.nome] || `Avaliação de conformidade ${framework.tipo_framework}`}
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
                  scoreType={config.scoreType}
                  onGoToRemediation={() => setActiveTab('remediacao')}
                />
              )}

              {/* Exportar — ação utilitária visível */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting}>
                    <FileDown className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    {exporting ? 'Exportando...' : 'Exportar'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPDF} disabled={exporting}>
                    <Download className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    PDF Técnico (detalhado)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportBoard} disabled={exporting}>
                    <FileBarChart className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    Relatório Executivo (Board)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mais ações — agrupa Gerador de Documentos e Tour */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Mais ações">
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => openDocGen({ frameworkId, frameworkName: framework.nome })}>
                    <AkurisAIIcon className="h-4 w-4 mr-2" />
                    Gerador de Documentos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setActiveTab('avaliacao'); setShowOnboarding(true); }}>
                    <HelpCircle className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    Revisitar tour
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
            <TabsTrigger value="documentos">Análise de Documentos</TabsTrigger>
            <TabsTrigger value="remediacao">Remediação</TabsTrigger>
            {supportsSoA && <TabsTrigger value="soa">SoA</TabsTrigger>}
            <TabsTrigger value="biblioteca">Biblioteca de Evidências</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="avaliacao" className="space-y-5">
            {showOnboarding ? (
              <FrameworkOnboarding
                frameworkNome={framework.nome}
                frameworkVersao={framework.versao}
                frameworkTipo={framework.tipo_framework}
                totalRequirements={totalRequirements}
                onStart={() => setShowOnboarding(false)}
              />
            ) : (
              <>
                {/* Hero consolidado: donut + sparkline + delta + chips de domínio/seção */}
                <FrameworkHeroSummary
                  overallScore={overallScore}
                  totalRequirements={totalRequirements}
                  evaluatedRequirements={evaluatedRequirements}
                  domainScores={domainScores}
                  sectionScores={sectionScores}
                  config={config}
                  frameworkId={frameworkId!}
                  loading={scoreLoading}
                  contextMessage={(() => {
                    if (totalRequirements === 0) return undefined;
                    if (evaluatedRequirements === 0)
                      return 'Comece avaliando os requisitos — clique em qualquer linha da tabela ou use a Análise de Documentos.';
                    const naoConforme = categoryData.reduce((s, c) => s + c.nao_conforme, 0);
                    if (naoConforme > 0)
                      return `${naoConforme} requisito(s) não conforme(s) identificado(s). Crie planos de ação para tratar os gaps.`;
                    if (evaluatedRequirements < totalRequirements)
                      return `Continue avaliando — ${evaluatedRequirements} de ${totalRequirements} concluídos.`;
                    return `Todos os ${totalRequirements} requisitos foram avaliados.`;
                  })()}
                  contextAction={
                    evaluatedRequirements > 0 && categoryData.reduce((s, c) => s + c.nao_conforme, 0) > 0
                      ? { label: 'Ver remediação', onClick: () => setActiveTab('remediacao') }
                      : evaluatedRequirements === 0 && totalRequirements > 0
                      ? { label: 'Analisar documentos', onClick: () => setActiveTab('documentos') }
                      : undefined
                  }
                />

                {/* Onda 3 — Strip de insights da avaliação */}
                {(() => {
                  const naoConformeCount = categoryData.reduce((s, c) => s + c.nao_conforme, 0);
                  const parcialCount = categoryData.reduce((s, c) => s + c.parcial, 0);
                  const coverage = totalRequirements > 0
                    ? Math.round((evaluatedRequirements / totalRequirements) * 100)
                    : 0;
                  const insights: AssessmentInsight[] = [
                    {
                      eyebrow: 'COBERTURA',
                      title: 'avaliados',
                      value: `${coverage}%`,
                      hint: `${evaluatedRequirements} de ${totalRequirements} requisitos passaram pela triagem.`,
                      tone: coverage >= 70 ? 'positive' : coverage >= 40 ? 'warning' : 'neutral',
                      ctaLabel: coverage < 100 && totalRequirements > 0 ? 'Continuar avaliação' : undefined,
                      onCta: coverage < 100 ? () => {
                        document.getElementById('reqs-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      } : undefined,
                    },
                    {
                      eyebrow: 'CRITICIDADE',
                      title: 'não conformes',
                      value: naoConformeCount,
                      hint: naoConformeCount > 0
                        ? `Crie planos de ação para fechar os gaps identificados.`
                        : `Nenhum gap crítico no momento — mantenha a vigilância.`,
                      tone: naoConformeCount > 0 ? 'critical' : 'positive',
                      ctaLabel: naoConformeCount > 0 ? 'Ver remediação' : undefined,
                      onCta: naoConformeCount > 0 ? () => setActiveTab('remediacao') : undefined,
                    },
                    {
                      eyebrow: 'PARCIAIS',
                      title: 'em evolução',
                      value: parcialCount,
                      hint: parcialCount > 0
                        ? `Requisitos parcialmente atendidos — próximos a fechar.`
                        : `Sem itens parciais. Avaliações são binárias por enquanto.`,
                      tone: parcialCount > 0 ? 'warning' : 'neutral',
                    },
                  ];
                  return <AssessmentInsightsStrip insights={insights} />;
                })()}

                {/* Onda 3 — Fila de Prioridade (top-N requisitos pela IA) */}
                {empresaId && evaluatedRequirements > 0 && (
                  <PriorityQueueCard
                    frameworkId={frameworkId!}
                    empresaId={empresaId}
                    limit={5}
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

                {/* Onda 3 — Heatmap de aderência por categoria (substitui CategoryBarChart) */}
                {categoryData.length > 0 && (
                  <SectionHeatmap
                    cells={categoryData.map<HeatCell>(c => ({
                      id: c.categoria,
                      label: c.categoria,
                      total: c.total,
                      conforme: c.conforme,
                      parcial: c.parcial,
                      nao_conforme: c.nao_conforme,
                      nao_aplicavel: c.nao_aplicavel,
                      nao_avaliado: c.nao_avaliado,
                    }))}
                    activeId={activeCategoryFilter}
                    onCellClick={(id) =>
                      setActiveCategoryFilter(prev => prev === id ? undefined : id)
                    }
                  />
                )}

                <div id="reqs-table">
                  <GenericRequirementsTable
                    frameworkId={frameworkId!}
                    frameworkName={framework.nome}
                    config={config}
                    onStatusChange={handleScoreChange}
                    initialCategoryFilter={activeCategoryFilter}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="documentos">
            {adherenceView === 'result' && selectedAdherenceAssessment ? (
              <AdherenceResultView
                assessment={selectedAdherenceAssessment}
                onBack={() => setAdherenceView('list')}
                frameworkId={frameworkId!}
                onApplied={handleScoreChange}
              />
            ) : (
              <AdherenceAssessmentView
                onViewResult={(assessment) => { setSelectedAdherenceAssessment(assessment); setAdherenceView('result'); }}
                frameworkId={frameworkId}
                frameworkNome={framework.nome}
              />
            )}
          </TabsContent>

          <TabsContent value="remediacao">
            <RemediationTab frameworkId={frameworkId!} frameworkName={framework.nome} />
          </TabsContent>

          <TabsContent value="historico">
            <FrameworkHistoryTab
              frameworkId={frameworkId!}
              frameworkName={framework.nome}
              frameworkVersion={framework.versao}
              frameworkType={framework.tipo_framework}
              scoreType={config.scoreType}
              currentScore={overallScore}
              totalRequirements={totalRequirements}
              evaluatedRequirements={evaluatedRequirements}
            />
          </TabsContent>
          <TabsContent value="soa">
            <SoATab
              frameworkId={frameworkId!}
              frameworkName={framework.nome}
              frameworkVersion={framework.versao}
            />
          </TabsContent>
          <TabsContent value="biblioteca">
            <EvidenceLibraryHub />
          </TabsContent>
        </Tabs>

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
