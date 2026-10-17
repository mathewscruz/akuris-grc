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
import { useAuth } from '@/contexts/AuthContext';
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

__RENDER__
