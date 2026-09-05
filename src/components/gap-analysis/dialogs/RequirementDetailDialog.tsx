import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType } from "react";
import { IconClose, IconUpload, IconExternal, IconCheck, IconSuccess, IconWarning, IconCalendar, IconRefresh, IconFile, IconIdea, IconChecklist, IconChevronDown, IconHistory, IconBook, IconHelp, IconOrg, IconSettings, IconFileCheck, IconCheckbox, IconShield, IconTarget, GapAnalysisIcon } from '@/components/icons';
import DOMPurify from 'dompurify';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConformitySelect } from '../ConformitySelect';
import './requirement-workspace.css';
import { implementationExcerpt } from '@/lib/requirement-guidance-summary';
// (Skeleton removido — substituído por AkurisPulse)
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateForInput, parseDateForDB } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveControleStatusTone } from "@/lib/status-tone";
import { useRequisitoControles } from "@/hooks/useControleRequisitos";
import { PlanoAcaoDialog } from "@/components/planos-acao/PlanoAcaoDialog";
import { AuditTrailTimeline } from "@/components/gap-analysis/AuditTrailTimeline";
import { useOrientacaoRequisito, type PerguntaDiagnostico } from '@/hooks/useOrientacaoRequisito';
import { DocumentosDoRequisito } from '../DocumentosDoRequisito';
import { logger } from '@/lib/logger';
import { useDocGen } from '@/contexts/DocGenContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ConformityStatus } from "@/lib/gap-analysis-tokens";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EvidenceReusePanel } from '@/components/gap-analysis/dialogs/EvidenceReusePanel';
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
import { exigirEscrita } from '@/lib/supabase-write';
import { getRequirementCompletionCriteria, type RequirementCompletionKey } from '@/lib/gap-requirement-completion';
interface RequirementDetail {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  area_responsavel: string | null;
  peso: number;
  conformity_status?: string | null;
  evaluation_id?: string | null;
  orientacao_implementacao?: string | null;
  exemplos_evidencias?: string | null;
  obrigatorio?: boolean | null;
}

interface RequirementDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: RequirementDetail;
  frameworkId: string;
  onClose: () => void;
  /** Callback opcional disparado quando o status muda inline para a tabela atualizar sem refetch full. */
  onStatusChange?: (requirementId: string, newStatus: ConformityStatus) => void;
}

interface User { user_id: string; nome: string; email: string; }
interface Risco { id: string; nome: string; nivel_risco_inicial: string; nivel_risco_residual?: string | null; }
interface EvaluationData {
  id?: string;
  responsavel_avaliacao: string;
  plano_acao: string;
  observacoes: string;
  prazo_implementacao: string;
  riscos_vinculados: string[];
  evidence_files: any[];
  plano_acao_id?: string | null;
}

const emptyEvaluationData = (): EvaluationData => ({
  responsavel_avaliacao: '',
  plano_acao: '',
  observacoes: '',
  prazo_implementacao: '',
  riscos_vinculados: [],
  evidence_files: [],
  plano_acao_id: null,
});

// ---------------------------------------------------------------------------
// Rótulos para confirmar a atualização de conformity_status
// ---------------------------------------------------------------------------
const getStatusOptions = (t: (key: string) => string): Array<{ value: ConformityStatus; label: string }> => [
  { value: 'nao_avaliado', label: t('gapUi.status.naoAvaliado') },
  { value: 'conforme', label: t('gapUi.status.conforme') },
  { value: 'parcial', label: t('gapUi.status.parcial') },
  { value: 'nao_conforme', label: t('gapUi.status.naoConforme') },
  { value: 'nao_aplicavel', label: t('gapUi.status.na') },
];

// ---------------------------------------------------------------------------
// Journey Step — passo numerado da jornada de avaliação
// ---------------------------------------------------------------------------
type StepState = 'complete' | 'active' | 'pending';

const JourneyStep: React.FC<{
  number?: number;
  id?: string;
  title: string;
  description?: string;
  state: StepState;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
}> = ({ number, id, title, description, state, badge, defaultOpen = true, collapsible = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const numberClass =
    state === 'complete' ? 'bg-success text-success-foreground border-success' :
    state === 'active' ? 'bg-primary text-primary-foreground border-primary' :
    'bg-muted text-muted-foreground border-border';

  const headerContent = (
    <div className="flex items-start gap-3 w-full">
      {number !== undefined && <div aria-hidden="true" className={cn('flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold shrink-0 mt-0.5', numberClass)}>
        {state === 'complete' ? <IconCheck className="h-3.5 w-3.5" strokeWidth={2.5} /> : number}
      </div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {description && <p className="text-micro text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {collapsible && (
        <IconChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform mt-1', open ? 'rotate-180' : '')} strokeWidth={1.5} />
      )}
    </div>
  );

  return (
    <section id={id} tabIndex={-1} className="min-w-0 scroll-mt-4 rounded-lg border bg-popover overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {collapsible ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full text-left p-3 hover:bg-accent transition-colors">
              {headerContent}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={cn("px-4 pb-4 pt-1", number !== undefined && "sm:ml-8")}>{children}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="p-3">{headerContent}</div>
          <div className={cn("px-4 pb-4", number !== undefined && "sm:ml-8")}>{children}</div>
        </>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Markdown helpers (orientação da IA)
// ---------------------------------------------------------------------------

/** Icon mapping for section titles based on keywords */
const getSectionIcon = (title: string): { icon: ComponentType<any>; color: string } => {
  const t = title.toLowerCase();
  if (t.includes('significa') || t.includes('conceito') || t.includes('what')) return { icon: IconTarget, color: 'text-primary' };
  if (t.includes('importa') || t.includes('relevância') || t.includes('why') || t.includes('negócio')) return { icon: IconOrg, color: 'text-warning' };
  if (t.includes('implementar') || t.includes('como') || t.includes('how') || t.includes('passo')) return { icon: IconSettings, color: 'text-info' };
  if (t.includes('resumo') || t.includes('conclus') || t.includes('prático') || t.includes('summary')) return { icon: IconCheckbox, color: 'text-success' };
  if (t.includes('evidência') || t.includes('comprova') || t.includes('evidence') || t.includes('documento')) return { icon: IconFileCheck, color: 'text-primary' };
  if (t.includes('risco') || t.includes('atenção') || t.includes('risk') || t.includes('cuidado')) return { icon: IconWarning, color: 'text-destructive' };
  if (t.includes('controle') || t.includes('medida') || t.includes('proteção')) return { icon: IconShield, color: 'text-info' };
  return { icon: IconBook, color: 'text-muted-foreground' };
};

const inlineMd = (text: string): string => {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong', 'em', 'br', 'span'], ALLOWED_ATTR: ['class'] });
};

/** Renders a list of lines into JSX elements (paragraphs, bullets, numbered lists) */
const renderContentLines = (lines: string[]): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    if (isNumberedList) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1.5 ml-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground leading-7">
              <span dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
            </li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1.5 ml-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-7">
              <span className="text-primary mt-2 text-micro">●</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
            </li>
          ))}
        </ul>
      );
    }
    listItems = [];
    isNumberedList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed === '---') { flushList(); continue; }

    const h3Match = trimmed.match(/^###\s+(.+)/);
    if (h3Match) {
      flushList();
      elements.push(
        <h4 key={`h3-${i}`} className="text-sm font-semibold text-foreground mt-3 mb-1.5">{h3Match[1]}</h4>
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
    if (bulletMatch) {
      if (listItems.length > 0 && isNumberedList) flushList();
      isNumberedList = false;
      listItems.push(bulletMatch[1]);
      continue;
    }

    const numMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numMatch) {
      if (listItems.length > 0 && !isNumberedList) flushList();
      isNumberedList = true;
      listItems.push(numMatch[1]);
      continue;
    }

    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-sm text-muted-foreground leading-7" dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />
    );
  }
  flushList();
  return elements;
};

/** Strips AI preamble lines (e.g. "Com certeza! Aqui está...") before the first ## */
const sanitizeGuidanceContent = (raw: string): string => {
  const firstHeaderIdx = raw.indexOf('\n##');
  if (firstHeaderIdx === -1) {
    if (raw.trimStart().startsWith('##')) return raw;
    return raw;
  }
  const preamble = raw.substring(0, firstHeaderIdx).trim();
  if (preamble && !preamble.includes('##') && preamble.length < 300) {
    return raw.substring(firstHeaderIdx + 1);
  }
  return raw;
};

const MarkdownContent = ({ content }: { content: string }) => {
  const sanitized = sanitizeGuidanceContent(content);
  const lines = sanitized.split('\n');

  const sections: Array<{ title: string | null; lines: string[] }> = [];
  let current: { title: string | null; lines: string[] } = { title: null, lines: [] };

  for (const line of lines) {
    const h2Match = line.trim().match(/^##\s+(.+)/);
    if (h2Match) {
      if (current.lines.length > 0 || current.title) sections.push(current);
      current = { title: h2Match[1].replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, ''), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0 || current.title) sections.push(current);

  return (
    <div className="space-y-5">
      {sections.map((section, idx) => {
        if (!section.title) {
          const contentElements = renderContentLines(section.lines);
          if (contentElements.length === 0) return null;
          return (
            <div key={idx} className="text-sm text-foreground/80 italic leading-7 space-y-2">
              {contentElements}
            </div>
          );
        }

        const { icon: SectionIcon, color } = getSectionIcon(section.title);
        return (
          <section key={idx} className="space-y-2 border-b border-border/60 pb-5 last:border-0 last:pb-0">
            <div className="flex items-center gap-2.5">
              <div className={cn('flex shrink-0 items-center justify-center', color)}>
                <SectionIcon className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            </div>
            <div className="space-y-2 break-words">
              {renderContentLines(section.lines)}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const GuidanceSkeleton = () => {
  const { t } = useLanguage();
  return (
  <div className="min-h-[180px] flex flex-col items-center justify-center gap-2 py-6">
    <AkurisPulse size={48} />
    <p className="text-xs text-muted-foreground">{t('gapUi.detail.loadingGuidance')}</p>
  </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const RequirementDetailDialog: React.FC<RequirementDetailDialogProps> = ({
  open, onOpenChange, requirement, frameworkId, onClose, onStatusChange
}) => {
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const STATUS_OPTIONS = getStatusOptions(t);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const { data: controlosPorRequisito } = useRequisitoControles();
  const controlosLigados = controlosPorRequisito?.get(requirement?.id) || [];
  const [uploading, setUploading] = useState(false);
  const [planoAcaoDialogOpen, setPlanoAcaoDialogOpen] = useState(false);
  const [planoAcaoVinculado, setPlanoAcaoVinculado] = useState<any>(null);
  // Concorrência otimista: guarda o updated_at carregado para detectar sobrescrita.
  const loadedUpdatedAtRef = useRef<string | null>(null);
  const [savingPlano, setSavingPlano] = useState(false);
  /*
    Uma conta só para a orientação.

    Estes cinco estados e a função de geração existiam aqui e não existiam na
    gaveta lateral — que é para onde a fila de prioridades manda o utilizador.
    Duas superfícies para o mesmo requisito, uma com orientação e outra sem.
    `useOrientacaoRequisito` é agora o único sítio onde isto se decide.
  */
  const orientacao = useOrientacaoRequisito(open ? requirement.id : null, open);
  const guidanceText = orientacao.texto;
  const implementationText = implementationExcerpt(guidanceText || requirement.orientacao_implementacao);
  const evidenciasText = orientacao.evidencias;
  const diagnosticQuestions = orientacao.perguntas;
  const generatingGuidance = orientacao.estado === 'gerando';
  const guidanceErro = orientacao.estado === 'falha' ? 'falha' : null;
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const workspaceSteps = ['understand', 'evaluate', 'prove', 'review'] as const;
  useEffect(() => { if (open) { setActiveStep(0); setGuidanceOpen(false); } }, [open, requirement.id]);
  const requirementBody = useRef<HTMLDivElement>(null);
  const goToSection = (id: string) => {
    const index = id === 'requirement-guidance' ? 0 : id === 'requirement-diagnosis' ? 1 : id === 'requirement-evidence' ? 2 : 3;
    setActiveStep(index);
    requestAnimationFrame(() => {
      const section = requirementBody.current?.querySelector<HTMLElement>('#' + id);
      section?.scrollIntoView({ behavior: 'instant', block: 'start' });
      section?.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    if (!open || loading) return;
    requirementBody.current?.scrollTo({ top: 0 });
    requirementBody.current?.querySelector<HTMLElement>('#requirement-panel-' + activeStep)?.focus({ preventScroll: true });
  }, [activeStep, open, loading]);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<number, 'sim' | 'parcial' | 'nao' | null>>({});
  const { openDocGen } = useDocGen();
  const [validatingUrl, setValidatingUrl] = useState<string | null>(null);
  const [validationByUrl, setValidationByUrl] = useState<Record<string, {
    verdict: 'conforme' | 'parcial' | 'nao_conforme' | 'indeterminado';
    score: number;
    justification: string;
    missing?: string[];
  }>>({});
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null | undefined>(requirement.conformity_status);
  const [linkedEvidenceCount, setLinkedEvidenceCount] = useState(0);

  const [formData, setFormData] = useState<EvaluationData>(emptyEvaluationData);
  const savedDraftRef = useRef<string | null>(null);
  // An ID created by an inline status save is not an unsaved draft edit.
  const draftSnapshot = JSON.stringify({ formData: { ...formData, id: undefined }, diagnosticAnswers });
  useEffect(() => {
    if (loading) savedDraftRef.current = null;
    else if (savedDraftRef.current === null) savedDraftRef.current = draftSnapshot;
  }, [loading, draftSnapshot]);
  const isDirty = !loading && savedDraftRef.current !== null && savedDraftRef.current !== draftSnapshot;

  const fallbackDiagnosticQuestions = useMemo<PerguntaDiagnostico[]>(() => [
    { pergunta: t('gapUi.detail.fallbackDiagnostic.q1'), peso: 3 },
    { pergunta: t('gapUi.detail.fallbackDiagnostic.q2'), peso: 3 },
    { pergunta: t('gapUi.detail.fallbackDiagnostic.q3'), peso: 2 },
    { pergunta: t('gapUi.detail.fallbackDiagnostic.q4'), peso: 3 },
  ], [t]);
  const usesFallbackDiagnostic = diagnosticQuestions.length === 0;
  const effectiveDiagnosticQuestions = usesFallbackDiagnostic
    ? fallbackDiagnosticQuestions
    : diagnosticQuestions;

  const loadLinkedEvidenceCount = useCallback(async () => {
    if (!empresaId) return;
    const { count, error } = await supabase
      .from('evidence_library_links')
      .select('id', { count: 'exact', head: true })
      .eq('requirement_id', requirement.id)
      .eq('empresa_id', empresaId);
    if (error) throw error;
    setLinkedEvidenceCount(count ?? 0);
  }, [empresaId, requirement.id]);

  useEffect(() => {
    setCurrentStatus(requirement.conformity_status);
  }, [requirement.conformity_status, requirement.id]);

  useEffect(() => {
    if (open && empresaId) loadData();
  }, [open, empresaId, requirement.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, riscosRes, evidenceLinksRes] = await Promise.all([
        supabase.from('profiles').select('user_id, nome, email').eq('empresa_id', empresaId).order('nome'),
        supabase.from('riscos').select('id, nome, nivel_risco_inicial, nivel_risco_residual').eq('empresa_id', empresaId).order('nome'),
        supabase.from('evidence_library_links').select('id', { count: 'exact', head: true })
          .eq('requirement_id', requirement.id).eq('empresa_id', empresaId),
      ]);
      if (usersRes.error) throw usersRes.error;
      if (riscosRes.error) throw riscosRes.error;
      if (evidenceLinksRes.error) throw evidenceLinksRes.error;
      setUsers(usersRes.data || []);
      setRiscos(riscosRes.data || []);
      setLinkedEvidenceCount(evidenceLinksRes.count ?? 0);

      setDiagnosticAnswers({});

      if (requirement.evaluation_id) {
        const { data: evalData, error: evalError } = await supabase
          .from('gap_analysis_evaluations').select('*').eq('id', requirement.evaluation_id).single();
        if (evalError) throw evalError;

        const { data: linkedRiscos } = await supabase
          .from('gap_evaluation_risks').select('risco_id').eq('evaluation_id', requirement.evaluation_id);

        if (evalData.plano_acao_id) {
          const { data: planoData } = await supabase
            .from('planos_acao').select('id, titulo, status, prioridade, prazo').eq('id', evalData.plano_acao_id).single();
          setPlanoAcaoVinculado(planoData);
        } else {
          setPlanoAcaoVinculado(null);
        }

        if (evalData.diagnostic_answers && typeof evalData.diagnostic_answers === 'object') {
          setDiagnosticAnswers(evalData.diagnostic_answers as Record<number, 'sim' | 'parcial' | 'nao' | null>);
        }

        setFormData({
          id: evalData.id, responsavel_avaliacao: evalData.responsavel_avaliacao || '',
          plano_acao: evalData.plano_acao || '', observacoes: evalData.observacoes || '',
          prazo_implementacao: evalData.prazo_implementacao ? formatDateForInput(evalData.prazo_implementacao) : '',
          riscos_vinculados: linkedRiscos?.map(r => r.risco_id) || [],
          evidence_files: Array.isArray(evalData.evidence_files) ? evalData.evidence_files : [],
          plano_acao_id: evalData.plano_acao_id || null
        });
        loadedUpdatedAtRef.current = (evalData as any).updated_at || null;
      } else {
        setPlanoAcaoVinculado(null);
        setFormData(emptyEvaluationData());
        loadedUpdatedAtRef.current = null;
      }
    } catch (error: any) {
      logger.error('Error loading data:', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapUi.detail.errorLoadData'));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Persistência inline do status (Akuris: sempre filtrar por empresa_id)
  // -------------------------------------------------------------------------
  const handleStatusChange = async (newStatus: ConformityStatus) => {
    if (!empresaId) return;
    const previous = currentStatus;
    setCurrentStatus(newStatus);
    setSavingStatus(true);
    try {
      const evaluationId = formData.id || requirement.evaluation_id;
      if (evaluationId) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .update({ conformity_status: newStatus, updated_at: nowIso })
          .eq('id', evaluationId)
          .eq('empresa_id', empresaId);
        if (error) throw error;
        loadedUpdatedAtRef.current = nowIso;
      } else {
        const { data: newEval, error } = await supabase
          .from('gap_analysis_evaluations')
          .insert({
            framework_id: frameworkId,
            requirement_id: requirement.id,
            empresa_id: empresaId,
            conformity_status: newStatus,
            evidence_status: 'pendente',
          })
          .select()
          .single();
        if (error) throw error;
        setFormData(prev => ({ ...prev, id: newEval.id }));
        loadedUpdatedAtRef.current = (newEval as any).updated_at || null;
      }
      onStatusChange?.(requirement.id, newStatus);
      const label = STATUS_OPTIONS.find(o => o.value === newStatus)?.label ?? newStatus;
      toast.success(t('gapUi.detail.statusUpdatedTo', { label }));
    } catch (error: any) {
      logger.error('Error updating status:', { error: error instanceof Error ? error.message : String(error) });
      setCurrentStatus(previous);
      toast.error(t('gapUi.detail.errorUpdateStatus'));
    } finally {
      setSavingStatus(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const MAX_BYTES = 25 * 1024 * 1024; // 25MB por arquivo
    const ALLOWED = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'text/markdown',
      'image/png', 'image/jpeg', 'image/webp',
    ]);

    const oversize = Array.from(files).find(f => f.size > MAX_BYTES);
    if (oversize) {
      toast.error(t('gapUi.detail.fileTooLarge', { name: oversize.name }));
      event.target.value = '';
      return;
    }
    const invalidType = Array.from(files).find(f => f.type && !ALLOWED.has(f.type));
    if (invalidType) {
      toast.error(t('gapUi.detail.fileTypeNotAllowed', { type: invalidType.type || invalidType.name }));
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploadedFiles = [];
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        // Path must start with empresa_id to satisfy storage RLS policy
        const filePath = `${empresaId}/gap-analysis/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('documentos').upload(filePath, file);
        if (uploadError) throw uploadError;
        // Bucket privado — armazenamos apenas o path; URL assinada é gerada sob demanda
        uploadedFiles.push({ name: file.name, path: filePath, url: filePath, size: file.size, type: file.type });
      }
      setFormData(prev => ({ ...prev, evidence_files: [...prev.evidence_files, ...uploadedFiles] }));
      toast.success(t('gapUi.detail.filesAttached', { count: uploadedFiles.length }));
    } catch (error: any) {
      logger.error('Error uploading files:', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapUi.detail.errorUpload'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({ ...prev, evidence_files: prev.evidence_files.filter((_, i) => i !== index) }));
  };

  const handleValidateEvidence = async (file: any) => {
    if (!empresaId || !file?.url) return;
    setValidatingUrl(file.url);
    try {
      // Se for arquivo no bucket (não link externo), gera URL assinada temporária
      let fileUrl: string = file.url;
      if (file.type !== 'link') {
        const path = file.path || file.url;
        const { data: signed, error: signErr } = await supabase.storage
          .from('documentos').createSignedUrl(path, 300);
        if (signErr || !signed?.signedUrl) throw signErr || new Error('Signed URL failed');
        fileUrl = signed.signedUrl;
      }
      const { data, error } = await supabase.functions.invoke('analyze-evidence-against-requirement', {
        body: {
          requirementId: requirement.id,
          fileUrl,
          fileName: file.name,
          empresaId,
        },
      });
      if (error) {
        const status = (error as any)?.status;
        if (status === 402 || (data as any)?.creditsExhausted) {
          toast.error(t('gapUi.detail.aiCreditsExhaustedShort'));
          return;
        }
        throw error;
      }
      if ((data as any)?.error) {
        toast.error((data as any).error);
        return;
      }
      setValidationByUrl(prev => ({ ...prev, [file.url]: data as any }));
      const v = (data as any).verdict;
      const label = v === 'conforme' ? t('gapUi.verdict.conforme') : v === 'parcial' ? t('gapUi.verdict.parcialmenteConforme') : v === 'nao_conforme' ? t('gapUi.verdict.naoConforme') : t('gapUi.verdict.indeterminado');
      toast.success(t('gapUi.detail.aiVerdict', { label, score: (data as any).score ?? 0 }));
    } catch (e) {
      logger.error('Validation error', { error: e instanceof Error ? e.message : String(e) });
      toast.error(t('gapUi.detail.errorValidateEvidence'));
    } finally {
      setValidatingUrl(null);
    }
  };

  const handleToggleRisco = (riscoId: string) => {
    setFormData(prev => ({
      ...prev,
      riscos_vinculados: prev.riscos_vinculados.includes(riscoId)
        ? prev.riscos_vinculados.filter(id => id !== riscoId)
        : [...prev.riscos_vinculados, riscoId]
    }));
  };

  const handleSave = async () => {
    if (loading || saving || savingStatus || uploading || !empresaId) return;
    setSaving(true);
    try {
      let evaluationId = formData.id || requirement.evaluation_id;
      if (evaluationId) {
        // Concorrência otimista: rejeita a gravação se outro usuário alterou
        // a avaliação depois que abrimos o diálogo. Evita sobrescrita silenciosa.
        if (loadedUpdatedAtRef.current) {
          const { data: current } = await supabase
            .from('gap_analysis_evaluations')
            .select('updated_at')
            .eq('id', evaluationId)
            .eq('empresa_id', empresaId)
            .maybeSingle();
          const currentUpdatedAt = (current as any)?.updated_at as string | undefined;
          if (currentUpdatedAt && currentUpdatedAt !== loadedUpdatedAtRef.current) {
            toast.error(t('gapUi.detail.concurrencyConflict'));
            setSaving(false);
            return;
          }
        }
        const nowIso = new Date().toISOString();
        const { error } = await supabase.from('gap_analysis_evaluations').update({
          responsavel_avaliacao: formData.responsavel_avaliacao || null,
          plano_acao: formData.plano_acao || null, observacoes: formData.observacoes || null,
          prazo_implementacao: formData.prazo_implementacao ? parseDateForDB(formData.prazo_implementacao) : null,
          evidence_files: formData.evidence_files, plano_acao_id: formData.plano_acao_id || null,
          diagnostic_answers: Object.keys(diagnosticAnswers).length > 0 ? diagnosticAnswers : null,
          updated_at: nowIso
        }).eq('id', evaluationId).eq('empresa_id', empresaId);
        if (error) throw error;
        loadedUpdatedAtRef.current = nowIso;
      } else {
        const { data: newEval, error } = await supabase.from('gap_analysis_evaluations').insert({
          framework_id: frameworkId, requirement_id: requirement.id, empresa_id: empresaId,
          responsavel_avaliacao: formData.responsavel_avaliacao || null,
          plano_acao: formData.plano_acao || null, observacoes: formData.observacoes || null,
          prazo_implementacao: formData.prazo_implementacao ? parseDateForDB(formData.prazo_implementacao) : null,
          evidence_files: formData.evidence_files, plano_acao_id: formData.plano_acao_id || null,
          diagnostic_answers: Object.keys(diagnosticAnswers).length > 0 ? diagnosticAnswers : null,
          conformity_status: currentStatus || 'nao_avaliado',
          evidence_status: 'pendente'

        }).select().single();
        if (error) throw error;
        evaluationId = newEval.id;
      }

      await exigirEscrita(supabase.from('gap_evaluation_risks').delete().eq('evaluation_id', evaluationId));
      if (formData.riscos_vinculados.length > 0) {
        const { error } = await supabase.from('gap_evaluation_risks')
          .insert(formData.riscos_vinculados.map(riscoId => ({ evaluation_id: evaluationId, risco_id: riscoId })));
        if (error) throw error;
      }
      toast.success(t('gapUi.detail.evaluationSaved'));
      onClose();
    } catch (error: any) {
      logger.error('Error saving:', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapUi.detail.errorSaveEvaluation'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlanoAcao = async (planoData: any) => {
    setSavingPlano(true);
    try {
      /*
        O plano tem de saber de QUAL requisito nasceu, nao so que veio de
        frameworks. Faltava `registro_origem_id`: gravava-se o titulo em texto
        e o identificador perdia-se, por isso o botao «abrir no modulo» do
        plano nao tinha para onde ir. Era o unico dos tres campos de
        rastreabilidade que ficava por preencher -- so 1 de 18 planos na base
        tinha o id do registo, e esse veio das Auditorias, que fazem certo.
      */
      const { data: newPlano, error } = await supabase.from('planos_acao').insert({
        ...planoData, empresa_id: empresaId, modulo_origem: 'frameworks',
        registro_origem_id: requirement.id,
        registro_origem_titulo: `${requirement.codigo} - ${requirement.titulo}`,
      }).select().single();
      if (error) throw error;
      setFormData(prev => ({ ...prev, plano_acao_id: newPlano.id }));
      setPlanoAcaoVinculado(newPlano);
      setPlanoAcaoDialogOpen(false);
      toast.success(t('gapUi.detail.planoCreated'));
    } catch (error: any) {
      logger.error('Error creating plano:', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapUi.detail.errorCreatePlano'));
    } finally {
      setSavingPlano(false);
    }
  };

  const getPlanoStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
      concluido: { label: t('gapUi.detail.planoStatus.concluido'), variant: 'success' },
      em_andamento: { label: t('gapUi.detail.planoStatus.emAndamento'), variant: 'warning' },
      pendente: { label: t('gapUi.detail.planoStatus.pendente'), variant: 'destructive' },
      cancelado: { label: t('gapUi.detail.planoStatus.cancelado'), variant: 'outline' },
    };
    const s = map[status] || { label: formatStatus(status), variant: 'outline' as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  // -------------------------------------------------------------------------
  // Estado da jornada (cada step)
  // -------------------------------------------------------------------------
  const isStatusDefined = !!currentStatus && currentStatus !== 'nao_avaliado' && currentStatus !== 'pendente';
  const isNonCompliant = currentStatus === 'nao_conforme' || currentStatus === 'parcial';
  const requiresPlanoStep = isNonCompliant;
  const planoStepDone = !!planoAcaoVinculado;
  const evidenciasCount = formData.evidence_files.length + linkedEvidenceCount;
  const detalhesDone = !!formData.responsavel_avaliacao && !!formData.prazo_implementacao;
  const diagnosticAnswered = effectiveDiagnosticQuestions.filter((_, index) => !!diagnosticAnswers[index]).length;
  const diagnosticDone = diagnosticAnswered === effectiveDiagnosticQuestions.length;
  const completionCriteria = getRequirementCompletionCriteria({
    diagnosticAnswered,
    diagnosticTotal: effectiveDiagnosticQuestions.length,
    status: currentStatus,
    evidenceCount: evidenciasCount,
    hasPlan: planoStepDone,
    hasOwner: !!formData.responsavel_avaliacao,
    hasDeadline: !!formData.prazo_implementacao,
    hasJustification: formData.observacoes.trim().length > 0,
  });
  const completionDone = completionCriteria.filter((criterion) => criterion.done).length;
  const allCompletionDone = completionDone === completionCriteria.length;
  const completionProgress = Math.round((completionDone / completionCriteria.length) * 100);
  const completionLabels: Record<RequirementCompletionKey, string> = {
    diagnostic: t('gapUi.detail.completion.diagnostic'),
    status: t('gapUi.detail.completion.status'),
    evidence: t('gapUi.detail.completion.evidence'),
    plan: t('gapUi.detail.completion.plan'),
    ownerDeadline: t('gapUi.detail.completion.ownerDeadline'),
    justification: t('gapUi.detail.completion.justification'),
  };

  const completionSections: Record<RequirementCompletionKey, string> = {
    diagnostic: 'requirement-diagnosis', status: 'requirement-diagnosis',
    evidence: 'requirement-evidence', plan: 'requirement-plan',
    ownerDeadline: 'requirement-details', justification: 'requirement-details',
  };
  const nextCriterion = completionCriteria.find(criterion => !criterion.done);

  // CTA contextual no footer
  const footerLabel = useMemo(() => {
    if (saving) return t('gapUi.detail.footer.saving');
    if (allCompletionDone) return t('gapUi.workspace.save');
    return t('gapUi.detail.footer.saveDraft');
  }, [saving, allCompletionDone, t]);

  // Sugestão automática do diagnóstico
  const diagnosticSuggestion = useMemo(() => {
    const answered = Object.entries(diagnosticAnswers).filter(([, v]) => v !== null);
    if (answered.length === 0) return null;
    let totalWeight = 0;
    let weightedScore = 0;
    answered.forEach(([idx, ans]) => {
      const w = effectiveDiagnosticQuestions[Number(idx)]?.peso || 1;
      totalWeight += w;
      if (ans === 'sim') weightedScore += w * 1;
      else if (ans === 'parcial') weightedScore += w * 0.5;
    });
    const pct = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
    const suggested: ConformityStatus = pct >= 80 ? 'conforme' : pct >= 40 ? 'parcial' : 'nao_conforme';
    const label = pct >= 80 ? t('gapUi.status.conforme') : pct >= 40 ? t('gapUi.status.parcial') : t('gapUi.status.naoConforme');
    const color = pct >= 80 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-destructive';
    return { pct: Math.round(pct), suggested, label, color };
  }, [diagnosticAnswers, effectiveDiagnosticQuestions, t]);

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={requirement.titulo}
        eyebrow={`${t('experience.requirementLabel')} · ${requirement.codigo}`}
        icon={GapAnalysisIcon}
        size="2xl"
        noScroll
        onSubmit={handleSave}
        isDirty={isDirty}
        description={t('gapUi.workspace.reviewHintFull')}
        descriptionSrOnly
        footer={<div className="requirement-footer">
          <Button variant="ghost" size="sm" disabled={activeStep === 0 || loading} onClick={() => setActiveStep(step => step - 1)}>{t('gapUi.workspace.back')}</Button>
          <span className="requirement-footer-step">{t('gapUi.workspace.stepOf', { step: activeStep + 1 })}</span>
          <Button variant={activeStep === 3 ? 'default' : 'outline'} size="sm" disabled={loading || saving || savingStatus || uploading} onClick={handleSave}>{footerLabel}</Button>
          {activeStep < 3 && <Button size="sm" disabled={loading} onClick={() => setActiveStep(step => step + 1)}>{t('gapUi.workspace.next')} <span aria-hidden="true">→</span></Button>}
        </div>}
        submitLabel={footerLabel}
        isSubmitting={saving}
        submitDisabled={loading}
        className="akuris-requirement-dialog h-[100dvh] sm:h-[90vh] sm:max-h-[960px]"
      >
        <div className="requirement-workspace">
          <nav className="requirement-step-nav" aria-label={t('experience.requirementNavigation')}>
            {workspaceSteps.map((step, index) => <button key={step} type="button" disabled={loading} aria-current={activeStep === index ? 'step' : undefined} aria-controls={'requirement-panel-' + index} onClick={() => setActiveStep(index)}>
              <span className="requirement-step-number" aria-hidden="true">0{index + 1}</span>
              <span><strong>{t('gapUi.workspace.' + step)}</strong><small>{t('gapUi.workspace.' + step + 'Hint')}</small></span>
            </button>)}
          </nav>
          {!loading && <div className="requirement-next-action"><span>{t('gapUi.workspace.nextAction')}</span><button type="button" onClick={() => goToSection(nextCriterion ? completionSections[nextCriterion.key] : 'requirement-details')}>{nextCriterion ? completionLabels[nextCriterion.key] : t('gapUi.workspace.ready')} <span aria-hidden="true">→</span></button><small>{t('gapUi.detail.completion.progress', { done: completionDone, total: completionCriteria.length })}</small></div>}
          <div ref={requirementBody} className="requirement-workspace-scroll">
            {loading ? <div className="flex justify-center py-16"><AkurisPulse size={32} className="text-primary" /></div> : <>
              <div id="requirement-panel-0" className="requirement-panel" hidden={activeStep !== 0} tabIndex={-1} aria-label={t('gapUi.workspace.understand')}>
                <div id="requirement-guidance" tabIndex={-1} className="requirement-understand">
                <div className="space-y-5">
                  <div className="requirement-brief">
                    <span className="requirement-section-label">{t('gapUi.workspace.overview')}</span>
                    <h3>{requirement.titulo}</h3>
                    <p>{requirement.descricao || t('gapUi.workspace.noDescription')}</p>
                  </div>
                  <div className="requirement-work">
                    <h3>{t('gapUi.workspace.workTitle')}</h3>
                    <ol>{[1, 2, 3].map(n => <li key={n}><span aria-hidden="true">0{n}</span><div><strong>{t(`gapUi.workspace.work${n}`)}</strong><p>{t(`gapUi.workspace.work${n}Body`)}</p></div></li>)}</ol>
                  </div>
                  {implementationText && <div className="requirement-implementation"><h3>{t('gapUi.workspace.implementation')}</h3><MarkdownContent content={implementationText} /></div>}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setGuidanceOpen(o => !o)}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                      aria-expanded={guidanceOpen}
                    >
                      <IconBook className="h-4 w-4 text-primary" strokeWidth={1.5} />
                      <h4 className="text-sm font-semibold text-foreground">{t('gapUi.workspace.readGuidance')}</h4>
                      <IconChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', guidanceOpen ? '' : '-rotate-90')} strokeWidth={1.5} />
                    </button>
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => orientacao.gerar(true)}
                        disabled={generatingGuidance}
                      >
                        {generatingGuidance ? <AkurisPulse size={12} className="mr-1" /> : <IconRefresh className="h-3 w-3 mr-1" strokeWidth={1.5} />}
                        {generatingGuidance ? t('gapUi.detail.generating') : t('gapUi.detail.regenerate')}
                      </Button>
                    )}
                  </div>

                  {guidanceOpen && <p className="text-micro leading-5 text-muted-foreground">{t('experience.guidanceIncluded')}</p>}
                  {guidanceOpen && (generatingGuidance && !guidanceText ? (
                    <GuidanceSkeleton />
                  ) : guidanceText ? (
                    <>
                      <MarkdownContent content={guidanceText} />


                    </>
                  ) : (
                    <div className="space-y-3">
                      {/*
                        Dizer a verdade sobre o estado, e oferecer a saída certa.

                        O texto da norma continua a aparecer — é o que há — mas
                        deixa de ser servido como se fosse a orientação. E a
                        acção proposta é a que a pessoa PODE executar: tentar de
                        novo, ou ir buscar o diagnóstico guiado, que funciona
                        mesmo sem orientação escrita.
                      */}
                      <div className="rounded-lg border border-dashed bg-card p-3">
                        <div className="flex items-start gap-2">
                          <IconIdea className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" strokeWidth={1.5} />
                          <p className="text-xs text-muted-foreground leading-6">
                            {guidanceErro === 'falha' ? t('gapUi.detail.guidanceFalhou') : t('gapUi.detail.guidanceIndisponivel')}
                          </p>
                        </div>
                        {
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 h-7 text-xs"
                            disabled={generatingGuidance}
                            onClick={() => orientacao.gerar(false)}
                          >
                            {generatingGuidance
                              ? <AkurisPulse size={12} className="mr-1.5" />
                              : <IconRefresh className="h-3 w-3 mr-1.5" strokeWidth={1.5} />}
                            {t('gapUi.detail.guidanceTentarDeNovo')}
                          </Button>
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Controlos internos que implementam este requisito (N para N) */}
                <div className="mt-6 border-t pt-5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <IconShield className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <h4 className="text-sm font-bold text-foreground">{t('vinculoReq.controlosLigados')}</h4>
                  </div>
                  {controlosLigados.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('vinculoReq.semControlos')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {controlosLigados.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm transition-colors hover:border-primary/20 hover:bg-primary/[0.035]"
                        >
                          <span className="text-sm font-medium truncate">{c.nome}</span>
                          <StatusBadge {...resolveControleStatusTone(c.status)}>
                            {c.emFalha ? t('vinculoReq.controloEmFalha') : formatStatus(c.status)}
                          </StatusBadge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div></div>
              <div id="requirement-panel-1" className="requirement-panel" hidden={activeStep !== 1} tabIndex={-1} aria-label={t('gapUi.workspace.evaluate')}>                  {/* ===== STEP 1: Avaliar Conformidade ===== */}
                  <JourneyStep
                    id="requirement-diagnosis"
                    number={2}
                    title={t('gapUi.detail.step1Title')}
                    description={t('gapUi.detail.step1Description')}
                    state={isStatusDefined && diagnosticDone ? 'complete' : 'active'}
                    badge={
                      isStatusDefined && diagnosticDone
                        ? <Badge variant="success" className="text-micro">{t('gapUi.detail.defined')}</Badge>
                        : <Badge variant="outline" className="text-micro tabular-nums">{diagnosticAnswered}/{effectiveDiagnosticQuestions.length}</Badge>
                    }
                  >
                    <div className="space-y-3">
                        <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                          <IconHelp className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                          <p className="text-xs font-medium text-foreground">{t('gapUi.detail.guidedDiagnostic')}</p>
                        </div>
                        <p className="text-micro text-muted-foreground">
                          {t('gapUi.detail.guidedDiagnosticHint')}
                        </p>
                        {usesFallbackDiagnostic && (
                          <p className="rounded-md border border-info/25 bg-info/10 px-3 py-2 text-micro leading-5 text-muted-foreground">
                            {t('gapUi.detail.fallbackDiagnostic.hint')}
                          </p>
                        )}
                        <div className="space-y-2.5">
                          {effectiveDiagnosticQuestions.map((q, idx) => {
                            const answer = diagnosticAnswers[idx] || null;
                            return (
                              <div key={idx} className="space-y-3 border-b border-border/70 py-4 first:pt-0 last:border-0">
                                {/* `div`, não `p`: o `Badge` é uma `div`, e uma
                                    `div` dentro de `p` é HTML inválido — o React
                                    avisava-o em consola a cada abertura do
                                    diálogo («validateDOMNesting»). O browser
                                    fecha o `p` sozinho, o que parte o espaçamento. */}
                                <div className="text-sm text-foreground leading-relaxed">
                                  <span className="mr-2 text-muted-foreground tabular-nums">{idx + 1}.</span>
                                  {q.pergunta}
                                </div>
                                <div role="group" aria-label={q.pergunta} className="flex flex-wrap gap-2">
                                  {(['sim', 'parcial', 'nao'] as const).map(opt => (
                                    <Button
                                      key={opt}
                                      aria-pressed={answer === opt}
                                      size="sm"
                                      variant={answer === opt ? 'default' : 'outline'}
                                      className={cn(
                                        'text-xs h-9 min-w-16 px-3',
                                        answer === opt && opt === 'sim' && 'bg-success hover:bg-success/90 text-success-foreground border-success',
                                        answer === opt && opt === 'parcial' && 'bg-warning hover:bg-warning/90 text-warning-foreground border-warning',
                                        answer === opt && opt === 'nao' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive',
                                      )}
                                      onClick={() => setDiagnosticAnswers(prev => ({ ...prev, [idx]: opt }))}
                                    >
                                      {opt === 'sim' ? t('gapUi.detail.answerYes') : opt === 'parcial' ? t('gapUi.detail.answerPartial') : t('gapUi.detail.answerNo')}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {diagnosticSuggestion && (
                          <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-micro text-muted-foreground">{t('gapUi.detail.recommendation')}</span>
                              <Badge variant="outline" className={cn('font-semibold', diagnosticSuggestion.color)}>
                                {diagnosticSuggestion.label}
                              </Badge>
                              <span className="text-micro text-muted-foreground">{t('gapUi.detail.adherencePct', { pct: diagnosticSuggestion.pct })}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs shrink-0"
                              disabled={!diagnosticDone || savingStatus || currentStatus === diagnosticSuggestion.suggested}
                              onClick={() => handleStatusChange(diagnosticSuggestion.suggested)}
                            >
                              <IconCheck className="h-3 w-3 mr-1" strokeWidth={2} />
                              {t('gapUi.common.apply')}
                            </Button>
                          </div>
                        )}

                        <div className="space-y-2 border-t border-border/50 pt-3">
                          <Label className="text-xs">{t('gapUi.detail.finalDecision')}</Label>
                          <div className="max-w-sm"><ConformitySelect value={currentStatus} onValueChange={value => handleStatusChange(value as ConformityStatus)} disabled={savingStatus || loading} /></div>
                          <p className="text-xs leading-5 text-muted-foreground">{t('gapUi.workspace.suggestionHint')}</p>
                          <p className="text-xs leading-5 text-muted-foreground">{t('gapUi.workspace.savedStatus')}</p>
                          {savingStatus && <AkurisPulse size={14} className="text-muted-foreground" />}
                        </div>
                      </div>
                    </div>
                  </JourneyStep>

</div>
              <div id="requirement-panel-2" className="requirement-panel" hidden={activeStep !== 2} tabIndex={-1} aria-label={t('gapUi.workspace.prove')}>                  {/* ===== STEP 2: Evidências ===== */}
                  <JourneyStep
                    id="requirement-evidence"
                    number={3}
                    title={t('gapUi.detail.step2Title')}
                    description={t('gapUi.detail.step2Description')}
                    state={evidenciasCount > 0 ? 'complete' : (isStatusDefined ? 'active' : 'pending')}
                    badge={
                      evidenciasCount > 0
                        ? <Badge variant="secondary" className="text-micro">{evidenciasCount} {evidenciasCount === 1 ? t('gapUi.detail.item') : t('gapUi.detail.items')}</Badge>
                        : <Badge variant="outline" className="text-micro">{t('gapUi.detail.empty')}</Badge>
                    }
                  >
                    <div className="space-y-3">
                      {(evidenciasText || requirement.exemplos_evidencias) && (
                        <div className="requirement-evidence-examples mb-5 rounded-lg bg-surface-1/50 p-4">
                          <div className="flex items-center gap-1.5 mb-3">
                            <IconSuccess className="h-4 w-4 text-success" strokeWidth={1.5} />
                            <h4 className="text-sm font-bold text-foreground">{t('gapUi.detail.acceptedEvidenceExamples')}</h4>
                          </div>
                          <ul className="space-y-2">
                            {(evidenciasText || requirement.exemplos_evidencias || '').split('\n').filter(l => l.trim()).map((ex, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-6">
                                <IconSuccess className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" strokeWidth={1.5} />
                                <span>{ex.replace(/^[-•*]\s*/, '').trim()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}<p className="text-xs leading-5 text-muted-foreground">{t('gapUi.workspace.evidenceHint')}</p>
                      {/*
                        Um documento aprovado vale por muitos ficheiros soltos.

                        Aqui só se podia CARREGAR um ficheiro novo -- e a mesma
                        política acabava carregada outra vez em cada requisito
                        que a pedisse, sem versão, sem validade e sem saber que
                        já existia aprovada no módulo de Documentos. Quando
                        fosse revista, as cópias ficavam para trás.
                      */}
                      {requirement?.id && (
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <DocumentosDoRequisito
                            requisitoId={requirement.id}
                            frameworkId={frameworkId}
                            onChanged={() => void loadLinkedEvidenceCount()}
                          />
                        </div>
                      )}

                      {/* Hub de 3 ações */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2"
                          onClick={() => openDocGen({
                            frameworkId,
                            requirementContext: {
                              requirementId: requirement.id,
                              requirementCode: requirement.codigo,
                              requirementTitle: requirement.titulo,
                            },
                            /*
                              O documento gerado volta como evidência daqui.

                              Antes ia para o módulo Documentos e o passo 2
                              continuava a dizer "Vazio": a pessoa fazia o
                              esforço certo e o requisito não se mexia. Tinha de
                              descobrir sozinha que precisava de voltar,
                              descarregar e reenviar o ficheiro que acabara de
                              gerar.
                            */
                            onDocumentoVinculado: (doc) => {
                              if (!doc.arquivo_url) return;
                              setFormData(prev => (
                                prev.evidence_files.some((f: any) => f.url === doc.arquivo_url)
                                  ? prev
                                  : {
                                      ...prev,
                                      evidence_files: [
                                        ...prev.evidence_files,
                                        { type: 'file', name: doc.nome, url: doc.arquivo_url, origem: 'docgen' },
                                      ],
                                    }
                              ));
                              toast.success(t('gapUi.detail.documentoAnexadoAoRequisito'));
                            },
                          })}
                        >
                          <div className="text-left leading-tight">
                            <div className="text-xs font-semibold">{t('gapUi.detail.generateWithAi')}</div>
                            <div className="text-micro text-muted-foreground">{t('gapUi.detail.customDocument')}</div>
                          </div>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2"
                          onClick={() => document.getElementById('file-upload')?.click()}
                        >
                          <IconUpload className="h-4 w-4 mr-2 shrink-0" strokeWidth={1.5} />
                          <div className="text-left leading-tight">
                            <div className="text-xs font-semibold">{t('gapUi.detail.attachFile')}</div>
                            <div className="text-micro text-muted-foreground">{t('gapUi.detail.fileTypesHint')}</div>
                          </div>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2"
                          onClick={() => { setLinkUrl(''); setLinkName(''); setLinkDialogOpen(true); }}
                        >
                          <IconExternal className="h-4 w-4 mr-2 shrink-0" strokeWidth={1.5} />
                          <div className="text-left leading-tight">
                            <div className="text-xs font-semibold">{t('gapUi.detail.addLink')}</div>
                            <div className="text-micro text-muted-foreground">{t('gapUi.detail.externalUrl')}</div>
                          </div>
                        </Button>
                      </div>

                      <p className="text-micro text-muted-foreground flex items-start gap-1.5">
                        {t('gapUi.detail.afterAttachHint')}
                      </p>

                      {/* Drop zone */}
                      <div
                        className="relative border-2 border-dashed border-muted-foreground/25 rounded-md p-2 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                          const files = e.dataTransfer.files;
                          if (files.length > 0) {
                            const input = document.getElementById('file-upload') as HTMLInputElement;
                            if (input) { input.files = files; input.dispatchEvent(new Event('change', { bubbles: true })); }
                          }
                        }}
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <p className="text-micro text-muted-foreground">{uploading ? t('gapUi.detail.sending') : t('gapUi.detail.dragFilesHere')}</p>
                      </div>
                      <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" />

                      {formData.evidence_files.length > 0 && (
                        <div className="border rounded-md p-2 space-y-1.5">
                          {formData.evidence_files.map((file, index) => {
                            const validation = file.url ? validationByUrl[file.url] : undefined;
                            const isValidating = validatingUrl === file.url;
                            const verdictColor =
                              validation?.verdict === 'conforme' ? 'bg-success/10 text-success border-success/30' :
                              validation?.verdict === 'parcial' ? 'bg-warning/10 text-warning border-warning/30' :
                              validation?.verdict === 'nao_conforme' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                              'bg-muted text-muted-foreground border-border';
                            const verdictLabel =
                              validation?.verdict === 'conforme' ? t('gapUi.status.conforme') :
                              validation?.verdict === 'parcial' ? t('gapUi.status.parcial') :
                              validation?.verdict === 'nao_conforme' ? t('gapUi.verdict.naoConforme') :
                              validation?.verdict === 'indeterminado' ? t('gapUi.verdict.indeterminado') : '';
                            return (
                              <div key={index} className="rounded bg-card p-2 space-y-1.5 border border-border">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {file.type === 'link' ? <IconExternal className="h-3.5 w-3.5 text-info shrink-0" strokeWidth={1.5} /> : <IconFile className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />}
                                    {file.type === 'link' ? (
                                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline truncate text-xs">{file.name}</a>
                                    ) : (
                                      <span className="truncate text-xs">{file.name}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {file.type !== 'link' && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-micro"
                                              disabled={isValidating}
                                              onClick={() => handleValidateEvidence(file)}
                                            >
                                              {isValidating && <AkurisPulse size={12} />}
                                              {isValidating ? t('gapUi.detail.analyzing') : t('gapUi.detail.validateWithAi')}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{t('gapUi.detail.aiValidatesFileTooltip')}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleRemoveFile(index)}>
                                      <IconClose className="h-3 w-3" strokeWidth={1.5} />
                                    </Button>
                                  </div>
                                </div>
                                {validation && (
                                  <div className={cn('rounded border px-2 py-1.5 text-micro', verdictColor)}>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="font-semibold">{t('gapUi.detail.aiLabel', { label: verdictLabel })}</span>
                                      <span className="font-mono">{validation.score}%</span>
                                    </div>
                                    <p className="leading-snug opacity-90">{validation.justification}</p>
                                    {validation.missing && validation.missing.length > 0 && (
                                      <ul className="mt-1 list-disc list-inside opacity-80">
                                        {validation.missing.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Reaproveitamento de evidências da biblioteca + sugestões IA */}
                      <div className="mt-4">
                        <EvidenceReusePanel
                          requirementId={requirement.id}
                          frameworkId={frameworkId}
                          evaluationId={formData.id}
                          onLinked={() => void loadLinkedEvidenceCount()}
                        />
                      </div>
                    </div>
                  </JourneyStep>

</div>
              <div id="requirement-panel-3" className="requirement-panel space-y-5" hidden={activeStep !== 3} tabIndex={-1} aria-label={t('gapUi.workspace.review')}>
                <p className="text-sm leading-6 text-muted-foreground">{t('gapUi.workspace.reviewHintFull')}</p>
                                  <details open className="group rounded-lg border border-border/80 bg-surface-1/30 p-3" aria-labelledby="completion-title">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <div>
                        <p id="completion-title" className="text-sm font-semibold text-foreground">
                          {t('gapUi.detail.completion.title')}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {allCompletionDone
                            ? t('gapUi.detail.completion.ready')
                            : t('gapUi.detail.completion.hint')}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                        {t('gapUi.detail.completion.progress', { done: completionDone, total: completionCriteria.length })}
                        <IconChevronDown className="h-4 w-4 group-open:rotate-180" />
                      </span>
                    </summary>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={t('gapUi.detail.completion.title')}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={completionProgress}
                    >
                      <div
                        className={cn('akuris-motion-data h-full rounded-full transition-[width] motion-reduce:transition-none', allCompletionDone ? 'bg-success' : 'bg-primary')}
                        style={{ width: `${completionProgress}%` }}
                      />
                    </div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {completionCriteria.map((criterion) => (
                        <li key={criterion.key} className="flex items-start gap-2 text-xs">
                          <span className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                            criterion.done
                              ? 'border-success bg-success text-success-foreground'
                              : 'border-muted-foreground/40 text-transparent',
                          )}>
                            <IconCheck className="h-2.5 w-2.5" strokeWidth={2.5} />
                          </span>
                          <button type="button" onClick={() => goToSection(completionSections[criterion.key])} className="text-left text-foreground underline-offset-4 hover:text-primary hover:underline">
                            {completionLabels[criterion.key]}<span className="sr-only"> — {t(criterion.done ? 'gapUi.workspace.completionDone' : 'gapUi.workspace.completionPending')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>

                  {/* ===== STEP 3: Plano de Ação (condicional) ===== */}
                  {requiresPlanoStep && (
                    <JourneyStep
                      id="requirement-plan"
                      title={t('gapUi.detail.step3Title')}
                      description={t('gapUi.detail.step3Description')}
                      state={planoStepDone ? 'complete' : 'active'}
                      badge={
                        planoAcaoVinculado
                          ? getPlanoStatusBadge(planoAcaoVinculado.status)
                          : <Badge variant="warning" className="text-micro">{t('gapUi.detail.noPlano')}</Badge>
                      }
                    >
                      {planoAcaoVinculado ? (
                        <div className="flex items-center justify-between p-3 bg-card rounded-md border border-border">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{planoAcaoVinculado.titulo}</p>
                            {planoAcaoVinculado.prazo && (
                              <span className="text-xs text-muted-foreground">{t('gapUi.detail.deadlinePrefix')}{parseDataLocal(planoAcaoVinculado.prazo).toLocaleDateString(intlLocale())}</span>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => window.open('/planos-acao', '_blank')}>
                            <IconExternal className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30">
                            <IconWarning className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                            <p className="text-xs text-foreground">
                              {t('gapUi.detail.nonCompliantWarning')}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setPlanoAcaoDialogOpen(true)}>
                            <IconChecklist className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
                            {t('gapUi.detail.createActionPlan')}
                          </Button>
                        </div>
                      )}
                      <div className="mt-3 space-y-1.5">
                        <Label htmlFor="plano" className="text-xs">{t('gapUi.detail.planoNotesLabel')}</Label>
                        <Textarea
                          id="plano" placeholder={t('gapUi.detail.planoNotesPlaceholder')}
                          value={formData.plano_acao}
                          onChange={(e) => setFormData(prev => ({ ...prev, plano_acao: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    </JourneyStep>
                  )}

                  {/* ===== STEP 4: Detalhes da Avaliação ===== */}
                  <JourneyStep
                    id="requirement-details"
                    title={t('gapUi.detail.step4Title')}
                    description={t('gapUi.detail.step4Description')}
                    state={detalhesDone ? 'complete' : 'pending'}
                    badge={<span className="text-xs text-muted-foreground">{t(isNonCompliant ? 'gapUi.workspace.required' : 'gapUi.detail.optional')}</span>}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="responsavel" className="text-xs">{t('gapUi.detail.responsibleLabel')}</Label>
                          <Select
                            value={formData.responsavel_avaliacao}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, responsavel_avaliacao: value }))}
                          >
                            <SelectTrigger id="responsavel"><SelectValue placeholder={t('gapUi.detail.selectPlaceholder')} /></SelectTrigger>
                            <SelectContent>
                              {users.map(user => (
                                <SelectItem key={user.user_id} value={user.user_id}>{user.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="prazo" className="text-xs flex items-center gap-1">
                            <IconCalendar className="h-3.5 w-3.5" strokeWidth={1.5} />{t('gapUi.detail.deadlineLabel')}
                          </Label>
                          <DateField
                            id="prazo"
                            value={formData.prazo_implementacao || null}
                            onChange={(v) => setFormData(prev => ({ ...prev, prazo_implementacao: v || '' }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="observacoes" className="text-xs">{t('gapUi.detail.observationsLabel')}</Label>
                        <Textarea
                          id="observacoes" placeholder={t('gapUi.detail.observationsPlaceholder')}
                          value={formData.observacoes}
                          onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    </div>
                  </JourneyStep>

                  {/* ===== STEP 5: Vínculos & Histórico (colapsado) ===== */}
                  <JourneyStep
                    title={t('gapUi.detail.step5Title')}
                    description={t('gapUi.detail.step5Description')}
                    state="pending"
                    badge={formData.riscos_vinculados.length > 0 ? <Badge variant="secondary" className="text-micro">{t('gapUi.detail.risksCount', { count: formData.riscos_vinculados.length })}</Badge> : undefined}
                    defaultOpen={false}
                    collapsible
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <IconWarning className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                          <p className="text-xs font-medium text-foreground">{t('gapUi.detail.linkedRisks')}</p>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                          {riscos.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">{t('gapUi.detail.noRisksRegistered')}</p>
                          ) : (
                            riscos.map(risco => (
                              <label key={risco.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent p-1.5 rounded text-sm">
                                <input type="checkbox" checked={formData.riscos_vinculados.includes(risco.id)} onChange={() => handleToggleRisco(risco.id)} className="rounded" />
                                <span className="font-medium text-xs">{risco.nome}</span>
                                <Badge variant="outline" className="ml-auto text-micro">{formatStatus(risco.nivel_risco_residual || risco.nivel_risco_inicial)}</Badge>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <IconHistory className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                          <p className="text-xs font-medium text-foreground">{t('gapUi.detail.changeHistory')}</p>
                        </div>
                        <div className="max-h-48 overflow-y-auto border rounded-md">
                          <AuditTrailTimeline requirementId={requirement.id} frameworkId={frameworkId} />
                        </div>
                      </div>
                    </div>
                  </JourneyStep>

              </div>
            </>}
          </div>
        </div>
      </DialogShell>

      <PlanoAcaoDialog
        open={planoAcaoDialogOpen}
        onOpenChange={setPlanoAcaoDialogOpen}
        onSave={handleSavePlanoAcao}
        loading={savingPlano}
        plano={{
          titulo: t('gapUi.detail.planoAdequarTitle', { codigo: requirement.codigo, titulo: requirement.titulo }),
          descricao: requirement.descricao || '',
          prioridade: (requirement.peso || 0) >= 3 ? 'alta' : 'media',
          modulo_origem: 'frameworks',
          registro_origem_id: requirement.id,
          registro_origem_titulo: `${requirement.codigo} - ${requirement.titulo}`,
        }}
      />

      <DialogShell
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        icon={IconExternal}
        title={t('gapUi.detail.addLinkDialogTitle')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLinkDialogOpen(false)}>{t('gapUi.common.cancel')}</Button>
            <Button
              size="sm"
              onClick={() => {
                const url = linkUrl.trim();
                if (!url) { toast.error(t('gapUi.detail.informUrl')); return; }
                let safeName = linkName.trim();
                if (!safeName) {
                  try { safeName = new URL(url).hostname; } catch { safeName = url; }
                }
                setFormData(prev => ({
                  ...prev,
                  evidence_files: [...prev.evidence_files, { type: 'link', name: safeName, url }],
                }));
                setLinkDialogOpen(false);
                toast.success(t('gapUi.detail.linkAdded'));
              }}
            >
              {t('gapUi.common.add')}
            </Button>
          </div>
        }
      >
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="link-url" className="text-xs">{t('gapUi.detail.urlLabel')} <span className="text-destructive">*</span></Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-name" className="text-xs">{t('gapUi.detail.linkNameLabel')}</Label>
              <Input
                id="link-name"
                placeholder={t('gapUi.detail.linkNamePlaceholder')}
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
              />
              <p className="text-micro text-muted-foreground">{t('gapUi.detail.linkNameHint')}</p>
            </div>
          </div>
      </DialogShell>
    </>
  );
};
