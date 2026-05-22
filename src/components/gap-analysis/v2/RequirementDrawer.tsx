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
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { StatusSeg } from './StatusSeg';
import { SectionHead } from './SectionHead';
import { AIDiagnosticCard, type AIDiagnosticResult } from './AIDiagnosticCard';

interface RequirementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementId: string | null;
  empresaId: string;
  onSaved?: () => void;
  onOpenFullDialog?: (requirementId: string) => void;
}

interface RequirementCore {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  orientacao_implementacao: string | null;
  framework_id: string;
}

interface EvaluationCore {
  id?: string;
  conformity_status: string | null;
  observacoes: string | null;
  prazo_implementacao: string | null;
}

export function RequirementDrawer({
  open,
  onOpenChange,
  requirementId,
  empresaId,
  onSaved,
  onOpenFullDialog,
}: RequirementDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [requirement, setRequirement] = useState<RequirementCore | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationCore>({
    conformity_status: null, observacoes: '', prazo_implementacao: null,
  });
  const [saving, setSaving] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AIDiagnosticResult | null>(null);

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
            .select('id, codigo, titulo, descricao, categoria, orientacao_implementacao, framework_id')
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
          toast.error('Requisito não encontrado');
          onOpenChange(false);
          return;
        }
        setRequirement(reqRes.data);
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
      toast.success('Avaliação salva');
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      logger.error('Erro ao salvar avaliação no drawer', {
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error('Não foi possível salvar a avaliação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[640px] lg:w-[820px] sm:max-w-[820px] p-0 overflow-hidden flex flex-col bg-background"
      >
        <SheetTitle className="sr-only">Triagem de requisito</SheetTitle>

        {loading || !requirement ? (
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
                    <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                      Triagem rápida
                    </span>
                    {requirement.codigo && (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="font-mono text-xs tabular-nums text-foreground/80">
                          {requirement.codigo}
                        </span>
                      </>
                    )}
                    {requirement.categoria && (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground truncate">
                          {requirement.categoria}
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-foreground leading-snug">
                    {requirement.titulo}
                  </h2>
                </div>
                {onOpenFullDialog && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs shrink-0"
                    onClick={() => onOpenFullDialog(requirement.id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    Edição completa
                  </Button>
                )}
              </div>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Texto oficial / orientação */}
              {(requirement.descricao || requirement.orientacao_implementacao) && (
                <section>
                  <SectionHead title="O QUE A NORMA EXIGE" />
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {requirement.orientacao_implementacao || requirement.descricao}
                  </div>
                </section>
              )}

              {/* Status */}
              <section>
                <SectionHead title="STATUS DE CONFORMIDADE" />
                <StatusSeg
                  value={(evaluation.conformity_status as any) || null}
                  onChange={(v) => setEvaluation(e => ({ ...e, conformity_status: v }))}
                />
              </section>

              {/* Diagnóstico IA */}
              <section>
                <SectionHead
                  title="DIAGNÓSTICO IA"
                  right={
                    !diagnostic && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={diagnosing}
                        onClick={runDiagnostic}
                      >
                        <AkurisAIIcon className="h-3.5 w-3.5 mr-1.5" />
                        {diagnosing ? 'Analisando...' : 'Gerar diagnóstico'}
                      </Button>
                    )
                  }
                />
                {diagnosing && (
                  <div className="flex items-center justify-center py-8 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03]">
                    <AkurisPulse size={36} />
                  </div>
                )}
                {!diagnosing && !diagnostic && (
                  <p className="text-xs text-muted-foreground italic px-1">
                    Clique em "Gerar diagnóstico" para receber a análise da IA com
                    pontos avaliados, gaps e justificativa pronta.
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
                <SectionHead title="JUSTIFICATIVA / OBSERVAÇÕES" />
                <Textarea
                  value={evaluation.observacoes || ''}
                  onChange={(e) => setEvaluation(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Documente a base da avaliação: evidências citadas, lacunas observadas, decisões tomadas..."
                  rows={5}
                  className="resize-y"
                />
              </section>

              {/* Prazo */}
              <section>
                <Label htmlFor="prazo-drawer" className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                  PRAZO DE IMPLEMENTAÇÃO
                </Label>
                <Input
                  id="prazo-drawer"
                  type="date"
                  value={evaluation.prazo_implementacao || ''}
                  onChange={(e) => setEvaluation(prev => ({ ...prev, prazo_implementacao: e.target.value || null }))}
                  className="mt-1.5 max-w-[200px]"
                />
              </section>
            </div>

            {/* Footer */}
            <footer className="border-t border-border bg-card px-6 py-4 shrink-0 flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">
                Edição completa abre o painel detalhado com planos, riscos e evidências.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !evaluation.conformity_status}>
                  {saving ? 'Salvando...' : 'Salvar avaliação'}
                </Button>
              </div>
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
