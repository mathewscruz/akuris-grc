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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserSelect } from '@/components/riscos/UserSelect';
import { DocumentosDoRequisito } from '@/components/gap-analysis/DocumentosDoRequisito';
import { sugerirStatus, contarEvidenciasEsperadas } from '@/lib/gap-analysis/sugerir-status';
import { scopedDraftKey } from '@/hooks/useWizardDraft';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
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
  /** Ordem dos requisitos para navegar anterior/próximo. */
  sequence?: string[];
  onNavigate?: (id: string) => void;
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
  responsavel_avaliacao?: string | null;
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
  sequence,
  onNavigate,
}: RequirementDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [requirement, setRequirement] = useState<RequirementCore | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationCore>({
    conformity_status: null, observacoes: '', prazo_implementacao: null, responsavel_avaliacao: null,
  });
  const { user } = useAuth();
  const qc = useQueryClient();
  const draftKey = requirementId ? scopedDraftKey(empresaId, user?.id, `gap-req-${requirementId}`) : null;
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
            .select('id, conformity_status, observacoes, prazo_implementacao, responsavel_avaliacao')
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
          responsavel_avaliacao: (evalRes.data as any)?.responsavel_avaliacao || null,
        });
        try {
          const rascunho = draftKey ? localStorage.getItem(draftKey) : null;
          if (rascunho) setEvaluation((prev) => ({ ...prev, ...JSON.parse(rascunho) }));
        } catch { /* rascunho inválido é ignorado */ }
      } catch (e) {
        logger.error('Erro ao carregar requisito no drawer', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const precisaJustificativa = (evaluation.conformity_status === 'parcial' || evaluation.conformity_status === 'nao_conforme') && !(evaluation.observacoes || '').trim();
  const idx = sequence && requirementId ? sequence.indexOf(requirementId) : -1;
  const prevId = idx > 0 ? sequence![idx - 1] : null;
  const nextId = idx >= 0 && idx < (sequence!.length - 1) ? sequence![idx + 1] : null;

  const handleSave = async (avancar = false) => {
    if (!requirement || !empresaId || precisaJustificativa) return;
    setSaving(true);
    try {
      const payload = {
        requirement_id: requirement.id,
        framework_id: requirement.framework_id,
        empresa_id: empresaId,
        conformity_status: evaluation.conformity_status,
        observacoes: evaluation.observacoes || null,
        prazo_implementacao: evaluation.prazo_implementacao || null,
        responsavel_avaliacao: evaluation.responsavel_avaliacao || null,
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
      if (draftKey) localStorage.removeItem(draftKey);
      onSaved?.();
      if (avancar && nextId && onNavigate) onNavigate(nextId);
      else onOpenChange(false);
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
        if (evaluation.conformity_status && !saving && !precisaJustificativa) {
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

  // Rascunho por empresa + utilizador enquanto se escreve.
  useEffect(() => {
    if (!open || !draftKey || loading || !requirement) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          conformity_status: evaluation.conformity_status,
          observacoes: evaluation.observacoes,
          prazo_implementacao: evaluation.prazo_implementacao,
          responsavel_avaliacao: evaluation.responsavel_avaliacao,
        }));
      } catch { /* armazenamento cheio: sem rascunho */ }
    }, 600);
    return () => window.clearTimeout(id);
  }, [open, draftKey, loading, requirement, evaluation]);

  const evidenciasQuery = useQuery({
    queryKey: ['requisito-evidencias-count', requirementId, empresaId],
    enabled: open && !!requirementId && !!empresaId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('evidence_library_links')
        .select('id', { count: 'exact', head: true })
        .eq('requirement_id', requirementId!)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const encontradas = evidenciasQuery.data ?? 0;
  const esperadas = contarEvidenciasEsperadas(orientacao.evidencias);
  const sugestao = sugerirStatus({ esperadas, encontradas });
  const statusLabel = (s: string) =>
    s === 'conforme' ? t('gapUi.drawer.shortcutConforme') : t('gapUi.drawer.shortcutParcial');

  const prose = (txt: string) => (
    <div className={`text-sm text-foreground/85 leading-relaxed ${PROSE_CLASS}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{txt}</ReactMarkdown>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-6xl p-0 sm:p-0 gap-0 overflow-hidden flex flex-col h-[100dvh] sm:h-[88vh] bg-popover">
        <DialogTitle className="sr-only">{t('gapUi.drawer.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('gapUi.drawer.whatStandardRequires')}</DialogDescription>

        {loading || !requirement || requirement.id !== requirementId ? (
          <div className="flex-1 flex items-center justify-center"><AkurisPulse size={48} /></div>
        ) : (
          <>
            <header className="relative border-b border-border px-6 py-4 pr-14 shrink-0">
              <CornerAccent position="top-left" size={12} />
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                    {requirement.codigo && (
                      <span className="font-mono tabular-nums rounded-md border border-border px-1.5 py-0.5 text-foreground/80">{requirement.codigo}</span>
                    )}
                    {requirement.categoria && <span className="truncate">{requirement.categoria}</span>}
                  </div>
                  <h2 className="text-base font-semibold text-foreground leading-snug">{requirement.titulo}</h2>
                </div>
                {sequence && idx >= 0 && (
                  <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground tabular-nums">
                    <Button variant="ghost" size="sm" className="h-7 px-2" disabled={!prevId} aria-label={t('gapUi.drawer.previous')} onClick={() => prevId && onNavigate?.(prevId)}>‹</Button>
                    {idx + 1}/{sequence.length}
                    <Button variant="ghost" size="sm" className="h-7 px-2" disabled={!nextId} aria-label={t('gapUi.drawer.next')} onClick={() => nextId && onNavigate?.(nextId)}>›</Button>
                  </div>
                )}
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
              {/* Esquerda: ler */}
              <div className="lg:overflow-y-auto px-6 py-5 space-y-6 lg:border-r border-border">
                {requirement.descricao && (
                  <section>
                    <SectionHead title={t('gapUi.drawer.whatStandardRequires')} />
                    {prose(requirement.descricao)}
                  </section>
                )}

                <section>
                  <SectionHead title={t('gapUi.drawer.comoCumprir')} />
                  <p className="text-micro text-muted-foreground mb-2">{t('gapUi.detail.guidancePlatformIncluded')}</p>
                  {orientacao.estado === 'gerando' && (
                    <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AkurisPulse size={14} />{t('gapUi.drawer.comoCumprirGerando')}
                    </div>
                  )}
                  {orientacao.texto && prose(orientacao.texto)}
                  {orientacao.estado !== 'gerando' && !orientacao.texto && (
                    <div role="status">
                      <p className="text-sm text-muted-foreground">
                        {orientacao.estado === 'falha' ? t('gapUi.detail.guidanceFalhou') : t('gapUi.detail.guidanceIndisponivel')}
                      </p>
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => orientacao.gerar(false)}>
                        {t('gapUi.detail.guidanceTentarDeNovo')}
                      </Button>
                    </div>
                  )}
                </section>

                {orientacao.evidencias && (
                  <section>
                    <SectionHead
                      title={t('gapUi.drawer.expectedEvidence')}
                      right={esperadas > 0 ? <span className="text-xs text-muted-foreground tabular-nums">{Math.min(encontradas, esperadas)}/{esperadas}</span> : undefined}
                    />
                    {prose(orientacao.evidencias)}
                  </section>
                )}

                <section>
                  <SectionHead title={t('gapUi.drawer.linkedEvidence')} />
                  <DocumentosDoRequisito
                    requisitoId={requirement.id}
                    frameworkId={requirement.framework_id}
                    onChanged={() => qc.invalidateQueries({ queryKey: ['requisito-evidencias-count', requirementId, empresaId] })}
                  />
                </section>

                <section className="pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" className="text-xs -ml-2" onClick={abrirEdicaoCompleta}>
                    <IconExternal className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    {t('gapUi.drawer.moreOptions')}
                  </Button>
                </section>
              </div>

              {/* Direita: decidir */}
              <aside className="lg:overflow-y-auto px-6 py-5 space-y-5 border-t lg:border-t-0 border-border">
                <section>
                  <SectionHead title={t('gapUi.drawer.decision')} />
                  <StatusSeg
                    value={(evaluation.conformity_status as any) || null}
                    onChange={(v) => setEvaluation(e => ({ ...e, conformity_status: v }))}
                  />
                </section>

                <section className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {sugestao ? `${t('gapUi.drawer.suggestion')}: ${statusLabel(sugestao)}` : t('gapUi.drawer.suggestion')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sugestao
                          ? t('gapUi.drawer.suggestionBasis', { found: encontradas, expected: Math.max(esperadas, encontradas) })
                          : t('gapUi.drawer.suggestionNone')}
                      </p>
                    </div>
                    {sugestao && evaluation.conformity_status !== sugestao && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => setEvaluation(e => ({ ...e, conformity_status: sugestao }))}>
                        {t('gapUi.drawer.useSuggestion')}
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-primary/15">
                    {diagnosing ? (
                      <div className="flex justify-center py-4"><AkurisPulse size={28} /></div>
                    ) : diagnostic ? (
                      <AIDiagnosticCard
                        result={diagnostic}
                        onApplyStatus={(s) => setEvaluation(e => ({ ...e, conformity_status: s }))}
                        onApplyJustification={(txt) => setEvaluation(e => ({ ...e, observacoes: txt }))}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-micro text-muted-foreground">{t('gapUi.drawer.diagnosticHint')}</p>
                        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={runDiagnostic}>
                          {t('gapUi.drawer.generateDiagnostic')}
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <SectionHead title={t('gapUi.drawer.justificationObservations')} />
                  <Textarea
                    value={evaluation.observacoes || ''}
                    onChange={(e) => setEvaluation(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder={t('gapUi.drawer.observationsPlaceholder')}
                    rows={5}
                    aria-invalid={precisaJustificativa}
                    className={cn('resize-y', precisaJustificativa && 'border-destructive/60')}
                  />
                  {precisaJustificativa && (
                    <p className="text-xs text-destructive mt-1.5">{t('gapUi.drawer.justificationRequired')}</p>
                  )}
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <section>
                    <SectionHead title={t('gapUi.drawer.implementationDeadline')} />
                    <DateField
                      id="prazo-drawer"
                      value={evaluation.prazo_implementacao || null}
                      onChange={(v) => setEvaluation(prev => ({ ...prev, prazo_implementacao: v || null }))}
                      className="mt-1.5"
                    />
                  </section>
                  <section>
                    <SectionHead title={t('gapUi.drawer.owner')} />
                    <div className="mt-1.5">
                      <UserSelect
                        value={evaluation.responsavel_avaliacao || undefined}
                        onValueChange={(v) => setEvaluation(prev => ({ ...prev, responsavel_avaliacao: v || null }))}
                      />
                    </div>
                  </section>
                </div>
              </aside>
            </div>

            <footer className="border-t border-border px-6 py-3 shrink-0 flex items-center justify-between gap-3">
              <span className="text-micro text-muted-foreground hidden md:inline-flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">1–4</kbd>{t('gapUi.drawer.complianceStatus')}
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">⌘↵</kbd>{t('gapUi.drawer.shortcutSave')}
                <span aria-live="polite">· {t('gapUi.drawer.draftSaved')}</span>
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                  {t('gapUi.drawer.cancel')}
                </Button>
                {nextId && onNavigate && (
                  <Button variant="outline" size="sm" onClick={() => handleSave(true)} disabled={saving || !evaluation.conformity_status || precisaJustificativa}>
                    {t('gapUi.drawer.saveAndNext')}
                  </Button>
                )}
                <Button size="sm" onClick={() => handleSave()} disabled={saving || !evaluation.conformity_status || precisaJustificativa}>
                  {saving ? t('gapUi.drawer.saving') : t('gapUi.drawer.saveEvaluation')}
                </Button>
              </div>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
