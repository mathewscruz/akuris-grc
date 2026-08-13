import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { DialogShell } from '@/components/ui/dialog-shell';
import { DOCGEN_DIALOG_DESCRIPTION } from '@/components/documentos/docgen-copy';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFrameworkRequirementCount } from '@/hooks/useFrameworkRequirementCount';
import { akurisToast } from '@/lib/akuris-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Send, FileText, Download, Save, Plus, History, ArrowLeft } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import DocLayoutBuilder from './DocLayoutBuilder';
import { DocGenTemplateGallery } from './DocGenTemplateGallery';
import { DocGenBriefing } from './DocGenBriefing';
import { DocGenContextPanel } from './DocGenContextPanel';
import { DocGenSectionRefiner } from './DocGenSectionRefiner';
import { DocGenAdherencePanel, type AdherenceResult } from './DocGenAdherencePanel';
import {
  buildSeedPrompt,
  type BriefingDefaults,
  type DocGenTemplate,
} from '@/lib/docgen-templates';
import { formatStatus } from '@/lib/text-utils';
import { DocumentoDialog } from '@/components/documentos/DocumentoDialog';
import { buildDocGenDocxBlob, type DocxLabels } from '@/lib/docgen-docx';
import { buildDocGenPdfBlob } from '@/lib/docgen-pdf';
import { DocGenMarkdown } from './DocGenMarkdown';
import { CreditsExhaustedDialog } from '@/components/CreditsExhaustedDialog';
import { useAuth } from '@/components/AuthProvider';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

/** Tempo máximo (ms) que o frontend espera por uma chamada do docgen-chat. */
const DOCGEN_TIMEOUT_MS = 120_000;

type DocGenCallResult = {
  data?: any;
  /** Créditos de IA esgotados — abrir CreditsExhaustedDialog. */
  credits?: boolean;
  /** Estourou o tempo limite do cliente. */
  timeout?: boolean;
  error?: string;
};

/**
 * Wrapper único das chamadas ao docgen-chat: aplica timeout no cliente
 * (a plataforma corta em ~150s sem resposta útil) e normaliza os erros
 * 402/403 do gateway de IA em `credits`.
 */
async function callDocGen(body: Record<string, unknown>, timeoutMs = DOCGEN_TIMEOUT_MS): Promise<DocGenCallResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const invocation = supabase.functions.invoke('docgen-chat', { body });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('__DOCGEN_TIMEOUT__')), timeoutMs);
    });
    const { data, error } = (await Promise.race([invocation, timeout])) as any;
    if (error) {
      let payload: any = null;
      try { payload = await (error as any)?.context?.json?.(); } catch { /* corpo não-JSON */ }
      if (payload?.code === 'CREDITS_EXHAUSTED' || payload?.error === 'CREDITS_EXHAUSTED') return { credits: true };
      return { error: payload?.error || error.message };
    }
    if (data?.code === 'CREDITS_EXHAUSTED' || data?.error === 'CREDITS_EXHAUSTED') return { credits: true };
    if (data?.error === 'INVALID_DOCUMENT') return { error: 'INVALID_DOCUMENT' };
    return { data };
  } catch (e: any) {
    if (e?.message === '__DOCGEN_TIMEOUT__') return { timeout: true };
    return { error: e?.message || 'Erro inesperado' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DocGenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentSaved?: () => void;
  frameworkName?: string;
  frameworkId?: string;
  /** 'generate' (default) opens chat. 'validate' shows validator entry hint. */
  mode?: 'generate' | 'validate';
  /** When opened from inside a requirement, gives the AI extra context. */
  requirementContext?: {
    requirementId: string;
    requirementCode: string;
    requirementTitle: string;
  };
}

interface TooltipTerm {
  term: string;
  definition: string;
}



export const DocGenDialog: React.FC<DocGenDialogProps> = ({
  open,
  onOpenChange,
  onDocumentSaved,
  frameworkName,
  frameworkId,
  mode = 'generate',
  requirementContext,
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const TOOLTIPS: Record<string, string> = {
    'BIA': t('docgen.tooltips.bia'),
    'ROPA': t('docgen.tooltips.ropa'),
    'RTO': t('docgen.tooltips.rto'),
    'ISO': t('docgen.tooltips.iso'),
    'LGPD': t('docgen.tooltips.lgpd'),
    'SLA': t('docgen.tooltips.sla'),
    'KPI': t('docgen.tooltips.kpi'),
    'PDCA': t('docgen.tooltips.pdca'),
  };
  const navigate = useNavigate();
  const { company } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [documentReady, setDocumentReady] = useState(false);
  const [currentDocType, setCurrentDocType] = useState<string | null>(null);
  const [currentDocName, setCurrentDocName] = useState<string | null>(null);
  const [generatedDocument, setGeneratedDocument] = useState<any>(null);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingAutoGenerateRef = useRef(false);

  // Dialog de criação via DocGen
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [docCategorias, setDocCategorias] = useState<any[]>([]);
  const [initialGeneratedFile, setInitialGeneratedFile] = useState<File | null>(null);

  // Rastreia score anterior para calcular delta após refinos.
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  // Confirmação antes de publicar quando o score está baixo.
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);


  // Buscar informações do usuário
  const [userInfo, setUserInfo] = useState<{ user_id: string; empresa_id: string; nome: string } | null>(null);

  // Histórico de conversas
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<Array<{ id: string; titulo: string; tipo_documento_identificado: string | null; updated_at: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // AlertDialog de descarte
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  // Fluxo guiado: gallery → briefing → chat
  type DocGenPhase = 'gallery' | 'briefing' | 'chat';
  const [phase, setPhase] = useState<DocGenPhase>('gallery');
  const [selectedTemplate, setSelectedTemplate] = useState<DocGenTemplate | null>(null);
  const [briefingValue, setBriefingValue] = useState<BriefingDefaults | null>(null);

  // Framework efetivo para alinhar a IA aos requisitos: quando o DocGen é aberto
  // pelo Gap Analysis vem via prop; quando é aberto pela tela de Documentos (a
  // partir de um template), resolvemos o framework escolhido no briefing para o
  // seu ID — assim a IA recebe os requisitos de QUALQUER framework, não só ISO.
  const briefingFrameworks = briefingValue?.frameworks ?? (frameworkName ? [frameworkName] : []);
  const { data: fwReqData } = useFrameworkRequirementCount(briefingFrameworks);
  const effFrameworkName = frameworkName || briefingFrameworks[0];
  const effFrameworkId = frameworkId || fwReqData?.matchedIds?.[0];

  // Onda 2: contexto da empresa carregado via edge function
  const [companyContext, setCompanyContext] = useState<import('./DocGenContextPanel').CompanyContext | null>(null);
  const [companyContextLoading, setCompanyContextLoading] = useState(false);

  // Onda 3: refino por seção + aderência inline
  const [refiningSectionIndex, setRefiningSectionIndex] = useState<number | null>(null);
  const [sectionRefineLoading, setSectionRefineLoading] = useState(false);
  const [adherenceResult, setAdherenceResult] = useState<AdherenceResult | null>(null);
  const [adherenceLoading, setAdherenceLoading] = useState(false);

  const buildDefaultBriefing = (): BriefingDefaults => ({
    docType: 'politica',
    frameworks: frameworkName ? [frameworkName] : [],
    scope: requirementContext
      ? `Atender ao requisito ${requirementContext.requirementCode} — ${requirementContext.requirementTitle}`
      : '',
    audience: t('docgen.dialog.defaultAudience'),
    tone: 'formal',
    language: 'pt-BR',
    length: 'padrao',
  });

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, empresa_id')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setUserInfo({
            user_id: user.id,
            empresa_id: profile.empresa_id,
            nome: profile.nome
          });
        }
      }
    };

    if (open) {
      fetchUserInfo();
      // Carregar categorias para o diálogo de criação
      const fetchCategorias = async () => {
        try {
          const { data } = await supabase
            .from('documentos_categorias')
            .select('*')
            .order('nome');
          setDocCategorias(data || []);
        } catch (e) {
          console.error('Erro ao carregar categorias:', e);
        }
      };
      fetchCategorias();
      // Reset para a galeria ao abrir, exceto se já há conversa em andamento (preserva estado).
      setPhase(prev => (messages.length > 0 ? 'chat' : 'gallery'));
      // Foco no input ao abrir (caso já estejamos no chat)
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, frameworkName, requirementContext]);

  // Onda 2: carrega contexto da empresa via edge function quando o dialog abre e userInfo está pronto
  useEffect(() => {
    if (!open || !userInfo?.empresa_id) return;
    if (companyContext || companyContextLoading) return;
    let cancelled = false;
    (async () => {
      setCompanyContextLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('docgen-chat', {
          body: {
            action: 'load_company_context',
            user_id: userInfo.user_id,
            empresa_id: userInfo.empresa_id,
          },
        });
        if (!cancelled && !error && data?.company_context) {
          setCompanyContext(data.company_context);
        }
      } catch (e) {
        console.error('Erro ao carregar contexto da empresa:', e);
      } finally {
        if (!cancelled) setCompanyContextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, userInfo?.empresa_id]);

  // Auto scroll para última mensagem (rola só o container do chat).
  // Só rola automaticamente se o usuário já estava perto do fim — assim
  // não interrompe a leitura de mensagens antigas.
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    if (nearBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages, isLoading]);

  // Foco no input quando IA termina de responder
  useEffect(() => {
    if (!isLoading && open) {
      inputRef.current?.focus();
    }
  }, [isLoading, open]);

  // Auto-gerar documento quando o briefing pediu "Gerar direto" e a IA já respondeu o seed.
  useEffect(() => {
    if (!pendingAutoGenerateRef.current) return;
    if (isLoading || isGeneratingDoc) return;
    if (!conversationId || !userInfo) return;
    if (generatedDocument) {
      pendingAutoGenerateRef.current = false;
      return;
    }
    // Precisa de pelo menos a resposta do seed (assistant + user + assistant).
    if (messages.length < 2) return;
    pendingAutoGenerateRef.current = false;
    generateDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isGeneratingDoc, conversationId, messages.length, generatedDocument, userInfo]);

  const sendMessageInternal = async (text: string, displayText?: string) => {
    if (!text.trim() || !userInfo || isLoading) return;

    // `text` é o que a IA recebe; `displayText` (opcional) é o que aparece no chat.
    // Usado para não poluir a conversa com o briefing técnico completo.
    const userMessage: ChatMessage = {
      role: 'user',
      content: displayText ?? text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await callDocGen({
        message: text,
        conversation_id: conversationId,
        user_id: userInfo.user_id,
        empresa_id: userInfo.empresa_id,
        action: 'chat',
        ...(effFrameworkName && { framework_context: { framework_name: effFrameworkName, framework_id: effFrameworkId } }),
        ...(requirementContext && { requirement_context: requirementContext }),
        ...(companyContext && { company_context: companyContext }),
      });

      if (res.credits) { setShowCreditsDialog(true); return; }
      if (res.timeout) {
        toast({ title: t('docgen.dialog.timeoutTitle'), description: t('docgen.dialog.timeoutDescription'), variant: 'destructive' });
        return;
      }
      if (res.error) throw new Error(res.error);
      const data = res.data;


      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setConversationId(data.conversation_id);
      setCurrentDocType(data.tipo_documento_identificado);
      setCurrentDocName(data.documento_nome_identificado || null);
      setDocumentReady(data.documento_pronto);

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: t('docgen.dialog.errorTitle'),
        description: t('docgen.dialog.sendMessageError'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refineDocumentWithInstruction = async (instruction: string) => {
    if (!userInfo || !generatedDocument || isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content: instruction, timestamp: new Date() }]);
    setIsLoading(true);
    try {
      const res = await callDocGen({
        action: 'refine_document',
        user_id: userInfo.user_id,
        empresa_id: userInfo.empresa_id,
        conversation_id: conversationId,
        document: generatedDocument,
        instruction,
        ...(effFrameworkName && { framework_context: { framework_name: effFrameworkName, framework_id: effFrameworkId } }),
        ...(companyContext && { company_context: companyContext }),
      });
      if (res.credits) { setShowCreditsDialog(true); return; }
      if (res.timeout) {
        toast({ title: t('docgen.dialog.timeoutTitle'), description: t('docgen.dialog.timeoutDescription'), variant: 'destructive' });
        return;
      }
      if (res.error) throw new Error(res.error);
      const data = res.data;

      if (data?.document) {
        setGeneratedDocument({
          ...data.document,
          data_criacao: generatedDocument.data_criacao || new Date().toISOString().slice(0, 10),
        });
        setAdherenceResult(null);
        const summary: string = data.summary || t('docgen.dialog.documentUpdatedDefault');
        setMessages(prev => [...prev, { role: 'assistant', content: summary, timestamp: new Date() }]);
        const impact = data?.compliance_impact;
        const tone = impact === 'reduced' ? 'warning' as const : 'success' as const;
        const title = impact === 'reduced' ? t('docgen.dialog.complianceImpacted') : t('docgen.dialog.documentUpdated');
        akurisToast({ module: 'documentos', tone, title, description: summary });
      }
    } catch (err) {
      console.error('Erro ao refinar documento:', err);
      toast({ title: t('docgen.dialog.errorTitle'), description: t('docgen.dialog.refineDocumentError'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    const text = inputMessage;
    setInputMessage('');
    // Após o documento existir, cada mensagem do usuário refina o documento inteiro.
    if (generatedDocument) {
      await refineDocumentWithInstruction(text);
      return;
    }
    await sendMessageInternal(text);
  };

  /** Compor saudação inicial e disparar prompt-semente automaticamente. */
  const enterChatPhase = async (briefing: BriefingDefaults, templateHint?: string) => {
    setBriefingValue(briefing);
    setPhase('chat');
    const autoGen = briefing.directGenerate !== false;
    pendingAutoGenerateRef.current = autoGen;
    // Saudação curta + contexto do briefing
    const empNome = companyContext?.empresa?.nome;
    const greeting = autoGen
      ? (empNome
          ? t('docgen.dialog.greetingDirectWithCompany', { company: empNome })
          : t('docgen.dialog.greetingDirectNoCompany'))
      : (empNome
          ? t('docgen.dialog.greetingChatWithCompany', { company: empNome })
          : t('docgen.dialog.greetingChatNoCompany'));
    setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
    setTimeout(() => inputRef.current?.focus(), 100);
    const seed = buildSeedPrompt(briefing, templateHint);
    const fwSuffix = briefing.frameworks?.length ? t('docgen.dialog.alignedTo', { frameworks: briefing.frameworks.join(', ') }) : '';
    const briefingSummary = autoGen
      ? t('docgen.dialog.briefingSummaryDirect', { fwSuffix })
      : t('docgen.dialog.briefingSummaryChat', { fwSuffix });
    const waitForContext = async () => {
      const deadline = Date.now() + 3000;
      while (companyContextLoading && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100));
      }
      sendMessageInternal(seed, briefingSummary);
    };
    setTimeout(waitForContext, 50);
  };

  const handlePickTemplate = (tpl: DocGenTemplate) => {
    setSelectedTemplate(tpl);
    // Mescla defaults do template com framework do contexto, se houver
    const merged: BriefingDefaults = {
      ...tpl.briefingDefaults,
      frameworks: Array.from(new Set([
        ...tpl.briefingDefaults.frameworks,
        ...(frameworkName ? [frameworkName] : []),
      ])),
    };
    setBriefingValue(merged);
    setPhase('briefing');
  };

  const handleStartBlank = () => {
    setSelectedTemplate(null);
    setBriefingValue(buildDefaultBriefing());
    setPhase('briefing');
  };

  // ===== Onda 3: refinar seção =====
  const handleRefineSection = async (instruction: string) => {
    if (refiningSectionIndex === null || !generatedDocument || !userInfo) return;
    setSectionRefineLoading(true);
    try {
      const res = await callDocGen({
        action: 'refine_section',
        user_id: userInfo.user_id,
        empresa_id: userInfo.empresa_id,
        conversation_id: conversationId,
        document: generatedDocument,
        section_index: refiningSectionIndex,
        instruction,
        ...(effFrameworkName && { framework_context: { framework_name: effFrameworkName, framework_id: effFrameworkId } }),
      });
      if (res.credits) { setShowCreditsDialog(true); return; }
      if (res.timeout) {
        toast({ title: t('docgen.dialog.timeoutTitle'), description: t('docgen.dialog.timeoutDescription'), variant: 'destructive' });
        return;
      }
      if (res.error) throw new Error(res.error);
      const data = res.data;
      if (data?.document) {
        setGeneratedDocument(data.document);
        setAdherenceResult(null); // invalida análise prévia
        akurisToast({ module: 'documentos', tone: 'success', title: t('docgen.dialog.sectionRefinedTitle'), description: t('docgen.dialog.sectionRefinedDescription') });
        setRefiningSectionIndex(null);
      }
    } catch (e) {
      console.error('Erro ao refinar seção:', e);
      toast({ title: t('docgen.dialog.errorTitle'), description: t('docgen.dialog.refineSectionError'), variant: 'destructive' });
    } finally {
      setSectionRefineLoading(false);
    }
  };

  // ===== Onda 3: aderência inline =====
  const handleRunAdherence = async () => {
    if (!generatedDocument || !userInfo || !frameworkId) return;
    setAdherenceLoading(true);
    try {
      const res = await callDocGen({
        action: 'quick_adherence',
        user_id: userInfo.user_id,
        empresa_id: userInfo.empresa_id,
        conversation_id: conversationId,
        document: generatedDocument,
        framework_context: { framework_name: frameworkName, framework_id: frameworkId },
      });
      if (res.credits) { setShowCreditsDialog(true); return; }
      if (res.timeout) {
        toast({ title: t('docgen.dialog.timeoutTitle'), description: t('docgen.dialog.timeoutDescription'), variant: 'destructive' });
        return;
      }
      if (res.error) throw new Error(res.error);
      if (res.data?.adherence) setAdherenceResult(res.data.adherence);
    } catch (e) {
      console.error('Erro na aderência:', e);
      toast({ title: t('docgen.dialog.errorTitle'), description: t('docgen.dialog.adherenceError'), variant: 'destructive' });
    } finally {
      setAdherenceLoading(false);
    }
  };

  /**
   * Auto-refino gap-driven: o servidor faz UMA tentativa por chamada
   * (evita estourar o timeout da plataforma). O frontend encadeia as
   * tentativas até convergir ou atingir o máximo.
   */
  const runAutoRefine = async (
    doc: any,
    frameworkIds: string[] | undefined,
    maxAttempts: number,
  ): Promise<any> => {
    let current = doc;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await callDocGen({
        action: 'auto_refine',
        user_id: userInfo!.user_id,
        empresa_id: userInfo!.empresa_id,
        conversation_id: conversationId,
        document: current,
        refine_attempt: attempt,
        ...(effFrameworkName && {
          framework_context: {
            framework_name: effFrameworkName,
            framework_id: effFrameworkId,
            framework_ids: frameworkIds,
          },
        }),
      });
      if (res.credits) { setShowCreditsDialog(true); break; }
      if (res.timeout || res.error || !res.data?.document) break;
      current = { ...res.data.document, data_criacao: current.data_criacao };
      setGeneratedDocument(current);
      if (res.data.changed) {
        akurisToast({
          module: 'documentos',
          tone: 'success',
          title: t('docgen.dialog.autoRefineDoneTitle'),
          description: t('docgen.dialog.autoRefineDoneDescription', { score: String(res.data.after ?? '') }),
        });
      }
      if (!res.data.should_continue) break;
    }
    return current;
  };

  const generateDocument = async () => {
    if (!userInfo || !conversationId || isGeneratingDoc) return;

    setIsGeneratingDoc(true);

    try {
      const res = await callDocGen({
        conversation_id: conversationId,
        user_id: userInfo.user_id,
        empresa_id: userInfo.empresa_id,
        action: 'generate_document',
        doc_type_hint: currentDocName || currentDocType,
        ...(effFrameworkName && { framework_context: { framework_name: effFrameworkName, framework_id: effFrameworkId, framework_ids: fwReqData?.matchedIds } }),
        ...(requirementContext && { requirement_context: requirementContext }),
      });

      if (res.credits) { setShowCreditsDialog(true); return; }
      if (res.timeout) {
        toast({ title: t('docgen.dialog.timeoutTitle'), description: t('docgen.dialog.timeoutDescription'), variant: 'destructive' });
        return;
      }
      if (res.error === 'INVALID_DOCUMENT') {
        toast({
          title: t('docgen.dialog.invalidDocumentTitle'),
          description: t('docgen.dialog.invalidDocumentDescription'),
          variant: 'destructive',
        });
        return;
      }
      if (res.error) throw new Error(res.error);
      const data = res.data;

      // A IA não conhece a data atual (chuta valores errados). Fixamos a data
      // real do usuário na capa/preview/export, independentemente do que veio.
      const doc = {
        ...data.document,
        data_criacao: new Date().toISOString().slice(0, 10),
      };
      setGeneratedDocument(doc);
      toast({
        title: t('docgen.dialog.documentGeneratedTitle'),
        description: t('docgen.dialog.documentGeneratedDescription'),
      });

      // Auto-refino em chamadas separadas, para não estourar o timeout.
      if (data?.should_auto_refine) {
        akurisToast({
          module: 'documentos',
          tone: 'info',
          title: t('docgen.dialog.autoRefineTitle'),
          description: t('docgen.dialog.autoRefineDescription'),
        });
        await runAutoRefine(doc, data.framework_ids, Number(data.max_refine_attempts) || 2);
      }


    } catch (error) {
      console.error('Erro ao gerar documento:', error);
      toast({
        title: t('docgen.dialog.errorTitle'),
        description: t('docgen.dialog.generateDocumentError'),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDoc(false);
    }
  };


  /**
   * Rótulos usados pelos exportadores (DOCX/PDF). Ficam aqui porque dependem
   * do idioma ativo e dos metadados do documento.
   */
  const buildExportLabels = (docLike: any): DocxLabels => ({
    summary: t('docgen.dialog.summary'),
    section: t('docgen.dialog.section'),
    versaoText: t('docgen.dialog.versao', { versao: docLike?.versao || '1.0' }),
    emissionDateText: t('docgen.dialog.emissionDate', {
      date: docLike?.data_criacao || new Date().toISOString().slice(0, 10),
    }),
    classificationText: t('docgen.dialog.classification', {
      classification: docLike?.metadados?.classificacao || 'Interno',
    }),
    footerPage: t('docgen.dialog.footerPage'),
    of: t('docgen.dialog.of'),
    glossary: t('docgen.dialog.glossary'),
    glossaryTerm: t('docgen.dialog.glossaryTerm'),
    glossaryDefinition: t('docgen.dialog.glossaryDefinition'),
    versionHistory: t('docgen.dialog.versionHistory'),
    versionCol: t('docgen.dialog.versionCol'),
    dateCol: t('docgen.dialog.dateCol'),
    authorCol: t('docgen.dialog.authorCol'),
    descriptionCol: t('docgen.dialog.descriptionCol'),
    coverage: t('docgen.dialog.coverage'),
    requirementCol: t('docgen.dialog.requirementCol'),
    sectionsCol: t('docgen.dialog.sectionsCol'),
    evidenceCol: t('docgen.dialog.evidenceCol'),
  });

  /** Documento normalizado para exportação (logo da empresa como fallback). */
  const buildExportPayload = () => {
    const empresaNome = (userInfo as any)?.empresa_nome || (companyInfo as any)?.nome || '';
    const docForExport = {
      ...generatedDocument,
      metadados: {
        ...(generatedDocument?.metadados || {}),
        logo_url: generatedDocument?.metadados?.logo_url || companyInfo?.logo_url,
      },
    };
    return { docForExport, options: { empresaNome, labels: buildExportLabels(docForExport) } };
  };

  const generateDocxBlob = async () => {
    if (!generatedDocument) return null;
    const { docForExport, options } = buildExportPayload();
    return buildDocGenDocxBlob(docForExport, options);
  };

  const generatePdfBlob = async () => {
    if (!generatedDocument) return null;
    const { docForExport, options } = buildExportPayload();
    return buildDocGenPdfBlob(docForExport, options);
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!generatedDocument) return;
    try {
      // Usar o logo da empresa automaticamente
      if (companyInfo?.logo_url && !generatedDocument.metadados?.logo_url) {
        setGeneratedDocument(prev => ({
          ...prev,
          metadados: {
            ...prev.metadados,
            logo_url: companyInfo.logo_url
          }
        }));
      }

      const blob = format === 'pdf' ? await generatePdfBlob() : await generateDocxBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedDocument.titulo}.${format === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsDocumentExported(true);
      setHasUnsavedChanges(false);
      toast({ title: t('docgen.dialog.exportedTitle'), description: t('docgen.dialog.exportedDescription', { format: format.toUpperCase() }) });
    } catch (e) {
      console.error('Erro ao exportar documento:', e);
      toast({ title: t('docgen.dialog.exportError'), description: t('docgen.dialog.exportErrorDescription'), variant: 'destructive' });
    }
  };

  const handleOpenCreateDialog = async () => {
    if (!generatedDocument) return;
    try {
      const blob = await generateDocxBlob();
      if (!blob) return;
      const file = new File(
        [blob],
        `${generatedDocument.titulo}.docx`,
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      );
      setInitialGeneratedFile(file);
      setShowCreateDialog(true);
    } catch (e) {
      console.error('Erro ao preparar arquivo:', e);
      toast({ title: t('docgen.dialog.errorTitle'), description: t('docgen.dialog.prepareFileError'), variant: 'destructive' });
    }
  };

  /**
   * Handler do botão "Salvar em Documentos".
   * Se o score de compliance estiver abaixo de 80, mostra confirmação antes de
   * abrir o diálogo de salvar — evita publicar um rascunho capenga por acidente.
   * O score é derivado do `_initial_score` que o próprio backend calcula.
   */
  const handleSaveClick = async () => {
    if (currentScore !== null && currentScore < 80) {
      setPublishConfirmOpen(true);
      return;
    }
    await handleOpenCreateDialog();
  };


  const formatMessage = (content: string) => {
    // Processar markdown básico
    let formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **texto** -> bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // *texto* -> italic
      .replace(/\n/g, '<br />'); // quebras de linha

    // Processar listas numeradas
    formatted = formatted.replace(/(\d+\.\s.*?)(<br \/>|$)/g, '<div class="ml-4 mb-1">$1</div>');
    
    return { __html: formatted };
  };

  const renderMessageContent = (content: string) => {
    // Primeiro, processar as tags de código
    const codeBlocks = content.split(/```([\s\S]*?)```/);
    const parts: React.ReactNode[] = [];
    
    codeBlocks.forEach((block, index) => {
      if (index % 2 === 0) {
        // Texto normal - processar tooltips e formatação
        const textParts = renderTextWithFormatting(block);
        parts.push(...textParts);
      } else {
        // Bloco de código
        parts.push(
          <pre key={`code-${index}`} className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto my-2">
            <code>{block.trim()}</code>
          </pre>
        );
      }
    });
    
    return parts;
  };

  const renderTextWithFormatting = (text: string) => {
    const parts: React.ReactNode[] = [];
    let processedText = text;
    
    // Processar listas numeradas
    processedText = processedText.replace(/(\d+\.\s+[^\n]+)/g, '<li class="ml-4 mb-1">$1</li>');
    
    // Processar negrito
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Processar itálico
    processedText = processedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Dividir por quebras de linha para processar parágrafo por parágrafo
    const paragraphs = processedText.split('\n\n');
    
    paragraphs.forEach((paragraph, pIndex) => {
      if (paragraph.trim()) {
        const lines = paragraph.split('\n');
        lines.forEach((line, lIndex) => {
          if (line.trim()) {
            // Processar tooltips na linha
            const lineWithTooltips = renderLineWithTooltips(line.trim());
            parts.push(
              <div key={`p-${pIndex}-l-${lIndex}`} className="mb-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lineWithTooltips, { ALLOWED_TAGS: ['strong', 'em', 'br', 'span', 'div', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'thead', 'tbody'], ALLOWED_ATTR: ['class', 'style', 'title'] }) }} />
            );
          }
        });
        if (pIndex < paragraphs.length - 1) {
          parts.push(<br key={`br-${pIndex}`} />);
        }
      }
    });
    
    return parts;
  };

  const escapeHtmlAttr = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const renderLineWithTooltips = (line: string): string => {
    let processedLine = line;

    Object.entries(TOOLTIPS).forEach(([term, definition]) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const safeDef = escapeHtmlAttr(definition);
      processedLine = processedLine.replace(regex, (match) => {
        return `<span class="underline decoration-dotted text-primary cursor-help" title="${safeDef}">${match}</span>`;
      });
    });

    return processedLine;
  };

  // Estado para tracking de mudanças não salvas
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDocumentSaved, setIsDocumentSaved] = useState(false);
  const [isDocumentExported, setIsDocumentExported] = useState(false);

  // Buscar informações da empresa (incluindo logo)
  const [companyInfo, setCompanyInfo] = useState<{ logo_url?: string } | null>(null);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      if (userInfo?.empresa_id) {
        try {
          const { data: empresa } = await supabase
            .from('empresas')
            .select('logo_url')
            .eq('id', userInfo.empresa_id)
            .single();
          
          setCompanyInfo(empresa);
        } catch (error) {
          console.error('Erro ao buscar informações da empresa:', error);
        }
      }
    };

    if (userInfo) {
      fetchCompanyInfo();
    }
  }, [userInfo]);

  // Track mudanças no documento gerado
  useEffect(() => {
    if (generatedDocument) {
      setHasUnsavedChanges(true);
      setIsDocumentSaved(false);
      setIsDocumentExported(false);
    }
  }, [generatedDocument]);

  // Score ao vivo + delta: guarda o score anterior antes de aplicar o novo.
  // Depende só do documento gerado atual — o próprio backend garante que
  // `_initial_score` é recalculado a cada refino sem consumir crédito extra.
  const currentScore: number | null =
    typeof generatedDocument?._initial_score === 'number' ? generatedDocument._initial_score : null;
  useEffect(() => {
    if (currentScore === null) {
      setPreviousScore(null);
      return;
    }
    setPreviousScore((prev) => {
      // Primeira medição: sem delta. Depois, mantém o valor anterior para calcular delta.
      if (prev === null) return currentScore;
      return prev === currentScore ? prev : prev;
    });
    // Depois que renderizamos com o delta, o "anterior" precisa passar a ser o atual
    // para a próxima medição. Fazemos isso via microtask para preservar 1 render de delta.
    const t = setTimeout(() => setPreviousScore(currentScore), 4000);
    return () => clearTimeout(t);
  }, [currentScore]);
  const scoreDelta =
    currentScore !== null && previousScore !== null && previousScore !== currentScore
      ? currentScore - previousScore
      : null;


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia, Shift+Enter quebra linha. Ignora durante composição IME (acentos compostos).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Verificar mudanças antes de fechar
  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges && !isDocumentSaved && !isDocumentExported) {
      setDiscardDialogOpen(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const confirmDiscardAndClose = () => {
    setDiscardDialogOpen(false);
    setHasUnsavedChanges(false);
    onOpenChange(false);
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setGeneratedDocument(null);
    setDocumentReady(false);
    setCurrentDocType(null);
    setCurrentDocName(null);
    setHasUnsavedChanges(false);
    setIsDocumentSaved(false);
    setIsDocumentExported(false);
    setIsEditingLayout(false);
    setSelectedTemplate(null);
    setBriefingValue(null);
    setPhase('gallery');
  };

  const loadHistory = async () => {
    if (!userInfo) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('docgen_conversations')
        .select('id, titulo, tipo_documento_identificado, updated_at')
        .eq('empresa_id', userInfo.empresa_id)
        .eq('user_id', userInfo.user_id)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistoryItems(data || []);
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
      toast({ title: t('docgen.dialog.errorTitle'), description: t('docgen.dialog.historyLoadError'), variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadConversation = async (conversationIdToLoad: string) => {
    if (!userInfo) return;
    try {
      const { data, error } = await supabase
        .from('docgen_conversations')
        .select('*')
        .eq('id', conversationIdToLoad)
        .eq('empresa_id', userInfo.empresa_id)
        .eq('user_id', userInfo.user_id)
        .single();
      if (error) throw error;
      if (!data) return;

      const restoredMessages: ChatMessage[] = ((data.mensagens as any[]) || []).map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(),
      }));
      setMessages(restoredMessages.length > 0 ? restoredMessages : [{
        role: 'assistant',
        content: t('docgen.dialog.conversationRestoredMessage'),
        timestamp: new Date(),
      }]);
      setConversationId(data.id);
      setPhase('chat');
      setCurrentDocType(data.tipo_documento_identificado || null);
      setCurrentDocName((data.contexto as any)?.documento_nome_identificado || null);

      // Rehidrata o documento gerado mais recente desta conversa (se existir).
      try {
        const { data: latestDoc } = await supabase
          .from('docgen_generated_docs')
          .select('conteudo')
          .eq('conversation_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestDoc?.conteudo) {
          setGeneratedDocument(latestDoc.conteudo as any);
          setDocumentReady(true);
        } else {
          setGeneratedDocument(null);
          setDocumentReady((data.contexto as any)?.documento_pronto === true);
        }
      } catch {
        setGeneratedDocument(null);
        setDocumentReady((data.contexto as any)?.documento_pronto === true);
      }

      setHasUnsavedChanges(false);
      setHistoryOpen(false);
      setTimeout(() => inputRef.current?.focus(), 100);
      toast({ title: t('docgen.dialog.conversationRestored'), description: data.titulo });
    } catch (e) {
      console.error('Erro ao restaurar conversa:', e);
      toast({ title: t('docgen.dialog.errorTitle'), description: t('docgen.dialog.conversationRestoreError'), variant: 'destructive' });
    }
  };

  // Adicionar o logo da empresa automaticamente ao gerar documento
  useEffect(() => {
    if (generatedDocument && companyInfo?.logo_url && !generatedDocument.metadados?.logo_url) {
      setGeneratedDocument(prev => ({
        ...prev,
        metadados: {
          ...prev.metadados,
          logo_url: companyInfo.logo_url
        }
      }));
    }
  }, [generatedDocument, companyInfo]);

  return (
    <DialogShell
      open={open}
      onOpenChange={handleDialogClose}
      title={`${t('docgen.dialog.title')}${currentDocType ? ` · ${currentDocType}` : ''}${requirementContext ? ` — ${requirementContext.requirementCode}` : ''}`}
      description={DOCGEN_DIALOG_DESCRIPTION}
      descriptionSrOnly
      icon={AkurisAIIcon}
      size="xl"
      noScroll
      hideFooter
      disableShortcuts
      className="h-[100dvh] sm:h-[92vh]"
    >
      <div className="flex flex-col h-full p-4 sm:p-6 gap-4 min-h-0 overflow-hidden">
        {/* Toolbar de ações da conversa (só aparece no chat) */}
        {phase === 'chat' && (
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 -ml-2 h-7"
                onClick={() => setPhase('briefing')}
                disabled={isLoading || isGeneratingDoc}
                title={t('docgen.briefing.back')}
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t('docgen.dialog.briefingButton')}
              </Button>
              <span className="hidden sm:inline">·</span>
              <span className="truncate">
                {currentDocName ? <strong className="text-foreground">{currentDocName}</strong> : t('docgen.dialog.conversationInProgress')}
                {' · '}
                {t('docgen.dialog.messageCount', { count: messages.length, plural: messages.length === 1 ? '' : 's' })}
              </span>
              {/* Chip de score ao vivo: aparece assim que o documento é gerado. */}
              {currentScore !== null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums shrink-0 ${
                          currentScore >= 80
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : currentScore >= 60
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {t('docgen.dialog.complianceScore', { score: currentScore })}
                        {scoreDelta !== null && (
                          <span
                            className={`font-mono text-[10px] ${
                              scoreDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {scoreDelta > 0 ? '+' : ''}{scoreDelta}
                          </span>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('docgen.dialog.complianceTooltip')}
                      {scoreDelta !== null && t('docgen.dialog.complianceDeltaTooltip', { delta: `${scoreDelta > 0 ? '+' : ''}${scoreDelta}` })}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={startNewConversation}
                disabled={isLoading || isGeneratingDoc}
              >
                <Plus className="h-4 w-4" />
                {t('docgen.dialog.newConversation')}
              </Button>
              <Popover
                open={historyOpen}
                onOpenChange={(o) => {
                  setHistoryOpen(o);
                  if (o) loadHistory();
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1" disabled={isLoading || isGeneratingDoc}>
                    <History className="h-4 w-4" />
                    {t('docgen.dialog.history')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="p-3 border-b">
                    <h4 className="text-sm font-semibold">{t('docgen.dialog.previousConversations')}</h4>
                    <p className="text-xs text-muted-foreground">{t('docgen.dialog.previousConversationsDescription')}</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {historyLoading && (
                      <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                        <AkurisPulse size={16} /> {t('docgen.dialog.loadingConversations')}
                      </div>
                    )}
                    {!historyLoading && historyItems.length === 0 && (
                      <div className="p-4 text-sm text-muted-foreground">{t('docgen.dialog.noPreviousConversations')}</div>
                    )}
                    {!historyLoading && historyItems.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => loadConversation(it.id)}
                        className="w-full text-left p-3 hover:bg-accent border-b last:border-b-0 transition-colors"
                      >
                        <div className="text-sm font-medium truncate">{it.titulo || t('docgen.dialog.untitledConversation')}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {it.tipo_documento_identificado && (
                            <Badge variant="secondary" className="text-[10px] py-0 h-4">{formatStatus(it.tipo_documento_identificado)}</Badge>
                          )}
                          <span>{new Date(it.updated_at).toLocaleString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Toolbar leve em gallery/briefing — só botão de histórico */}
        {phase !== 'chat' && (
          <div className="flex items-center justify-end gap-2 border-b pb-2">
            <Popover
              open={historyOpen}
              onOpenChange={(o) => {
                setHistoryOpen(o);
                if (o) loadHistory();
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <History className="h-4 w-4" />
                  {t('docgen.dialog.restoreConversation')}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 border-b">
                  <h4 className="text-sm font-semibold">{t('docgen.dialog.previousConversations')}</h4>
                  <p className="text-xs text-muted-foreground">{t('docgen.dialog.previousConversationsDescription')}</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {historyLoading && (
                    <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                      <AkurisPulse size={16} /> {t('docgen.dialog.loadingConversations')}
                    </div>
                  )}
                  {!historyLoading && historyItems.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">{t('docgen.dialog.noPreviousConversations')}</div>
                  )}
                  {!historyLoading && historyItems.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => loadConversation(it.id)}
                      className="w-full text-left p-3 hover:bg-accent border-b last:border-b-0 transition-colors"
                    >
                      <div className="text-sm font-medium truncate">{it.titulo || t('docgen.dialog.untitledConversation')}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        {it.tipo_documento_identificado && (
                          <Badge variant="secondary" className="text-[10px] py-0 h-4">{formatStatus(it.tipo_documento_identificado)}</Badge>
                        )}
                        <span>{new Date(it.updated_at).toLocaleString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Fase: Galeria de templates */}
        {phase === 'gallery' && (
          <div className="flex-1 min-h-0">
            <DocGenTemplateGallery
              onPickTemplate={handlePickTemplate}
              onStartBlank={handleStartBlank}
            />
          </div>
        )}

        {/* Fase: Briefing */}
        {phase === 'briefing' && briefingValue && (
          <div className="flex-1 min-h-0">
            <DocGenBriefing
              initialValue={briefingValue}
              templateLabel={selectedTemplate?.label}
              companyContext={companyContext}
              onBack={() => setPhase('gallery')}
              onConfirm={(brief) => enterChatPhase(brief, selectedTemplate?.seedPromptHint)}
            />
          </div>
        )}

        {/* Fase: Chat + Preview (mantém comportamento existente) */}
        {phase === 'chat' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Onda 2: contexto da empresa */}
            <div className="mb-3">
              <DocGenContextPanel context={companyContext} loading={companyContextLoading} defaultOpen={false} />
            </div>
            <div
              ref={messagesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-3 -mr-2"
              style={{ scrollbarGutter: 'stable' }}
            >
              <div className="space-y-4 p-1">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <Card className={`max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <CardContent className="p-3">
                        <div className="text-sm leading-relaxed">
                          {message.role === 'assistant' ? (
                            <div className="space-y-2">
                              {renderMessageContent(message.content)}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap break-words">
                              {message.content}
                            </div>
                          )}
                        </div>
                        <div className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <Card className="bg-muted">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <AkurisPulse size={16} />
                          <span className="text-sm">{t('docgen.dialog.thinking')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="mt-4 flex gap-2">
              <Textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  generatedDocument
                    ? t('docgen.dialog.inputPlaceholderRefine')
                    : t('docgen.dialog.inputPlaceholderDefault')
                }

                className="flex-1 min-h-[60px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="h-[60px]"
                aria-label={t('docgen.dialog.sendMessage')}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Action Buttons */}
            {documentReady && !generatedDocument && (
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={generateDocument}
                  disabled={isGeneratingDoc}
                  className="gap-2"
                  title={t('docgen.dialog.generateDocumentTooltip')}
                >
                  {isGeneratingDoc ? (
                    <AkurisPulse size={16} />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {isGeneratingDoc ? t('docgen.dialog.generatingDocument') : t('docgen.dialog.generateDocumentCredit')}
                </Button>
              </div>
            )}
          </div>

          {/* Document Preview / Skeleton durante geração */}
          {(generatedDocument || isGeneratingDoc) && (
            <div className="w-full lg:w-1/2 lg:border-l lg:pl-4 border-t pt-4 lg:border-t-0 lg:pt-0 flex flex-col min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold">
                  {!generatedDocument && isGeneratingDoc
                    ? t('docgen.dialog.generatingDocumentTitle')
                    : isEditingLayout ? t('docgen.dialog.editLayoutTitle') : t('docgen.dialog.previewTitle')}
                </h3>
                {generatedDocument && (
                  <div className="flex flex-wrap gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={() => setIsEditingLayout(!isEditingLayout)} size="sm" variant="outline" className="gap-1">
                            {isEditingLayout ? t('docgen.dialog.finishLayout') : t('docgen.dialog.editLayout')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('docgen.dialog.editLayoutTooltip')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={handleSaveClick} size="sm" className="gap-1">
                            <Save className="h-3 w-3" strokeWidth={1.5} />
                            {t('docgen.dialog.saveToDocuments')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('docgen.dialog.saveToDocumentsTooltip')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1">
                                <Download className="h-3 w-3" strokeWidth={1.5} />
                                {t('docgen.dialog.export')}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExport('pdf')}>{t('docgen.dialog.exportAsPdf')}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport('docx')}>{t('docgen.dialog.exportAsDocx')}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TooltipTrigger>
                        <TooltipContent>{t('docgen.dialog.exportTooltip')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
              {generatedDocument && !isEditingLayout && (
                <p
                  className="text-xs text-muted-foreground mb-3 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('docgen.dialog.reviewInstructions')) }}
                />
              )}

              {!generatedDocument && isGeneratingDoc ? (
                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <AkurisAIIcon className="h-4 w-4 animate-pulse text-primary" />
                    <span>{t('docgen.dialog.composingDocument')}</span>
                  </div>
                  <div className="space-y-5 animate-pulse">
                    <div>
                      <div className="h-6 w-2/3 bg-muted rounded mb-2" />
                      <div className="h-3 w-1/3 bg-muted rounded" />
                    </div>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 w-1/2 bg-muted rounded" />
                        <div className="h-3 w-full bg-muted rounded" />
                        <div className="h-3 w-11/12 bg-muted rounded" />
                        <div className="h-3 w-10/12 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : isEditingLayout ? (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <DocLayoutBuilder value={generatedDocument} onChange={setGeneratedDocument} />
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  {/* Onda 3: aderência inline ao framework */}
                  {frameworkId && (
                    <DocGenAdherencePanel
                      result={adherenceResult}
                      loading={adherenceLoading}
                      frameworkName={frameworkName}
                      onRun={handleRunAdherence}
                    />
                  )}
                  <div className="space-y-5 text-sm leading-relaxed">
                    <div>
                      <img
                        src={generatedDocument.metadados?.logo_url || companyInfo?.logo_url || '/akuris-logo.png'}
                        alt={`Logo da ${userInfo?.nome || 'Akuris'}`}
                        className="h-10 mb-3 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/akuris-logo.png'; }}
                      />
                      <h4 className="font-bold text-lg">{generatedDocument.titulo}</h4>
                      <p className="text-muted-foreground">
                        {t('docgen.dialog.versao', { versao: generatedDocument.versao })} | {generatedDocument.data_criacao}
                      </p>
                    </div>
                    {generatedDocument.secoes?.map((secao: any, index: number) => {
                      const sectionAdherence = adherenceResult?.secoes?.find((s: any) => s.section_index === index);
                      return (
                        <div key={index} className="space-y-2 group">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <h5 className="font-semibold truncate">{secao.nome}</h5>
                              {sectionAdherence && (
                                <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                                  {sectionAdherence.status}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="opacity-60 hover:opacity-100 gap-1 h-7 px-2 text-xs shrink-0"
                              onClick={() => setRefiningSectionIndex(index)}
                              title={t('docgen.dialog.refineSectionTooltip')}
                            >
                              <AkurisAIIcon className="h-3.5 w-3.5" />
                              {t('docgen.dialog.refineSection')}
                            </Button>
                          </div>
                          <DocGenMarkdown content={secao.conteudo || ''} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
        )}

        {/* Onda 3: refinador de seção */}
        {generatedDocument && refiningSectionIndex !== null && (
          <DocGenSectionRefiner
            open={refiningSectionIndex !== null}
            onOpenChange={(o) => { if (!o) setRefiningSectionIndex(null); }}
            sectionName={generatedDocument.secoes?.[refiningSectionIndex]?.nome || ''}
            currentContent={generatedDocument.secoes?.[refiningSectionIndex]?.conteudo || ''}
            loading={sectionRefineLoading}
            onSubmit={handleRefineSection}
          />
        )}

        {/* Dialogo de criação com dados do DocGen */}
        <DocumentoDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          originSource="docgen"
          onSuccess={() => {
            const nomeIncorporado = generatedDocument?.titulo || t('docgen.dialog.title');
            onDocumentSaved?.();
            setShowCreateDialog(false);
            onOpenChange(false);
            // Toast editorial com CTA para o módulo Documentos
            akurisToast({
              module: 'documentos',
              tone: 'success',
              eyebrow: t('docgen.dialog.incorporationDone'),
              title: t('docgen.dialog.documentIncorporated'),
              description: t('docgen.dialog.documentIncorporatedDescription', { name: nomeIncorporado }),
              action: {
                label: t('docgen.dialog.openInDocuments'),
                onClick: () => navigate('/documentos'),
              },
              duration: 8000,
            });
          }}
          // categorias removido - não é mais necessário
          initialFile={initialGeneratedFile}
          initialData={{
            nome: generatedDocument?.titulo || '',
            tipo: (currentDocType || 'documento') as any,
            descricao: generatedDocument?.metadados?.descricao || '',
            tags: generatedDocument?.metadados?.tags || [],
            status: 'ativo',
            classificacao: generatedDocument?.metadados?.classificacao || 'interna',
          }}
        />
      </div>

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('docgen.dialog.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('docgen.dialog.discardDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('docgen.dialog.continueEditing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscardAndClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('docgen.dialog.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação antes de publicar quando o score de compliance está baixo. */}
      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('docgen.dialog.publishLowComplianceTitle')}</AlertDialogTitle>
            <AlertDialogDescription
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  t('docgen.dialog.publishLowComplianceDescription', {
                    score: String(currentScore ?? 0),
                    frameworkPart: effFrameworkName
                      ? t('docgen.dialog.publishLowComplianceFramework', { framework: effFrameworkName })
                      : '',
                  })
                ),
              }}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('docgen.dialog.continueRefining')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setPublishConfirmOpen(false);
                await handleOpenCreateDialog();
              }}
            >
              {t('docgen.dialog.publishAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DialogShell>
  );
};