/**
 * RequirementDrawer — sheet lateral editorial (820px) para triagem rápida de requisito.
 *
 * Inclui: identidade do requisito, StatusSeg, AIDiagnosticCard (sob demanda),
 * justificativa textual, prazo, salvar. Para edição completa (planos de ação,
 * riscos vinculados, evidências, auditoria), o usuário continua usando o
 * RequirementDetailDialog completo, acionado pelo botão "Edição completa".
 *
 * Acionado via RequirementDrawerProvider em qualquer ponto da app.
 */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { IconExternal } from '@/components/icons';
;
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { StatusSeg } from './StatusSeg';
import { SectionHead } from './SectionHead';
import { AIDiagnosticCard, type AIDiagnosticResult } from './AIDiagnosticCard';
import { localizeRequirement } from "@/lib/gap-i18n";
import { useOrientacaoRequisito } from '@/hooks/useOrientacaoRequisito';
import { useLanguage } from '@/contexts/LanguageContext';

interface RequirementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementId: string | null;
  empresaId: string;
  onSaved?: () => void;
}

interface RequirementCore {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  orientacao_implementacao: string | null;
  exemplos_evidencias: string | null;
  framework_id: string;
}

interface EvaluationCore {
  id?: string;
  conformity_status: string | null;
  observacoes: string | null;
  prazo_implementacao: string | null;
}

/** Estilo de prosa para conteúdo em Markdown (orientação da norma, evidências). */
const PROSE_CLASS =
  'prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-headings:text-sm prose-headings:mt-3 prose-headings:mb-1.5 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:text-foreground';

export function RequirementDrawer({
  open,
  onOpenChange,
  requirementId,
  empresaId,
  onSaved,
}: RequirementDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [requirement, setRequirement] = useState<RequirementCore | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationCore>({
    conformity_status: null, observacoes: '', prazo_implementacao: null,
  });
  const [saving, setSaving] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AIDiagnosticResult | null>(null);
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // "Edição completa": fecha a triagem e pede à tabela da página que abra o
  // diálogo do mesmo requisito. Passa pela URL de propósito — o diálogo vive
  // dentro da tabela e este painel é global, portanto não há como lhe entregar
  // uma função sem arrastar propriedades por três telas. Foi o que se tentou
  // antes, com `onOpenFullDialog`: a propriedade existia, ninguém a passava, e
  // o botão nunca chegou a ser desenhado.
  const abrirEdicaoCompleta = useCallback(() => {
    if (!requirementId) return;
    const sp = new URLSearchParams(searchParams);
    sp.set('req', requirementId);
    setSearchParams(sp, { replace: true });
    onOpenChange(false);
  }, [requirementId, searchParams, setSearchParams, onOpenChange]);

  /*
    A mesma orientação do diálogo completo, no caminho principal.

    A gaveta mostrava o que estivesse gravado e nunca pedia. Como 98% dos
    requisitos não têm nada gravado, quem chegava pela fila de prioridades —
    o caminho que o próprio produto recomenda — via só o texto da norma.
  */
  const orientacao = useOrientacaoRequisito(open ? requirementId : null, open);

  useEffect(() => {
    if (!open || !requirementId || !empresaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDiagnostic(null);
      try {
        const [reqRes, evalRes] = await Promise.all([
          supabase
            .from('gap_analysis_requirements')
            .select('id, codigo, titulo, descricao, categoria, orientacao_implementacao, exemplos_evidencias, framework_id, titulo_en, descricao_en, categoria_en, orientacao_implementacao_en, exemplos_evidencias_en')
            .eq('id', requirementId)
            .maybeSingle(),
          supabase
            .from('gap_analysis_evaluations')
            .select('id, conformity_status, observacoes, prazo_implementacao')
            .eq('requirement_id', requirementId)
            .eq('empresa_id', empresaId)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        if (reqRes.error || !reqRes.data) {
          toast.error(t('gapUi.drawer.requirementNotFound'));
          onOpenChange(false);
          return;
        }
        setRequirement(localizeRequirement(reqRes.data as any) as any);
        setEvaluation({
          id: evalRes.data?.id,
          conformity_status: evalRes.data?.conformity_status || null,
          observacoes: evalRes.data?.observacoes || '',
          prazo_implementacao: evalRes.data?.prazo_implementacao || null,
        });
      } catch (e) {
        logger.error('Erro ao carregar requisito no drawer', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, requirementId, empresaId, onOpenChange]);

  const runDiagnostic = useCallback(async () => {
    if (!requirementId) return;
    setDiagnosing(true);
    const { data, error } = await invokeEdgeFunction<AIDiagnosticResult>(
      'gap-analysis-ai-diagnostic',
      { body: { requirementId }, isAiCall: true },
    );
    setDiagnosing(false);
    if (error || !data) return;
    setDiagnostic(data);
  }, [requirementId]);

  const handleSave = async () => {
    if (!requirement || !empresaId) return;
    setSaving(true);
    try {
      const payload = {
        requirement_id: requirement.id,
        framework_id: requirement.framework_id,
        empresa_id: empresaId,
        conformity_status: evaluation.conformity_status,
        observacoes: evaluation.observacoes || null,
        prazo_implementacao: evaluation.prazo_implementacao || null,
      };
      let saveError: any = null;
      if (evaluation.id) {
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .update(payload)
          .eq('id', evaluation.id)
          .eq('empresa_id', empresaId);
        saveError = error;
      } else {
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .insert(payload);
        saveError = error;
      }
      if (saveError) throw saveError;
      toast.success(t('gapUi.drawer.evaluationSaved'));
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      logger.error('Erro ao salvar avaliação no drawer', {
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error(t('gapUi.drawer.errorSaveEvaluation'));
    } finally {
      setSaving(false);
    }
  };

  // Atalhos de teclado dentro do drawer: 1/2/3/4 selecionam status, Cmd/Ctrl+Enter salva.
  // Ignora se o foco está em input/textarea (para não sequestrar digitação).
  useEffect(() => {
    if (!open || !requirement) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      // Cmd/Ctrl+Enter salva mesmo dentro de textarea
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (evaluation.conformity_status && !saving) {
          e.preventDefault();
          handleSave();
        }
        return;
      }
      if (isEditable) return;
      const map: Record<string, string> = {
        '1': 'conforme',
        '2': 'parcial',
        '3': 'nao_conforme',
        '4': 'nao_aplicavel',
      };
      const next = map[e.key];
      if (next) {
        e.preventDefault();
        setEvaluation((prev) => ({ ...prev, conformity_status: next }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirement, evaluation.conformity_status, saving]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[640px] lg:w-[820px] sm:max-w-[820px] p-0 overflow-hidden flex flex-col bg-popover"
      >
        <SheetTitle className="sr-only">{t('gapUi.drawer.title')}</SheetTitle>
        <SheetDescription className="sr-only">
          {t('gapUi.drawer.whatStandardRequires')}
        </SheetDescription>

        {loading || !requirement || requirement.id !== requirementId ? (
          <div className="flex-1 flex items-center justify-center">
            <AkurisPulse size={48} />
          </div>
        ) : (
          <>
            {/* Header editorial */}
            <header className="relative border-b border-border bg-card px-6 py-5 shrink-0">
              <CornerAccent position="top-left" size={12} />
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {t('gapUi.drawer.quickTriage')}
                    </span>
                    {requirement.codigo && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono text-xs tabular-nums text-foreground/80">
                          {requirement.codigo}
                        </span>
                      </>
                    )}
                    {requirement.categoria && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {requirement.categoria}
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-foreground leading-snug">
                    {requirement.titulo}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs shrink-0"
                  onClick={abrirEdicaoCompleta}
                >
                  <IconExternal className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                  {t('gapUi.drawer.fullEdit')}
                </Button>
              </div>
            </header>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
              {/* O que a norma exige — sempre o texto da própria norma, e nada mais. */}
              {requirement.descricao && (
                <section>
                  <SectionHead title={t('gapUi.drawer.whatStandardRequires')} />
                  <div className={`rounded-lg border border-border bg-card p-4 text-sm text-foreground/85 leading-relaxed ${PROSE_CLASS}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {requirement.descricao}
                    </ReactMarkdown>
                  </div>
                </section>
              )}

              {/*
                  A decisão que a pessoa veio tomar fica antes do material de
                  consulta. A orientação pode ter várias páginas; deixá-la
                  antes do status obrigava o utilizador a atravessar todo o
                  texto para encontrar a ação principal da triagem.
              */}
              <section>
                <SectionHead title={t('gapUi.drawer.complianceStatus')} />
                <StatusSeg
                  value={(evaluation.conformity_status as any) || null}
                  onChange={(v) => setEvaluation(e => ({ ...e, conformity_status: v }))}
                />
              </section>

              {/*
                  Como cumprir — secção própria, separada da norma.

                  Antes, a orientação e o texto da norma partilhavam a mesma
                  caixa com o mesmo rótulo: não havendo orientação, a frase da
                  norma era servida como se fosse a instrução. São coisas
                  diferentes e passam a ocupar lugares diferentes.
              */}
              <section>
                <SectionHead title={t('gapUi.drawer.comoCumprir')} />
                <p className="text-micro text-muted-foreground">{t('experience.guidanceIncluded')}</p>
                {orientacao.estado === 'gerando' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    <AkurisPulse size={14} />
                    {t('gapUi.drawer.comoCumprirGerando')}
                  </div>
                ) : orientacao.texto ? (
                  <div className={`rounded-lg border border-border bg-card p-4 text-sm text-foreground/85 leading-relaxed ${PROSE_CLASS}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {orientacao.texto}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {orientacao.estado === 'falha' ? t('gapUi.detail.guidanceFalhou') : t('gapUi.detail.guidanceIndisponivel')}
                    </p>
                    {
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 h-7 text-xs"
                        onClick={() => orientacao.gerar(false)}
                      >
                        {t('gapUi.detail.guidanceTentarDeNovo')}
                      </Button>
                    }
                  </div>
                )}
              </section>

              {/* Evidências esperadas — que prova o auditor aceita para este requisito. */}
              {orientacao.evidencias && (
                <section>
                  <SectionHead title={t('gapUi.drawer.expectedEvidence')} />
                  <div className={`rounded-lg border border-border bg-card p-4 text-sm text-foreground/85 leading-relaxed ${PROSE_CLASS}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {orientacao.evidencias}
                    </ReactMarkdown>
                  </div>
                </section>
              )}

              {/* Diagnóstico IA */}
              <section>
                <SectionHead
                  title={t('gapUi.drawer.aiDiagnostic')}
                  right={
                    !diagnostic && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={diagnosing}
                        onClick={runDiagnostic}
                      >
                        {diagnosing ? t('gapUi.drawer.analyzing') : t('gapUi.drawer.generateDiagnostic')}
                      </Button>
                    )
                  }
                />
                {diagnosing && (
                  <div className="flex items-center justify-center py-8 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03]">
                    <AkurisPulse size={36} />
                  </div>
                )}
                {!diagnosing && (
                  <p className="text-xs text-muted-foreground italic px-1">
                    {t('gapUi.drawer.diagnosticHint')}
                  </p>
                )}
                {diagnostic && (
                  <AIDiagnosticCard
                    result={diagnostic}
                    onApplyStatus={(s) => setEvaluation(e => ({ ...e, conformity_status: s }))}
                    onApplyJustification={(t) => setEvaluation(e => ({ ...e, observacoes: t }))}
                  />
                )}
              </section>

              {/* Justificativa */}
              <section>
                <SectionHead title={t('gapUi.drawer.justificationObservations')} />
                <Textarea
                  value={evaluation.observacoes || ''}
                  onChange={(e) => setEvaluation(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder={t('gapUi.drawer.observationsPlaceholder')}
                  rows={5}
                  className="resize-y"
                />
              </section>

              {/* Prazo — só aparece para o que precisa ser implementado */}
              {(evaluation.conformity_status === 'nao_conforme' || evaluation.conformity_status === 'parcial') && (
                <section>
                  <SectionHead title={t('gapUi.drawer.implementationDeadline')} />
                  <DateField
                    id="prazo-drawer"
                    value={evaluation.prazo_implementacao || null}
                    onChange={(v) => setEvaluation(prev => ({ ...prev, prazo_implementacao: v || null }))}
                    className="mt-1.5 max-w-[200px]"
                  />
                </section>
              )}
            </div>

            {/* Footer */}
            <footer className="border-t border-border px-6 py-4 shrink-0 flex items-center justify-between gap-3">
              <span className="text-micro text-muted-foreground hidden sm:inline-flex items-center gap-2">
                {t('gapUi.drawer.shortcuts')}
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">1</kbd>{t('gapUi.drawer.shortcutConforme')}
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">2</kbd>{t('gapUi.drawer.shortcutParcial')}
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">3</kbd>{t('gapUi.drawer.shortcutNaoConforme')}
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">4</kbd>{t('gapUi.status.na')}
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">⌘↵</kbd>{t('gapUi.drawer.shortcutSave')}
              </span>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                  {t('gapUi.drawer.cancel')}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !evaluation.conformity_status}>
                  {saving ? t('gapUi.drawer.saving') : t('gapUi.drawer.saveEvaluation')}
                </Button>
              </div>
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
