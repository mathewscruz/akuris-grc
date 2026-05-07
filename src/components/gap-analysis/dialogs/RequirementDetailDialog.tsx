import { useState, useEffect, useCallback, useMemo } from "react";
import DOMPurify from 'dompurify';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
// (Skeleton removido — substituído por AkurisPulse)
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Upload, X, FileText, Calendar, Lightbulb, ClipboardList, CheckCircle2, ExternalLink, AlertTriangle, ChevronDown, History, BookOpen, RefreshCw, HelpCircle, Building2, Settings, FileCheck, CheckSquare, Shield, Target, Check, type LucideIcon } from 'lucide-react';
import { AkurisAIIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateForInput, parseDateForDB } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { PlanoAcaoDialog } from "@/components/planos-acao/PlanoAcaoDialog";
import { AuditTrailTimeline } from "@/components/gap-analysis/AuditTrailTimeline";
import { logger } from '@/lib/logger';
import { useDocGen } from '@/contexts/DocGenContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ConformityStatus } from "@/lib/gap-analysis-tokens";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EvidenceReusePanel } from '@/components/gap-analysis/dialogs/EvidenceReusePanel';
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
interface Risco { id: string; nome: string; nivel_risco_inicial: string; }
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

// ---------------------------------------------------------------------------
// Status Segmented Control — barra inline para mudar conformity_status
// ---------------------------------------------------------------------------
const STATUS_OPTIONS: Array<{ value: ConformityStatus; label: string; activeClass: string }> = [
  { value: 'conforme', label: 'Conforme', activeClass: 'bg-success text-success-foreground hover:bg-success/90 border-success' },
  { value: 'parcial', label: 'Parcial', activeClass: 'bg-warning text-warning-foreground hover:bg-warning/90 border-warning' },
  { value: 'nao_conforme', label: 'Não Conforme', activeClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive' },
  { value: 'nao_aplicavel', label: 'N/A', activeClass: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 border-secondary' },
];

const StatusSegmentedControl: React.FC<{
  value: string | null | undefined;
  onChange: (next: ConformityStatus) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="inline-flex flex-wrap gap-1.5 rounded-lg bg-muted/40 p-1 border">
    {STATUS_OPTIONS.map(opt => {
      const isActive = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-8 px-3 text-xs font-medium rounded-md border transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isActive
              ? opt.activeClass + ' shadow-sm'
              : 'bg-background text-muted-foreground border-transparent hover:bg-background hover:text-foreground hover:border-border'
          )}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Journey Step — passo numerado da jornada de avaliação
// ---------------------------------------------------------------------------
type StepState = 'complete' | 'active' | 'pending';

const JourneyStep: React.FC<{
  number: number;
  title: string;
  description?: string;
  state: StepState;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
}> = ({ number, title, description, state, badge, defaultOpen = true, collapsible = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const numberClass =
    state === 'complete' ? 'bg-success text-success-foreground border-success' :
    state === 'active' ? 'bg-primary text-primary-foreground border-primary' :
    'bg-muted text-muted-foreground border-border';

  const headerContent = (
    <div className="flex items-start gap-3 w-full">
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold shrink-0 mt-0.5', numberClass)}>
        {state === 'complete' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {collapsible && (
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform mt-1', open ? 'rotate-180' : '')} strokeWidth={1.5} />
      )}
    </div>
  );

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      {collapsible ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full text-left p-3 hover:bg-muted/30 transition-colors">
              {headerContent}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-1 ml-10">{children}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="p-3">{headerContent}</div>
          <div className="px-4 pb-4 ml-10">{children}</div>
        </>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Markdown helpers (orientação da IA)
// ---------------------------------------------------------------------------

/** Icon mapping for section titles based on keywords */
const getSectionIcon = (title: string): { icon: LucideIcon; color: string } => {
  const t = title.toLowerCase();
  if (t.includes('significa') || t.includes('conceito') || t.includes('what')) return { icon: Target, color: 'text-primary' };
  if (t.includes('importa') || t.includes('relevância') || t.includes('why') || t.includes('negócio')) return { icon: Building2, color: 'text-warning' };
  if (t.includes('implementar') || t.includes('como') || t.includes('how') || t.includes('passo')) return { icon: Settings, color: 'text-info' };
  if (t.includes('resumo') || t.includes('conclus') || t.includes('prático') || t.includes('summary')) return { icon: CheckSquare, color: 'text-success' };
  if (t.includes('evidência') || t.includes('comprova') || t.includes('evidence') || t.includes('documento')) return { icon: FileCheck, color: 'text-primary' };
  if (t.includes('risco') || t.includes('atenção') || t.includes('risk') || t.includes('cuidado')) return { icon: AlertTriangle, color: 'text-destructive' };
  if (t.includes('controle') || t.includes('medida') || t.includes('proteção')) return { icon: Shield, color: 'text-info' };
  return { icon: BookOpen, color: 'text-muted-foreground' };
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
            <li key={i} className="text-[13px] text-muted-foreground leading-7">
              <span dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
            </li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1.5 ml-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground leading-7">
              <span className="text-primary mt-2 text-[6px]">●</span>
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
      <p key={`p-${i}`} className="text-[13px] text-muted-foreground leading-7" dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />
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
      current = { title: h2Match[1], lines: [] };
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
            <div key={idx} className="text-[13px] text-foreground/80 italic leading-7 space-y-2">
              {contentElements}
            </div>
          );
        }

        const { icon: SectionIcon, color } = getSectionIcon(section.title);
        return (
          <div key={idx} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className={cn('flex items-center justify-center h-7 w-7 rounded-md bg-background border border-border', color)}>
                <SectionIcon className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
            </div>
            <div className="space-y-2.5 pl-[38px]">
              {renderContentLines(section.lines)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const GuidanceSkeleton = () => (
  <div className="min-h-[180px] flex flex-col items-center justify-center gap-2 py-6">
    <AkurisPulse size={48} />
    <p className="text-xs text-muted-foreground">Carregando orientação...</p>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const RequirementDetailDialog: React.FC<RequirementDetailDialogProps> = ({
  open, onOpenChange, requirement, frameworkId, onClose, onStatusChange
}) => {
  const { empresaId } = useEmpresaId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [uploading, setUploading] = useState(false);
  const [planoAcaoDialogOpen, setPlanoAcaoDialogOpen] = useState(false);
  const [planoAcaoVinculado, setPlanoAcaoVinculado] = useState<any>(null);
  const [savingPlano, setSavingPlano] = useState(false);
  const [guidanceText, setGuidanceText] = useState<string | null>(null);
  const [evidenciasText, setEvidenciasText] = useState<string | null>(null);
  const [generatingGuidance, setGeneratingGuidance] = useState(false);
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<Array<{pergunta: string; peso: number}>>([]);
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

  const [formData, setFormData] = useState<EvaluationData>({
    responsavel_avaliacao: '', plano_acao: '', observacoes: '',
    prazo_implementacao: '', riscos_vinculados: [], evidence_files: [], plano_acao_id: null
  });

  useEffect(() => {
    setCurrentStatus(requirement.conformity_status);
  }, [requirement.conformity_status, requirement.id]);

  useEffect(() => {
    if (open && empresaId) loadData();
  }, [open, empresaId, requirement.id]);

  const triggerGuidanceGeneration = useCallback(async (forceRegenerate = false) => {
    setGeneratingGuidance(true);
    try {
      const { data, error } = await supabase.functions.invoke('populate-requirement-guidance', {
        body: { requirement_id: requirement.id }
      });
      if (error) throw error;
      if (data?.orientacao_implementacao) {
        setGuidanceText(data.orientacao_implementacao);
        setEvidenciasText(data.exemplos_evidencias || null);
      }
      if (data?.perguntas_diagnostico) {
        try {
          const parsed = JSON.parse(data.perguntas_diagnostico);
          if (Array.isArray(parsed)) setDiagnosticQuestions(parsed);
        } catch { /* ignore */ }
      }
    } catch (error: any) {
      logger.error('Error generating guidance:', { error: error instanceof Error ? error.message : String(error) });
      if (error?.message?.includes('402') || error?.status === 402) {
        toast.error('Créditos de IA esgotados. Entre em contato com a Akuris para adquirir mais créditos.');
      } else if (forceRegenerate) {
        toast.error('Erro ao gerar orientações');
      }
    } finally {
      setGeneratingGuidance(false);
    }
  }, [requirement.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, riscosRes, reqDetailsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, nome, email').eq('empresa_id', empresaId).order('nome'),
        supabase.from('riscos').select('id, nome, nivel_risco_inicial').eq('empresa_id', empresaId).order('nome'),
        supabase.from('gap_analysis_requirements').select('orientacao_implementacao, exemplos_evidencias, perguntas_diagnostico').eq('id', requirement.id).single()
      ]);
      if (usersRes.error) throw usersRes.error;
      if (riscosRes.error) throw riscosRes.error;
      setUsers(usersRes.data || []);
      setRiscos(riscosRes.data || []);

      const details = reqDetailsRes.data as { orientacao_implementacao?: string | null; exemplos_evidencias?: string | null; perguntas_diagnostico?: string | null } || {};
      setGuidanceText(details.orientacao_implementacao || null);
      setEvidenciasText(details.exemplos_evidencias || null);

      if (details.perguntas_diagnostico) {
        try {
          const parsed = JSON.parse(details.perguntas_diagnostico);
          if (Array.isArray(parsed)) setDiagnosticQuestions(parsed);
        } catch { /* ignore */ }
      } else {
        setDiagnosticQuestions([]);
      }
      setDiagnosticAnswers({});

      if (!details.orientacao_implementacao) {
        triggerGuidanceGeneration();
      }

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
      } else {
        setPlanoAcaoVinculado(null);
      }
    } catch (error: any) {
      logger.error('Error loading data:', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao carregar dados');
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
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .update({ conformity_status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', evaluationId)
          .eq('empresa_id', empresaId);
        if (error) throw error;
      } else {
        const { data: newEval, error } = await supabase
          .from('gap_analysis_evaluations')
          .insert({
            framework_id: frameworkId,
            requirement_id: requirement.id,
            empresa_id: empresaId,
            conformity_status: newStatus,
            evidence_status: 'pendente',
            status: 'em_andamento',
          })
          .select()
          .single();
        if (error) throw error;
        setFormData(prev => ({ ...prev, id: newEval.id }));
      }
      onStatusChange?.(requirement.id, newStatus);
      const label = STATUS_OPTIONS.find(o => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Status atualizado para ${label}`);
    } catch (error: any) {
      logger.error('Error updating status:', { error: error instanceof Error ? error.message : String(error) });
      setCurrentStatus(previous);
      toast.error('Erro ao atualizar status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
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
        const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(filePath);
        uploadedFiles.push({ name: file.name, url: publicUrl, size: file.size, type: file.type });
      }
      setFormData(prev => ({ ...prev, evidence_files: [...prev.evidence_files, ...uploadedFiles] }));
      toast.success(`${uploadedFiles.length} arquivo(s) anexado(s)`);
    } catch (error: any) {
      logger.error('Error uploading files:', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({ ...prev, evidence_files: prev.evidence_files.filter((_, i) => i !== index) }));
  };

  const handleValidateEvidence = async (file: any) => {
    if (!empresaId || !file?.url) return;
    setValidatingUrl(file.url);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-evidence-against-requirement', {
        body: {
          requirementId: requirement.id,
          fileUrl: file.url,
          fileName: file.name,
          empresaId,
        },
      });
      if (error) {
        const status = (error as any)?.status;
        if (status === 402 || (data as any)?.creditsExhausted) {
          toast.error('Créditos de IA esgotados. Entre em contato com a Akuris.');
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
      const label = v === 'conforme' ? 'Conforme' : v === 'parcial' ? 'Parcialmente conforme' : v === 'nao_conforme' ? 'Não conforme' : 'Indeterminado';
      toast.success(`IA: ${label} (${(data as any).score ?? 0}%)`);
    } catch (e) {
      logger.error('Validation error', { error: e instanceof Error ? e.message : String(e) });
      toast.error('Não foi possível validar a evidência.');
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
    setSaving(true);
    try {
      let evaluationId = formData.id || requirement.evaluation_id;
      if (evaluationId) {
        const { error } = await supabase.from('gap_analysis_evaluations').update({
          responsavel_avaliacao: formData.responsavel_avaliacao || null,
          plano_acao: formData.plano_acao || null, observacoes: formData.observacoes || null,
          prazo_implementacao: formData.prazo_implementacao ? parseDateForDB(formData.prazo_implementacao) : null,
          evidence_files: formData.evidence_files, plano_acao_id: formData.plano_acao_id || null,
          diagnostic_answers: Object.keys(diagnosticAnswers).length > 0 ? diagnosticAnswers : null,
          updated_at: new Date().toISOString()
        }).eq('id', evaluationId).eq('empresa_id', empresaId);
        if (error) throw error;
      } else {
        const { data: newEval, error } = await supabase.from('gap_analysis_evaluations').insert({
          framework_id: frameworkId, requirement_id: requirement.id, empresa_id: empresaId,
          responsavel_avaliacao: formData.responsavel_avaliacao || null,
          plano_acao: formData.plano_acao || null, observacoes: formData.observacoes || null,
          prazo_implementacao: formData.prazo_implementacao ? parseDateForDB(formData.prazo_implementacao) : null,
          evidence_files: formData.evidence_files, plano_acao_id: formData.plano_acao_id || null,
          diagnostic_answers: Object.keys(diagnosticAnswers).length > 0 ? diagnosticAnswers : null,
          conformity_status: currentStatus || 'pendente',
          evidence_status: 'pendente', status: 'em_andamento'
        }).select().single();
        if (error) throw error;
        evaluationId = newEval.id;
      }

      await supabase.from('gap_evaluation_risks').delete().eq('evaluation_id', evaluationId);
      if (formData.riscos_vinculados.length > 0) {
        const { error } = await supabase.from('gap_evaluation_risks')
          .insert(formData.riscos_vinculados.map(riscoId => ({ evaluation_id: evaluationId, risco_id: riscoId })));
        if (error) throw error;
      }
      toast.success('Avaliação salva com sucesso');
      onClose();
    } catch (error: any) {
      logger.error('Error saving:', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao salvar avaliação');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlanoAcao = async (planoData: any) => {
    setSavingPlano(true);
    try {
      const { data: newPlano, error } = await supabase.from('planos_acao').insert({
        ...planoData, empresa_id: empresaId, modulo_origem: 'frameworks',
        registro_origem_titulo: `${requirement.codigo} - ${requirement.titulo}`,
      }).select().single();
      if (error) throw error;
      setFormData(prev => ({ ...prev, plano_acao_id: newPlano.id }));
      setPlanoAcaoVinculado(newPlano);
      setPlanoAcaoDialogOpen(false);
      toast.success('Plano de ação criado e vinculado');
    } catch (error: any) {
      logger.error('Error creating plano:', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao criar plano de ação');
    } finally {
      setSavingPlano(false);
    }
  };

  const getPlanoStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
      concluido: { label: 'Concluído', variant: 'success' },
      em_andamento: { label: 'Em Andamento', variant: 'warning' },
      pendente: { label: 'Pendente', variant: 'destructive' },
      cancelado: { label: 'Cancelado', variant: 'outline' },
    };
    const s = map[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  // -------------------------------------------------------------------------
  // Estado da jornada (cada step)
  // -------------------------------------------------------------------------
  const isStatusDefined = !!currentStatus && currentStatus !== 'nao_avaliado' && currentStatus !== 'pendente';
  const isNonCompliant = currentStatus === 'nao_conforme' || currentStatus === 'parcial';
  const requiresPlanoStep = isNonCompliant;
  const planoStepDone = !!planoAcaoVinculado;
  const evidenciasCount = formData.evidence_files.length;
  const detalhesDone = !!formData.responsavel_avaliacao && !!formData.prazo_implementacao;

  // CTA contextual no footer
  const footerLabel = useMemo(() => {
    if (saving) return 'Salvando...';
    if (!isStatusDefined) return 'Salvar rascunho';
    const allDone = isStatusDefined && (!requiresPlanoStep || planoStepDone) && detalhesDone;
    if (allDone) return 'Concluir avaliação';
    return 'Salvar avaliação';
  }, [saving, isStatusDefined, requiresPlanoStep, planoStepDone, detalhesDone]);

  // Sugestão automática do diagnóstico
  const diagnosticSuggestion = useMemo(() => {
    const answered = Object.entries(diagnosticAnswers).filter(([, v]) => v !== null);
    if (answered.length === 0) return null;
    let totalWeight = 0;
    let weightedScore = 0;
    answered.forEach(([idx, ans]) => {
      const w = diagnosticQuestions[Number(idx)]?.peso || 1;
      totalWeight += w;
      if (ans === 'sim') weightedScore += w * 1;
      else if (ans === 'parcial') weightedScore += w * 0.5;
    });
    const pct = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
    const suggested: ConformityStatus = pct >= 80 ? 'conforme' : pct >= 40 ? 'parcial' : 'nao_conforme';
    const label = pct >= 80 ? 'Conforme' : pct >= 40 ? 'Parcial' : 'Não Conforme';
    const color = pct >= 80 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-destructive';
    return { pct: Math.round(pct), suggested, label, color };
  }, [diagnosticAnswers, diagnosticQuestions]);

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={`${requirement.codigo} — ${requirement.titulo}`}
        icon={Shield}
        size="2xl"
        noScroll
        onSubmit={handleSave}
        submitLabel={footerLabel}
        isSubmitting={saving}
        submitDisabled={loading}
        className="h-[100dvh] sm:h-[92vh]"
      >
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* ====================================================== */}
          {/* STATUS BAR — sempre visível, primeira ação do usuário  */}
          {/* ====================================================== */}
          <div className="px-6 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
              <StatusSegmentedControl
                value={currentStatus}
                onChange={handleStatusChange}
                disabled={savingStatus || loading}
              />
              {savingStatus && <AkurisPulse size={14} className="text-muted-foreground" />}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <AkurisPulse size={32} className="text-primary" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row min-h-0 flex-1 overflow-hidden">
              {/* ============================================ */}
              {/* LEFT PANEL — Apenas leitura/educação        */}
              {/* ============================================ */}
              <div className="h-full md:w-[42%] border-r bg-muted/20 flex-1 md:flex-none min-h-0 overflow-y-auto">
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-primary" strokeWidth={1.5} />
                      <h4 className="text-sm font-semibold text-foreground">Orientação do Requisito</h4>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => triggerGuidanceGeneration(true)}
                      disabled={generatingGuidance}
                    >
                      {generatingGuidance ? <AkurisPulse size={12} className="mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" strokeWidth={1.5} />}
                      {generatingGuidance ? 'Gerando...' : 'Regenerar'}
                    </Button>
                  </div>

                  {generatingGuidance && !guidanceText ? (
                    <GuidanceSkeleton />
                  ) : guidanceText ? (
                    <>
                      <MarkdownContent content={guidanceText} />

                      {evidenciasText && (
                        <div className="mt-5 pt-5 border-t border-border/50">
                          <div className="flex items-center gap-1.5 mb-3">
                            <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.5} />
                            <h4 className="text-sm font-bold text-foreground">Exemplos de Evidências Aceitas</h4>
                          </div>
                          <ul className="space-y-2">
                            {evidenciasText.split('\n').filter(l => l.trim()).map((ex, i) => (
                              <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground leading-6">
                                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" strokeWidth={1.5} />
                                <span>{ex.replace(/^[-•*]\s*/, '').trim()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      {requirement.descricao && (
                        <p className="text-[13px] text-muted-foreground leading-7">{requirement.descricao}</p>
                      )}
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-dashed">
                        <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                        <p className="text-xs text-muted-foreground">
                          Clique em "Regenerar" para gerar orientações detalhadas para este requisito.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ============================================ */}
              {/* RIGHT PANEL — Jornada numerada              */}
              {/* ============================================ */}
              <div className="h-full md:w-[58%] flex-1 md:flex-none min-h-0 overflow-y-auto">
                <div className="p-5 space-y-3">

                  {/* ===== STEP 1: Avaliar Conformidade ===== */}
                  <JourneyStep
                    number={1}
                    title="Avaliar Conformidade"
                    description="Defina o status acima ou use o diagnóstico rápido"
                    state={isStatusDefined ? 'complete' : 'active'}
                    badge={
                      isStatusDefined
                        ? <Badge variant="success" className="text-[10px]">Definido</Badge>
                        : <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                    }
                  >
                    {diagnosticQuestions.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                          <p className="text-xs font-medium text-foreground">Diagnóstico Rápido</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Responda às perguntas para receber uma sugestão de status.
                        </p>
                        <div className="space-y-2.5">
                          {diagnosticQuestions.map((q, idx) => {
                            const answer = diagnosticAnswers[idx] || null;
                            return (
                              <div key={idx} className="p-3 rounded-md bg-muted/40 border space-y-2">
                                <p className="text-[13px] text-foreground leading-relaxed">
                                  {q.peso >= 2 && <Badge variant="outline" className="text-[10px] mr-1.5">Peso {q.peso}</Badge>}
                                  {q.pergunta}
                                </p>
                                <div className="flex gap-1.5">
                                  {(['sim', 'parcial', 'nao'] as const).map(opt => (
                                    <Button
                                      key={opt}
                                      size="sm"
                                      variant={answer === opt ? 'default' : 'outline'}
                                      className={cn(
                                        'text-xs h-7 px-3',
                                        answer === opt && opt === 'sim' && 'bg-success hover:bg-success/90 text-success-foreground border-success',
                                        answer === opt && opt === 'parcial' && 'bg-warning hover:bg-warning/90 text-warning-foreground border-warning',
                                        answer === opt && opt === 'nao' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive',
                                      )}
                                      onClick={() => setDiagnosticAnswers(prev => ({ ...prev, [idx]: opt }))}
                                    >
                                      {opt === 'sim' ? 'Sim' : opt === 'parcial' ? 'Parcial' : 'Não'}
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
                              <span className="text-[11px] text-muted-foreground">Sugestão da IA:</span>
                              <Badge variant="outline" className={cn('font-semibold', diagnosticSuggestion.color)}>
                                {diagnosticSuggestion.label}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">({diagnosticSuggestion.pct}% aderência)</span>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs shrink-0"
                              disabled={savingStatus || currentStatus === diagnosticSuggestion.suggested}
                              onClick={() => handleStatusChange(diagnosticSuggestion.suggested)}
                            >
                              <Check className="h-3 w-3 mr-1" strokeWidth={2} />
                              Aplicar
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-dashed">
                        <Lightbulb className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                        <p className="text-[11px] text-muted-foreground">
                          Use os botões de status no topo do diálogo para definir a conformidade deste requisito.
                        </p>
                      </div>
                    )}
                  </JourneyStep>

                  {/* ===== STEP 2: Evidências ===== */}
                  <JourneyStep
                    number={2}
                    title="Evidências"
                    description="Anexe documentos ou gere com IA. Valide a aderência ao requisito."
                    state={evidenciasCount > 0 ? 'complete' : (isStatusDefined ? 'active' : 'pending')}
                    badge={
                      evidenciasCount > 0
                        ? <Badge variant="secondary" className="text-[10px]">{evidenciasCount} {evidenciasCount === 1 ? 'item' : 'itens'}</Badge>
                        : <Badge variant="outline" className="text-[10px]">Vazio</Badge>
                    }
                  >
                    <div className="space-y-3">
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
                          })}
                        >
                          <AkurisAIIcon size={16} className="mr-2 text-primary shrink-0" />
                          <div className="text-left leading-tight">
                            <div className="text-xs font-semibold">Gerar com IA</div>
                            <div className="text-[10px] text-muted-foreground">Documento sob medida</div>
                          </div>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2"
                          onClick={() => document.getElementById('file-upload')?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2 shrink-0" strokeWidth={1.5} />
                          <div className="text-left leading-tight">
                            <div className="text-xs font-semibold">Anexar arquivo</div>
                            <div className="text-[10px] text-muted-foreground">PDF, Word, imagem...</div>
                          </div>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2"
                          onClick={() => { setLinkUrl(''); setLinkName(''); setLinkDialogOpen(true); }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2 shrink-0" strokeWidth={1.5} />
                          <div className="text-left leading-tight">
                            <div className="text-xs font-semibold">Adicionar link</div>
                            <div className="text-[10px] text-muted-foreground">URL externa</div>
                          </div>
                        </Button>
                      </div>

                      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <AkurisAIIcon size={12} className="mt-0.5 text-primary shrink-0" />
                        Após anexar, clique em <strong className="mx-0.5 text-foreground">Validar com IA</strong> para confirmar a aderência ao requisito.
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
                        <p className="text-[11px] text-muted-foreground">{uploading ? 'Enviando...' : 'Ou arraste arquivos aqui'}</p>
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
                              validation?.verdict === 'conforme' ? 'Conforme' :
                              validation?.verdict === 'parcial' ? 'Parcial' :
                              validation?.verdict === 'nao_conforme' ? 'Não conforme' :
                              validation?.verdict === 'indeterminado' ? 'Indeterminado' : '';
                            return (
                              <div key={index} className="rounded bg-muted/50 p-2 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {file.type === 'link' ? <ExternalLink className="h-3.5 w-3.5 text-info shrink-0" strokeWidth={1.5} /> : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />}
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
                                              className="h-7 px-2 text-[11px]"
                                              disabled={isValidating}
                                              onClick={() => handleValidateEvidence(file)}
                                            >
                                              {isValidating ? (
                                                <AkurisPulse size={12} />
                                              ) : (
                                                <AkurisAIIcon size={12} className="mr-1 text-primary" />
                                              )}
                                              {isValidating ? 'Analisando...' : 'Validar com IA'}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>A IA analisa o arquivo e diz se ele atende ao requisito.</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleRemoveFile(index)}>
                                      <X className="h-3 w-3" strokeWidth={1.5} />
                                    </Button>
                                  </div>
                                </div>
                                {validation && (
                                  <div className={cn('rounded border px-2 py-1.5 text-[11px]', verdictColor)}>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="font-semibold">IA: {verdictLabel}</span>
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
                          onLinked={() => loadData()}
                        />
                      </div>
                    </div>
                  </JourneyStep>

                  {/* ===== STEP 3: Plano de Ação (condicional) ===== */}
                  {requiresPlanoStep && (
                    <JourneyStep
                      number={3}
                      title="Plano de Ação"
                      description="Requisito não conforme — defina como será adequado"
                      state={planoStepDone ? 'complete' : 'active'}
                      badge={
                        planoAcaoVinculado
                          ? getPlanoStatusBadge(planoAcaoVinculado.status)
                          : <Badge variant="warning" className="text-[10px]">Sem plano</Badge>
                      }
                    >
                      {planoAcaoVinculado ? (
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{planoAcaoVinculado.titulo}</p>
                            {planoAcaoVinculado.prazo && (
                              <span className="text-xs text-muted-foreground">Prazo: {new Date(planoAcaoVinculado.prazo).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => window.open('/planos-acao', '_blank')}>
                            <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30">
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                            <p className="text-xs text-foreground">
                              Como este requisito não está conforme, recomendamos criar um plano de ação para tratá-lo.
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setPlanoAcaoDialogOpen(true)}>
                            <ClipboardList className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
                            Criar Plano de Ação
                          </Button>
                        </div>
                      )}
                      <div className="mt-3 space-y-1.5">
                        <Label htmlFor="plano" className="text-xs">Notas do Plano (opcional)</Label>
                        <Textarea
                          id="plano" placeholder="Ações necessárias, marcos, dependências..."
                          value={formData.plano_acao}
                          onChange={(e) => setFormData(prev => ({ ...prev, plano_acao: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    </JourneyStep>
                  )}

                  {/* ===== STEP 4: Detalhes da Avaliação ===== */}
                  <JourneyStep
                    number={requiresPlanoStep ? 4 : 3}
                    title="Detalhes da Avaliação"
                    description="Responsável, prazo e observações"
                    state={detalhesDone ? 'complete' : 'pending'}
                    badge={detalhesDone ? <Badge variant="success" className="text-[10px]">Completo</Badge> : <Badge variant="outline" className="text-[10px]">Opcional</Badge>}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="responsavel" className="text-xs">Responsável</Label>
                          <Select
                            value={formData.responsavel_avaliacao}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, responsavel_avaliacao: value }))}
                          >
                            <SelectTrigger id="responsavel"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                            <SelectContent>
                              {users.map(user => (
                                <SelectItem key={user.user_id} value={user.user_id}>{user.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="prazo" className="text-xs flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />Prazo
                          </Label>
                          <input
                            id="prazo" type="date"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.prazo_implementacao}
                            onChange={(e) => setFormData(prev => ({ ...prev, prazo_implementacao: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="observacoes" className="text-xs">Observações</Label>
                        <Textarea
                          id="observacoes" placeholder="Informações adicionais, contexto, justificativas..."
                          value={formData.observacoes}
                          onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    </div>
                  </JourneyStep>

                  {/* ===== STEP 5: Vínculos & Histórico (colapsado) ===== */}
                  <JourneyStep
                    number={requiresPlanoStep ? 5 : 4}
                    title="Vínculos & Histórico"
                    description="Riscos relacionados e linha do tempo de alterações"
                    state="pending"
                    badge={formData.riscos_vinculados.length > 0 ? <Badge variant="secondary" className="text-[10px]">{formData.riscos_vinculados.length} risco(s)</Badge> : undefined}
                    defaultOpen={false}
                    collapsible
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                          <p className="text-xs font-medium text-foreground">Riscos Vinculados</p>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                          {riscos.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">Nenhum risco cadastrado</p>
                          ) : (
                            riscos.map(risco => (
                              <label key={risco.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded text-sm">
                                <input type="checkbox" checked={formData.riscos_vinculados.includes(risco.id)} onChange={() => handleToggleRisco(risco.id)} className="rounded" />
                                <span className="font-medium text-xs">{risco.nome}</span>
                                <Badge variant="outline" className="ml-auto text-[10px]">{risco.nivel_risco_inicial}</Badge>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <History className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                          <p className="text-xs font-medium text-foreground">Histórico de Alterações</p>
                        </div>
                        <div className="max-h-48 overflow-y-auto border rounded-md">
                          <AuditTrailTimeline requirementId={requirement.id} frameworkId={frameworkId} />
                        </div>
                      </div>
                    </div>
                  </JourneyStep>

                </div>
              </div>
            </div>
          )}
        </div>
      </DialogShell>

      <PlanoAcaoDialog
        open={planoAcaoDialogOpen}
        onOpenChange={setPlanoAcaoDialogOpen}
        onSave={handleSavePlanoAcao}
        loading={savingPlano}
        plano={{
          titulo: `Adequar: ${requirement.codigo} - ${requirement.titulo}`,
          descricao: requirement.descricao || '',
          prioridade: (requirement.peso || 0) >= 3 ? 'alta' : 'media',
          modulo_origem: 'frameworks',
          registro_origem_titulo: `${requirement.codigo} - ${requirement.titulo}`,
        }}
      />

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" strokeWidth={1.5} />
              Adicionar link como evidência
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="link-url" className="text-xs">URL <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="link-name" className="text-xs">Nome do link (opcional)</Label>
              <Input
                id="link-name"
                placeholder="Ex.: Política de Segurança no Confluence"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Se vazio, usaremos o domínio da URL.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const url = linkUrl.trim();
                if (!url) { toast.error('Informe a URL'); return; }
                let safeName = linkName.trim();
                if (!safeName) {
                  try { safeName = new URL(url).hostname; } catch { safeName = url; }
                }
                setFormData(prev => ({
                  ...prev,
                  evidence_files: [...prev.evidence_files, { type: 'link', name: safeName, url }],
                }));
                setLinkDialogOpen(false);
                toast.success('Link adicionado como evidência');
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
