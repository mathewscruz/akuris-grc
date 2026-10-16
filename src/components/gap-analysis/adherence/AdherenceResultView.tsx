import { AnaliseCompleta } from './AnaliseCompleta';
import { VeredictoBadge } from './VeredictoBadge';
import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AjustesMasterDetail } from './AjustesMasterDetail';
import { useAutoresDaEmpresa, abrirDocumentoAnalisado } from './autoria';
import type { Json } from '@/integrations/supabase/types';
import { IconDownload, IconSuccess, IconWarning, IconRefresh, IconFile, IconIdea, IconArrowLeft, IconTrendUp } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import type { AdherenceAssessment, PontoForte, PontoMelhoria } from './types';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { exigirEscrita } from '@/lib/supabase-write';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDocGen } from '@/contexts/DocGenContext';
import { useAuth } from '@/components/AuthProvider';
import { sugerirPrazoPorPrioridade } from '@/lib/preenchimento-inteligente';
import { AdherenceAssessmentDialog } from './AdherenceAssessmentDialog';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';

import { agruparAjustes, type Acao } from './ajustes';
import { AjusteCard } from './AjusteCard';
type Comparacao = { resolvidos: number; pendentes: number; melhorados: number; piorados: number };
const TOM_VEREDITO = { em_compliance: 'success', com_ressalvas: 'warning', nao_compliance: 'destructive' } as const;

/** Anel da nota: conta de 0 até o valor (instantâneo com "reduzir movimento"). */
function ScoreRing({ value, tone }: { value: number; tone: 'success' | 'warning' | 'destructive' }) {
  const alvo = Math.max(0, Math.min(100, Math.round(value)));
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(alvo); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  const R = 52, C = 2 * Math.PI * R;
  const cor = tone === 'success' ? 'stroke-success' : tone === 'warning' ? 'stroke-warning' : 'stroke-destructive';
  return (
    <div className="relative h-32 w-32 shrink-0 self-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} className="fill-none stroke-muted" strokeWidth="9" />
        <circle cx="60" cy="60" r={R} strokeWidth="9" strokeLinecap="round" className={cn('fill-none', cor)} strokeDasharray={C} strokeDashoffset={C - (v / 100) * C} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">{v}%</span>
      </div>
    </div>
  );
}
interface AdherenceResultViewProps {
  assessment: AdherenceAssessment;
  onBack: () => void;
  frameworkId?: string;
  onApplied?: () => void;
}

export function AdherenceResultView({ assessment, onBack, frameworkId, onApplied }: AdherenceResultViewProps) {
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();
  const autores = useAutoresDaEmpresa(empresaId, [assessment as { created_by?: string | null }]);
  const [applying, setApplying] = useState(false);
  const { openDocGen } = useDocGen();
  const { user } = useAuth();
  const [planosCriados, setPlanosCriados] = useState<Set<number>>(new Set());
  const [criandoPlano, setCriandoPlano] = useState<number | null>(null);
  const [novaVersaoOpen, setNovaVersaoOpen] = useState(false);
  const meta = ((assessment as { metadados_analise?: Record<string, unknown> }).metadados_analise ?? {}) as Record<string, any>;
  const veredito = meta.veredito as keyof typeof TOM_VEREDITO | undefined;
  const acoes: Acao[] = Array.isArray(meta.acoes) ? meta.acoes : [];
  const foraIds: string[] = Array.isArray(meta.fora_escopo_ids) ? meta.fora_escopo_ids : [];
  const comparacao = meta.comparacao as Comparacao | null | undefined;
  const [verTodosFortes, setVerTodosFortes] = useState(false);
  const [aba, setAba] = useState('ajustes');
  const [filtroReq, setFiltroReq] = useState<'todos' | 'conforme' | 'parcial' | 'nao_conforme'>('todos');
  const abasRef = useRef<HTMLDivElement>(null);
  const irPara = (k: string) => {
    setAba(k);
    requestAnimationFrame(() => abasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const grupos = agruparAjustes(acoes, veredito === 'em_compliance');
  const porPrioridade = { alta: [], media: [], baixa: [] } as Record<'alta' | 'media' | 'baixa', { acao: Acao; idx: number }[]>;
  acoes.forEach((acao, idx) => {
    const p = (['alta', 'media', 'baixa'].includes(acao.prioridade || '') ? acao.prioridade : 'media') as 'alta' | 'media' | 'baixa';
    porPrioridade[p].push({ acao, idx });
  });

  const { data: foraEscopo } = useOptimizedQuery(
    async () => {
      if (!foraIds.length) return { data: [], error: null };
      const { data, error } = await supabase
        .from('gap_analysis_requirements')
        .select('id, codigo, titulo')
        .in('id', foraIds.slice(0, 500))
        .order('ordem');
      if (error) throw error;
      return { data, error: null };
    },
    [assessment.id, foraIds.length],
    { cacheKey: `adherence-fora-${assessment.id}`, cacheDuration: 300000 }
  );

  /** Um clique: plano de ação ligado ao framework, prazo pela prioridade, responsável = quem clicou. */
  const criarPlano = async (acao: Acao, idx: number) => {
    if (!empresaId) return;
    setCriandoPlano(idx);
    try {
      const prioridade = ['alta', 'media', 'baixa'].includes(acao.prioridade || '') ? acao.prioridade! : 'media';
      await exigirEscrita(supabase.from('planos_acao').insert({
        empresa_id: empresaId,
        titulo: acao.titulo.slice(0, 200),
        descricao: [acao.descricao, `${assessment.framework_nome} · ${assessment.documento_nome}`].filter(Boolean).join('\n\n'),
        prioridade,
        status: 'pendente',
        prazo: sugerirPrazoPorPrioridade(prioridade),
        responsavel_id: user?.id ?? null,
        created_by: user?.id ?? null,
        modulo_origem: 'frameworks',
        registro_origem_id: frameworkId ?? null,
        registro_origem_titulo: `${assessment.framework_nome}${acao.requisito_codigo ? ` · ${acao.requisito_codigo}` : ''} · ${assessment.documento_nome}`,
      }));
      setPlanosCriados(prev => new Set(prev).add(idx));
      toast({ title: t('gapAnalysis.adherenceUi.verdict.planCreated'), description: acao.titulo });
    } catch (err) {
      logger.error('Erro ao criar plano a partir da análise', { error: err instanceof Error ? err.message : String(err) });
      toast({ title: t('gapAnalysis.adherenceUi.verdict.planError'), variant: 'destructive' });
    } finally {
      setCriandoPlano(null);
    }
  };
  const dateLocale = locale === 'en' ? enUS : ptBR;
  
  const { data: details } = useOptimizedQuery(
    async () => {
      const { data, error } = await supabase
        .from('gap_analysis_adherence_details')
        .select('*')
        .eq('assessment_id', assessment.id)
        .order('requisito_codigo');
      if (error) throw error;
      return { data, error: null };
    },
    [assessment.id],
    { cacheKey: `adherence-details-${assessment.id}`, cacheDuration: 60000 }
  );

  const { data: empresa } = useOptimizedQuery(
    async () => {
      if (!empresaId) return { data: null, error: null };
      const { data, error } = await supabase
        .from('empresas')
        .select('nome, logo_url')
        .eq('id', empresaId)
        .single();
      if (error) throw error;
      return { data, error: null };
    },
    [empresaId],
    { cacheKey: `empresa-${empresaId}`, cacheDuration: 300000 }
  );

  const getResultIconColor = (resultado?: string) => {
    switch (resultado) {
      case 'conforme':
        return { bg: 'bg-success/15', icon: 'text-success' };
      case 'nao_conforme':
        return { bg: 'bg-destructive/15', icon: 'text-destructive' };
      case 'parcial':
        return { bg: 'bg-warning/15', icon: 'text-warning' };
      default:
        return { bg: 'bg-muted', icon: 'text-muted-foreground' };
    }
  };

  const getResultLabel = (resultado?: string) => {
    switch (resultado) {
      case 'conforme': return t('gapAnalysis.adherenceUi.result.resultConforme');
      case 'nao_conforme': return t('gapAnalysis.adherenceUi.result.resultNaoConforme');
      case 'parcial': return t('gapAnalysis.adherenceUi.result.resultParcial');
      default: return t('gapAnalysis.adherenceUi.result.resultUnknown');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'conforme': return 'bg-success';
      case 'nao_conforme': return 'bg-destructive';
      case 'parcial': return 'bg-warning';
      case 'nao_aplicavel': return 'bg-muted-foreground/40';
      default: return 'bg-muted-foreground/40';
    }
  };

  const getPrioridadeBadgeVariant = (prioridade: string) => {
    switch (prioridade) {
      case 'alta': return 'destructive' as const;
      case 'media': return 'warning' as const;
      case 'baixa': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };
  
  const getPrioridadeLabel = (prioridade: string): string => {
    switch (prioridade) {
      case 'alta': return t('gapAnalysis.adherenceUi.result.priorityAlta');
      case 'media': return t('gapAnalysis.adherenceUi.result.priorityMedia');
      case 'baixa': return t('gapAnalysis.adherenceUi.result.priorityBaixa');
      default: return prioridade;
    }
  };

  const handleExportPDF = async () => {
    try {
      const { getCompanyLogoUrl } = await import('@/lib/brand-logo');
      const { exportAssessmentToPDF } = await import('./ExportPDF');
      await exportAssessmentToPDF(assessment, details, getCompanyLogoUrl(empresa?.logo_url), t, dateLocale);
      toast({ title: t('gapAnalysis.adherenceUi.result.pdfExportedTitle'), description: t('gapAnalysis.adherenceUi.result.pdfExportedDescription') });
    } catch (error) {
      logger.error('Error exporting PDF:', { error: error instanceof Error ? error.message : String(error) });
      toast({ title: t('gapAnalysis.adherenceUi.result.pdfExportErrorTitle'), description: t('gapAnalysis.adherenceUi.result.pdfExportErrorDescription'), variant: "destructive" });
    }
  };

  const handleApplyToEvaluation = async () => {
    if (!details || !empresaId || !frameworkId) return;
    setApplying(true);
    try {
      const applicableDetails = details.filter(
        (d: any) => d.requirement_id && d.status_aderencia && d.status_aderencia !== 'nao_aplicavel'
      );

      if (applicableDetails.length === 0) {
        toast({ title: t('gapAnalysis.adherenceUi.result.noApplicableResultsTitle'), description: t('gapAnalysis.adherenceUi.result.noApplicableResultsDescription') });
        return;
      }

      // Map adherence status to conformity_status
      const statusMap: Record<string, string> = {
        conforme: 'conforme',
        parcial: 'parcial',
        nao_conforme: 'nao_conforme',
      };

      /*
        O documento que sustentou a conclusão anexa-se como prova.

        Isto marcava o requisito como conforme e não deixava nada atrás: nem
        ficheiro, nem — no ramo de actualização — sequer a nota a dizer de que
        documento veio a decisão. O auditor pergunta "mostre-me a evidência de
        que A.5.1 está conforme" e não havia nenhuma.

        O caminho do ficheiro está em `metadados_analise.arquivo_storage`,
        bucket `adherence-documents`. Entra no `evidence_files` da avaliação,
        que é o que o ecrã lê — e daí o gatilho da base espelha-o na Biblioteca
        de Evidências, já ligado a este requisito.
      */
      const meta = ((assessment as { metadados_analise?: Record<string, unknown> })
        ?.metadados_analise ?? {}) as Record<string, unknown>;
      const caminhoDoDocumento = (meta.arquivo_storage as string | undefined) || null;
      const provaDaAnalise = caminhoDoDocumento
        ? {
            name: (meta.arquivo_original as string | undefined)
              || assessment.documento_nome
              || caminhoDoDocumento,
            path: caminhoDoDocumento,
            url: caminhoDoDocumento,
            bucket: 'adherence-documents',
            type: (meta.arquivo_original_tipo as string | undefined)
              || assessment.documento_tipo
              || null,
            size: (meta.arquivo_tamanho as number | undefined) ?? null,
            origem: 'analise_documental',
          }
        : null;

      /** Junta a prova sem a repetir se já lá estiver. */
      type FicheiroDeProva = { path?: string; url?: string; [k: string]: Json | undefined };
      const comProva = (atuais: unknown): Json[] => {
        const lista = Array.isArray(atuais) ? [...(atuais as FicheiroDeProva[])] : [];
        if (!provaDaAnalise) return lista as Json[];
        const jaTem = lista.some((f) => (f?.path || f?.url) === provaDaAnalise.path);
        return (jaTem ? lista : [...lista, provaDaAnalise]) as Json[];
      };

      let applied = 0;
      for (const detail of applicableDetails) {
        const conformityStatus = statusMap[detail.status_aderencia];
        if (!conformityStatus) continue;

        // Check if evaluation exists
        const { data: existing } = await supabase
          .from('gap_analysis_evaluations')
          .select('id, conformity_status, evidence_files, observacoes')
          .eq('framework_id', frameworkId)
          .eq('requirement_id', detail.requirement_id)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (existing) {
          // Only update if current status is worse or not evaluated
          const priority: Record<string, number> = { nao_avaliado: 0, pendente: 0, nao_conforme: 1, parcial: 2, conforme: 3 };
          const currentPriority = priority[existing.conformity_status || 'nao_avaliado'] || 0;
          const newPriority = priority[conformityStatus] || 0;
          if (newPriority > currentPriority) {
            const nota = t('gapAnalysis.adherenceUi.result.autoEvaluatedNote', { doc: assessment.documento_nome });
            await exigirEscrita(supabase.from('gap_analysis_evaluations')
              .update({
                conformity_status: conformityStatus,
                evidence_files: comProva(existing.evidence_files),
                /*
                  A origem da conclusão também aqui. O ramo de actualização não
                  escrevia nota nenhuma: o status subia para conforme e não
                  ficava registo de que documento o justificou.
                */
                observacoes: existing.observacoes?.includes(assessment.documento_nome ?? '')
                  ? existing.observacoes
                  : [existing.observacoes, nota].filter(Boolean).join('\n'),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id));
            applied++;
          }
        } else {
          await exigirEscrita(supabase.from('gap_analysis_evaluations')
            .insert({
              framework_id: frameworkId,
              requirement_id: detail.requirement_id,
              empresa_id: empresaId,
              conformity_status: conformityStatus,
              evidence_files: comProva(null),
              /*
                `pendente` alimenta o KPI "itens pendentes" em
                useGapAnalysisStats. Com a prova anexada aqui mesmo, deixar
                `pendente` fazia o painel pedir uma evidência que já existe.
              */
              evidence_status: provaDaAnalise ? 'anexada' : 'pendente',
              observacoes: t('gapAnalysis.adherenceUi.result.autoEvaluatedNote', { doc: assessment.documento_nome }),
            }));
          applied++;
        }
      }

      toast({
        title: t('gapAnalysis.adherenceUi.result.appliedResultsTitle'),
        description: t('gapAnalysis.adherenceUi.result.appliedResultsDescription', { count: applied }),
      });
      onApplied?.();
    } catch (err: any) {
      logger.error('Error applying results:', { error: err instanceof Error ? err.message : String(err) });
      toast({ title: t('gapAnalysis.adherenceUi.result.applyErrorTitle'), description: t('gapAnalysis.adherenceUi.result.applyErrorDescription'), variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <IconArrowLeft className="mr-2 h-4 w-4" strokeWidth={1.5}/>
          {t('gapAnalysis.adherenceUi.result.back')}
        </Button>
        <div className="flex gap-2">
          {frameworkId && details && details.length > 0 && (
            <Button variant="default" onClick={handleApplyToEvaluation} disabled={applying}>
              {applying ? (
                <><AkurisPulse size={16} className="mr-2" />{t('gapAnalysis.adherenceUi.result.applying')}</>
              ) : (
                <><IconRefresh className="mr-2 h-4 w-4" strokeWidth={1.5}/>{t('gapAnalysis.adherenceUi.result.applyToManualEvaluation')}</>
              )}
            </Button>
          )}
          {meta.arquivo_storage && (
            <Button variant="outline" onClick={() => abrirDocumentoAnalisado(assessment, t)}>
              <IconFile className="mr-2 h-4 w-4" strokeWidth={1.5}/>{t('gapAnalysis.adherenceUi.view.openDocument')}
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPDF}>
            <IconDownload className="mr-2 h-4 w-4" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.exportPdf')}
          </Button>
        </div>
      </div>

      {/* Veredito: responde a pergunta "está em compliance?" */}
      {veredito && (
        <Card className="overflow-hidden border p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <ScoreRing value={assessment.percentual_conformidade ?? 0} tone={TOM_VEREDITO[veredito]} />
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('gapAnalysis.adherenceUi.verdict.question', { norma: `${assessment.framework_nome ?? ''} ${assessment.framework_versao ?? ''}`.trim() })}
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground md:text-2xl">{t(`gapAnalysis.adherenceUi.verdict.guide.answer_${veredito}`, { norma: assessment.framework_nome ?? '', n: grupos.essenciais.length })}</h2>
                <VeredictoBadge veredito={veredito} />
              </div>
              {meta.veredito_resumo && <p className="max-w-[760px] text-sm leading-relaxed text-foreground">{meta.veredito_resumo}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                {meta.documento_tema ? `${meta.documento_tema} · ` : ''}{assessment.documento_nome}
                {autores[(assessment as any).created_by] ? ` · ${t('gapAnalysis.adherenceUi.view.sentBy', { nome: autores[(assessment as any).created_by] })}` : ''}
                {` · ${format(new Date(assessment.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {veredito === 'em_compliance' && frameworkId && details && details.length > 0 && (
                  <Button size="sm" onClick={handleApplyToEvaluation} disabled={applying}>
                    {applying && <AkurisPulse size={16} className="mr-2" />}{t('gapAnalysis.adherenceUi.verdict.guide.useAsEvidence')}
                  </Button>
                )}
                {frameworkId && acoes.length > 0 && (
                  <Button size="sm" onClick={() => openDocGen({ frameworkId, frameworkName: assessment.framework_nome ?? undefined, mode: 'generate' })}>
                    {t('gapAnalysis.adherenceUi.verdict.fixWithDocgen')}
                  </Button>
                )}
                {frameworkId && (
                  <Button variant="outline" size="sm" onClick={() => setNovaVersaoOpen(true)}>
                    <IconRefresh className="mr-2 h-4 w-4" strokeWidth={1.5}/>{t('gapAnalysis.adherenceUi.verdict.newVersion')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Cartões-atalho: cada um leva à sua seção */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { k: 'ajustes', l: 'essentials', v: grupos.essenciais.length, dot: 'bg-destructive' },
              { k: 'ajustes', l: 'recommended', v: grupos.recomendados.length, dot: 'bg-warning' },
              { k: 'atende', l: 'good', v: assessment.pontos_fortes?.length ?? 0, dot: 'bg-success' },
              { k: 'fora', l: 'outScope', v: foraIds.length, dot: 'bg-muted-foreground/50' },
            ].map((s, i) => (
              <button
                key={s.l}
                type="button"
                onClick={() => irPara(s.k)}
                className="group rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent animate-in fade-in duration-500"
                style={{ animationDelay: `${150 + i * 70}ms`, animationFillMode: 'both' }}
              >
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', s.dot)} />{t(`gapAnalysis.adherenceUi.verdict.ui.${s.l}`)}
                </span>
                <span className="mt-1 block text-2xl font-semibold tabular-nums text-foreground">{s.v}</span>
                <span className="block text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{t('gapAnalysis.adherenceUi.verdict.ui.shortcutHint')} →</span>
              </button>
            ))}
          </div>

          {comparacao && (
            <p className="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm text-foreground">
              {t('gapAnalysis.adherenceUi.verdict.comparison', { resolvidos: comparacao.resolvidos, pendentes: comparacao.pendentes })}
              {comparacao.piorados > 0 ? ` · ${t('gapAnalysis.adherenceUi.verdict.comparisonWorse', { piorados: comparacao.piorados })}` : ''}
            </p>
          )}
        </Card>
      )}

      {/* Seções organizadas em abas */}
      {veredito && (
        <Tabs value={aba} onValueChange={setAba} className="space-y-4" ref={abasRef}>
          <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="ajustes">{t('gapAnalysis.adherenceUi.verdict.ui.tabAdjust')} <span className="ml-1.5 tabular-nums text-muted-foreground">{acoes.length}</span></TabsTrigger>
              <TabsTrigger value="atende">{t('gapAnalysis.adherenceUi.verdict.ui.tabGood')} <span className="ml-1.5 tabular-nums text-muted-foreground">{assessment.pontos_fortes?.length ?? 0}</span></TabsTrigger>
              {details && details.length > 0 && <TabsTrigger value="requisitos">{t('gapAnalysis.adherenceUi.verdict.ui.tabDetail')} <span className="ml-1.5 tabular-nums text-muted-foreground">{details.length}</span></TabsTrigger>}
              <TabsTrigger value="fora">{t('gapAnalysis.adherenceUi.verdict.ui.tabOut')} <span className="ml-1.5 tabular-nums text-muted-foreground">{foraIds.length}</span></TabsTrigger>
              {assessment.analise_detalhada && <TabsTrigger value="completa">{t('gapAnalysis.adherenceUi.verdict.ui.tabFull')}</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="ajustes" className="mt-0 space-y-4 animate-in fade-in duration-300">
            {acoes.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.ui.adjustHint')}</p>
                {grupos.essenciais.length > 0 && (
                  <div className="w-full max-w-[260px] space-y-1">
                    <p className="text-xs text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.ui.plansProgress', { done: grupos.essenciais.filter(g => planosCriados.has(g.idx)).length, total: grupos.essenciais.length })}</p>
                    <Progress value={(grupos.essenciais.filter(g => planosCriados.has(g.idx)).length / grupos.essenciais.length) * 100} className="h-1.5" />
                  </div>
                )}
              </div>
            )}
            {veredito === 'em_compliance' && acoes.length === 0 ? (
              <Card className="flex items-center gap-4 p-6">
                <IconSuccess className="h-10 w-10 shrink-0 text-success animate-in zoom-in-50 duration-700" strokeWidth={1.5} />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t('gapAnalysis.adherenceUi.verdict.guide.congratsTitle', { norma: assessment.framework_nome ?? '' })}</h3>
                  <p className="text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.guide.congratsText')}</p>
                </div>
              </Card>
            ) : (
              <AjustesMasterDetail essenciais={grupos.essenciais} recomendados={grupos.recomendados}
                planosCriados={planosCriados} criandoPlano={criandoPlano} onCriarPlano={criarPlano} />
            )}
            {veredito !== 'em_compliance' && (
              <ol className="grid gap-2 rounded-lg border bg-muted/20 p-3 md:grid-cols-3">
                {(['next1', 'next2', 'next3'] as const).map((s, i) => (
                  <li key={s} className="flex gap-2.5 text-sm text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold">{i + 1}</span>
                    {t(`gapAnalysis.adherenceUi.verdict.guide.${s}`)}
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="atende" className="mt-0 space-y-3 animate-in fade-in duration-300">
            <p className="text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.ui.goodHint')}</p>
            {(assessment.pontos_fortes?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.ui.noItems')}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {assessment.pontos_fortes!.map((ponto: PontoForte, index: number) => (
                  <div key={index} className="flex gap-3 rounded-lg border bg-card p-4 animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${(index % 6) * 50}ms`, animationFillMode: 'both' }}>
                    <IconSuccess className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={1.5} />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground">{ponto.titulo}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{ponto.descricao}</p>
                      {(ponto as PontoForte & { citacao?: string }).citacao && (
                        <blockquote className="mt-2 rounded-r-md border-l-2 border-success/50 bg-muted/30 px-3 py-1.5 text-xs italic text-muted-foreground">
                          “{(ponto as PontoForte & { citacao?: string }).citacao}”
                        </blockquote>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {details && details.length > 0 && (
            <TabsContent value="requisitos" className="mt-0 space-y-3 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.ui.detailHint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['todos', 'conforme', 'parcial', 'nao_conforme'] as const).map(f => {
                    const n = f === 'todos' ? details.length : details.filter((d: any) => d.status_aderencia === f).length;
                    return (
                      <Button key={f} size="sm" variant={filtroReq === f ? 'secondary' : 'ghost'} onClick={() => setFiltroReq(f)}>
                        {f === 'todos' ? t('gapAnalysis.adherenceUi.verdict.ui.all') : getResultLabel(f)} <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <Card className="p-2">
                <Accordion type="single" collapsible className="w-full">
                  {details.filter((d: any) => filtroReq === 'todos' || d.status_aderencia === filtroReq).map((detail: any) => (
                    <AccordionItem key={detail.id} value={detail.id} className="px-2">
                      <AccordionTrigger>
                        <div className="flex w-full items-center justify-between gap-3 pr-4 text-left">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStatusColor(detail.status_aderencia)}`} />
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">{detail.requisito_codigo}</span>
                            <span className="truncate text-sm">{detail.requisito_titulo}</span>
                          </div>
                          {detail.score_conformidade !== null && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{detail.score_conformidade}/10</span>}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="max-w-[760px] space-y-3 pl-6">
                          {detail.evidencias_encontradas && <div><h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('gapAnalysis.adherenceUi.result.evidenceFound')}</h5><p className="text-sm text-foreground">{detail.evidencias_encontradas}</p></div>}
                          {detail.gaps_especificos && <div><h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('gapAnalysis.adherenceUi.result.gapsIdentified')}</h5><p className="text-sm text-foreground">{detail.gaps_especificos}</p></div>}
                          {detail.observacoes_ia && <div><h5 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('gapAnalysis.adherenceUi.result.aiObservations')}</h5><p className="text-sm text-foreground">{detail.observacoes_ia}</p></div>}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="fora" className="mt-0 space-y-3 animate-in fade-in duration-300">
            <p className="text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.outOfScopeHint')}</p>
            {!foraEscopo || foraEscopo.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.ui.noItems')}</p>
            ) : (
              <Card className="grid gap-x-6 gap-y-1.5 p-4 md:grid-cols-2">
                {foraEscopo.map((r: any) => (
                  <p key={r.id} className="truncate text-sm text-foreground">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{r.codigo}</span>{r.titulo}
                  </p>
                ))}
              </Card>
            )}
          </TabsContent>

          {assessment.analise_detalhada && (
            <TabsContent value="completa" className="mt-0 animate-in fade-in duration-300">
              <AnaliseCompleta texto={assessment.analise_detalhada} />
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Resultado Geral (análises antigas, sem veredito) */}
      {!veredito && (
      <Card className="p-8 border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-3">
            {assessment.resultado_geral === 'conforme' ? (
              <IconSuccess className={`h-6 w-6 ${getResultIconColor(assessment.resultado_geral).icon}`} />
            ) : (
              <IconWarning className={`h-6 w-6 ${getResultIconColor(assessment.resultado_geral).icon}`} />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">{getResultLabel(assessment.resultado_geral)}</h2>
          <p className="text-4xl font-bold mb-4 text-foreground">{assessment.percentual_conformidade}%</p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">{t('gapAnalysis.adherenceUi.result.frameworkLabel')}</span> {assessment.framework_nome} {assessment.framework_versao}
            </div>
            <div>|</div>
            <div>
              <span className="font-medium">{t('gapAnalysis.adherenceUi.result.documentLabel')}</span> {assessment.documento_nome}
            </div>
          </div>
          <p className="text-xs mt-2 text-muted-foreground">
            {t('gapAnalysis.adherenceUi.result.analyzedOn', { date: format(new Date(assessment.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: dateLocale }) })}
          </p>
        </div>
      </Card>
      )}

      {/* Pontos Fortes */}
      {!veredito && assessment.pontos_fortes && assessment.pontos_fortes.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <IconSuccess className="h-5 w-5 text-muted-foreground" strokeWidth={1.5}/>
            {veredito
              ? t('gapAnalysis.adherenceUi.verdict.whatsGood', { count: assessment.pontos_fortes.length })
              : t('gapAnalysis.adherenceUi.result.strongPointsTitle', { count: assessment.pontos_fortes.length })}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {(verTodosFortes ? assessment.pontos_fortes : assessment.pontos_fortes.slice(0, 4)).map((ponto: PontoForte, index: number) => (
              <div key={index} className="flex gap-3 rounded-lg border bg-card p-4 animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${(index % 4) * 60}ms`, animationFillMode: 'both' }}>
                <IconSuccess className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={1.5} />
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground">{ponto.titulo}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{ponto.descricao}</p>
                  {(ponto as PontoForte & { citacao?: string }).citacao && (
                    <blockquote className="mt-2 rounded-r-md border-l-2 border-success/50 bg-muted/30 px-3 py-1.5 text-xs italic text-muted-foreground">
                      “{(ponto as PontoForte & { citacao?: string }).citacao}”
                    </blockquote>
                  )}
                </div>
              </div>
            ))}
          </div>
          {assessment.pontos_fortes.length > 4 && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setVerTodosFortes(v => !v)}>
              {verTodosFortes ? t('gapAnalysis.adherenceUi.verdict.ui.showLess') : t('gapAnalysis.adherenceUi.verdict.ui.showAll', { count: assessment.pontos_fortes.length })}
            </Button>
          )}
        </Card>
      )}

      {/* Pontos de Melhoria (análises antigas) */}
      {!veredito && assessment.pontos_melhoria && assessment.pontos_melhoria.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <IconWarning className="h-5 w-5 text-muted-foreground" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.improvementPointsTitle', { count: assessment.pontos_melhoria.length })}
          </h3>
          <div className="space-y-3">
            {assessment.pontos_melhoria.map((ponto: PontoMelhoria, index: number) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-foreground">{ponto.titulo}</h4>
                  <Badge variant={getPrioridadeBadgeVariant(ponto.prioridade)} className="whitespace-nowrap">{getPrioridadeLabel(ponto.prioridade)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{ponto.descricao}</p>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Recomendações */}
      {!veredito && assessment.recomendacoes && assessment.recomendacoes.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <IconIdea className="h-5 w-5 text-muted-foreground" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.recommendationsTitle')}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-foreground">
            {assessment.recomendacoes.map((rec: string, index: number) => (
              <li key={index} className="text-sm">{rec}</li>
            ))}
          </ol>
        </Card>
      )}

      {/* Análise Detalhada por Requisito */}
      {!veredito && details && details.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <IconFile className="h-5 w-5" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.detailedAnalysisTitle')}
          </h3>
          <Accordion type="single" collapsible className="w-full">
            {details.map((detail: any, index: number) => (
              <AccordionItem key={detail.id} value={`item-${index}`}>
                <AccordionTrigger>
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(detail.status_aderencia)}`} />
                      <span className="font-mono text-sm">{detail.requisito_codigo}</span>
                      <span className="text-sm">{detail.requisito_titulo}</span>
                    </div>
                    {detail.score_conformidade !== null && (
                      <Badge variant="outline">{detail.score_conformidade}/10</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {detail.evidencias_encontradas && (
                      <div>
                        <h5 className="font-semibold text-sm text-foreground mb-1">{t('gapAnalysis.adherenceUi.result.evidenceFound')}</h5>
                        <p className="text-sm text-muted-foreground">{detail.evidencias_encontradas}</p>
                      </div>
                    )}
                    {detail.gaps_especificos && (
                      <div>
                        <h5 className="font-semibold text-sm text-foreground mb-1">{t('gapAnalysis.adherenceUi.result.gapsIdentified')}</h5>
                        <p className="text-sm text-muted-foreground">{detail.gaps_especificos}</p>
                      </div>
                    )}
                    {detail.observacoes_ia && (
                      <div>
                        <h5 className="font-semibold text-sm text-foreground mb-1">{t('gapAnalysis.adherenceUi.result.aiObservations')}</h5>
                        <p className="text-sm text-muted-foreground">{detail.observacoes_ia}</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}

      {/* Fora do escopo desta política */}
      {false && foraEscopo && foraEscopo.length > 0 && (
        <Card className="p-6">
          <Accordion type="single" collapsible>
            <AccordionItem value="fora" className="border-none">
              <AccordionTrigger className="py-0">
                <span className="text-base font-semibold text-foreground">{t('gapAnalysis.adherenceUi.verdict.outOfScope', { count: foraEscopo.length })}</span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-3 pt-2">{t('gapAnalysis.adherenceUi.verdict.outOfScopeHint')}</p>
                <ul className="space-y-1.5">
                  {foraEscopo.map((r: any) => (
                    <li key={r.id} className="text-sm text-foreground">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{r.codigo}</span>{r.titulo}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      {frameworkId && (
        <AdherenceAssessmentDialog
          open={novaVersaoOpen}
          onOpenChange={setNovaVersaoOpen}
          onSuccess={() => onApplied?.()}
          preSelectedFrameworkId={frameworkId}
          preSelectedFrameworkNome={assessment.framework_nome ?? undefined}
          versaoAnterior={{ id: assessment.id, nome: assessment.documento_nome ?? '' }}
        />
      )}

      {/* Análise Completa */}
      {!veredito && assessment.analise_detalhada && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">{t('gapAnalysis.adherenceUi.result.fullAnalysisTitle')}</h3>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
            {assessment.analise_detalhada}
          </div>
        </Card>
      )}
    </div>
  );
}
