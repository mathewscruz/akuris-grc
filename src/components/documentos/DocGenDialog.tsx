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
  DOCGEN_TEMPLATES,
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
import { logger } from '@/lib/logger';

/**
 * Tempo máximo (ms) que o frontend espera por uma chamada do docgen-chat.
 * Tem de ser MAIOR do que o orçamento do servidor (115s) para que a resposta
 * do servidor — incluindo o estorno de crédito — chegue antes do abort local.
 */
const DOCGEN_TIMEOUT_MS = 130_000;

type DocGenCallResult = {
  data?: any;
  /** Créditos de IA esgotados — abrir CreditsExhaustedDialog. */
  credits?: boolean;
  /** Estourou o tempo limite do cliente. */
  timeout?: boolean;
  /** Erro recuperável: reenviar com a MESMA idempotency_key não debita duas vezes. */
  retryable?: boolean;
  error?: string;
  errorCode?: string;
};

/** Chave de idempotência por tentativa lógica do utilizador. */
function newIdempotencyKey(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

/**
 * Wrapper único das chamadas ao docgen-chat.
 * Usa fetch direto (o cliente supabase-js não aceita AbortSignal) para que o
 * timeout do cliente ABORTE mesmo a ligação, em vez de a deixar pendurada.
 */
async function callDocGen(
  body: Record<string, unknown>,
  timeoutMs = DOCGEN_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<DocGenCallResult> {
  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort('__DOCGEN_TIMEOUT__'), timeoutMs);
  const onExternalAbort = () => aborter.abort('__DOCGEN_CANCELLED__');
  externalSignal?.addEventListener('abort', onExternalAbort);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/docgen-chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: aborter.signal,
    });

    let payload: any = null;
    try { payload = await res.json(); } catch { /* corpo não-JSON */ }

    if (payload?.code === 'CREDITS_EXHAUSTED' || payload?.error === 'CREDITS_EXHAUSTED') return { credits: true };
    if (!res.ok) {
      return {
        error: payload?.error || `HTTP ${res.status}`,
        errorCode: payload?.code,
        retryable: res.status >= 500,
      };
    }
    if (payload?.error === 'INVALID_DOCUMENT') {
      return { error: 'INVALID_DOCUMENT', retryable: payload?.retryable !== false };
    }
    if (payload?.error) return { error: payload.error, retryable: !!payload.retryable };
    return { data: payload };
  } catch (e: any) {
    if (aborter.signal.aborted) {
      const reason = (aborter.signal as any).reason;
      if (reason === '__DOCGEN_CANCELLED__') return { error: '__DOCGEN_CANCELLED__' };
      return { timeout: true };
    }
    return { error: e?.message || 'Erro inesperado' };
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
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
  const [generationError, setGenerationError] = useState<string | null>(null);
  /**
   * Progresso da geração. As etapas 1–3 são estimadas pelo tempo decorrido
   * (a API devolve tudo de uma vez); as etapas de refino automático são reais
   * — cada tentativa é uma chamada concluída ao servidor.
   */
  const [genElapsed, setGenElapsed] = useState(0);
  const [refineProgress, setRefineProgress] = useState<{ attempt: number; total: number } | null>(null);

  const [draft, setDraft] = useState<{ briefing: BriefingDefaults; templateId?: string; step: number } | null>(null);
  const lastGenerationArgsRef = useRef<{ briefingText?: string; docNameHint?: string; conversationId?: string | null }>({});
  const lastGenerationKeyRef = useRef<string | null>(null);
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

  // Confirmação antes de publicar quando o score está baixo.


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
        ...(conversationId ? {} : { conversation_title: `${selectedTemplate?.label || currentDocName || 'DocGen'} — ${new Date().toLocaleString()}` }),
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
      if (autoGen) {
        // Modo direto: nada de etapa conversacional — o briefing vai direto
        // para a geração do documento completo.
        setMessages(prev => [...prev, { role: 'user', content: briefingSummary, timestamp: new Date() }]);
        setDocumentReady(true);
        await generateDocument({
          briefingText: seed,
          docNameHint: templateHint || briefing.docType,
          conversationId: null,
        });
        return;
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
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        setRefineProgress({ attempt, total: maxAttempts });
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
            id: DOCGEN_STATUS_TOAST,
            module: 'documentos',
            tone: 'success',
            title: t('docgen.dialog.autoRefineDoneTitle'),
            description: t('docgen.dialog.autoRefineDoneDescription', { score: String(res.data.after ?? '') }),
          });
        }
        if (!res.data.should_continue) break;
      }
    } finally {
      setRefineProgress(null);
    }
    return current;
  };


  /**
   * Gera o documento completo.
   * `opts.briefingText` é usado no modo "Gerar documento direto": o briefing vai
   * direto para a geração, sem passar pela etapa conversacional de refinamento.
   */
  const generateDocument = async (opts?: { briefingText?: string; docNameHint?: string; conversationId?: string | null }) => {
    if (!userInfo || isGeneratingDoc) return;
    const convId = opts?.conversationId !== undefined ? opts.conversationId : conversationId;
    if (!convId && !opts?.briefingText) return;

    lastGenerationArgsRef.current = opts ?? {};
    setGenerationError(null);
    setIsGeneratingDoc(true);

    // P0: uma chave por tentativa lógica do utilizador. Se a chamada falhar de
    // forma recuperável, reenviamos com a MESMA chave — o servidor não debita
    // crédito duas vezes.
    const idemKey = lastGenerationKeyRef.current ?? newIdempotencyKey();
    lastGenerationKeyRef.current = idemKey;

    const invokeGenerate = (strictJson: boolean) => callDocGen({
        conversation_id: convId,
        user_id: userInfo.user_id,
        empresa_id: userInfo.empresa_id,
        action: 'generate_document',
        idempotency_key: idemKey,
        ...(strictJson ? { json_retry: true } : {}),
        // Título distinguível: modelo + escopo resumido + data (sem isto o
        // histórico enche-se de entradas com o mesmo nome).
        conversation_title: [
          selectedTemplate?.label || opts?.docNameHint || currentDocName || currentDocType || 'DocGen',
          briefingValue?.scope?.trim() ? `· ${briefingValue.scope.trim().slice(0, 48)}` : '',
          `— ${new Date().toLocaleString()}`,
        ].filter(Boolean).join(' '),

        ...(opts?.briefingText ? { briefing_text: opts.briefingText } : {}),
        doc_type_hint: opts?.docNameHint || currentDocName || currentDocType,
        // Controlo documental (ISO 27001 7.5) + cargos reais: sem isto a IA
        // inventa papéis na RACI e omite proprietário/aprovador/periodicidade.
        doc_control: {
          owner: briefingValue?.owner || '',
          approver: briefingValue?.approver || '',
          review_frequency: briefingValue?.reviewFrequency || 'anual',
          classification: briefingValue?.classification || 'interna',
          roles: briefingValue?.roles || [],
          inline_refs: briefingValue?.inlineRefs !== false,
        },

        ...(effFrameworkName && { framework_context: { framework_name: effFrameworkName, framework_id: effFrameworkId, framework_ids: fwReqData?.matchedIds } }),
        ...(requirementContext && { requirement_context: requirementContext }),
    });

    try {
      let res = await invokeGenerate(false);

      // JSON inválido/truncado é recuperável: uma segunda tentativa com prompt
      // estrito, mesma chave de idempotência (sem novo débito).
      if (res.retryable && res.error === 'INVALID_DOCUMENT') {
        res = await invokeGenerate(true);
      }

      if (res.credits) { setShowCreditsDialog(true); setGenerationError(t('docgen.dialog.generateDocumentError')); return; }
      if (res.timeout) {
        setGenerationError(t('docgen.dialog.timeoutDescription'));
        toast({ title: t('docgen.dialog.timeoutTitle'), description: t('docgen.dialog.timeoutDescription'), variant: 'destructive' });
        return;
      }
      if (res.error === 'INVALID_DOCUMENT') {
        setGenerationError(t('docgen.dialog.invalidDocumentDescription'));
        toast({
          title: t('docgen.dialog.invalidDocumentTitle'),
          description: t('docgen.dialog.invalidDocumentDescription'),
          variant: 'destructive',
        });
        return;
      }
      if (res.errorCode === 'AI_UNAVAILABLE') {
        setGenerationError(t('docgen.dialog.serviceUnavailable'));
        return;
      }
      if (res.error) throw new Error(res.error);
      const data = res.data;
      if (!data?.document) {
        setGenerationError(t('docgen.dialog.generateDocumentError'));
        return;
      }
      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
      }


      // A IA não conhece a data atual (chuta valores errados). Fixamos a data
      // real do usuário na capa/preview/export, independentemente do que veio.
      const doc = {
        ...data.document,
        data_criacao: new Date().toISOString().slice(0, 10),
      };
      setGeneratedDocument(doc);
      lastGenerationKeyRef.current = null;
      toast({
        title: t('docgen.dialog.documentGeneratedTitle'),
        description: t('docgen.dialog.documentGeneratedDescription'),
      });

      // Quality gate em invocação própria (não debita crédito): reescreve as
      // seções fracas do documento já entregue.
      let workingDoc = doc;
      if (data?.should_quality_gate) {
        const gate = await callDocGen({
          action: 'quality_gate',
          user_id: userInfo.user_id,
          empresa_id: userInfo.empresa_id,
          conversation_id: data.conversation_id || convId,
          document: doc,
        });
        if (gate.data?.document) {
          workingDoc = { ...gate.data.document, data_criacao: doc.data_criacao };
          setGeneratedDocument(workingDoc);
        }
      }

      // Auto-refino em chamadas separadas, para não estourar o timeout.
      if (data?.should_auto_refine) {
        akurisToast({
          module: 'documentos',
          tone: 'info',
          title: t('docgen.dialog.autoRefineTitle'),
          description: t('docgen.dialog.autoRefineDescription'),
        });
        await runAutoRefine(workingDoc, data.framework_ids, Number(data.max_refine_attempts) || 2);
      }


    } catch (error) {
      logger.error('Erro ao gerar documento', {
        module: 'docgen',
        action: 'generate_document',
        userId: userInfo.user_id,
        empresaId: userInfo.empresa_id,
        error: error instanceof Error ? error.message : String(error),
      });
      setGenerationError((error as Error)?.message || t('docgen.dialog.generateDocumentError'));
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
   * Já não existe gate de score: o documento é escrito para atender os
   * referenciais escolhidos e a avaliação formal acontece na Análise de
   * Aderência, quando o usuário a pedir.
   */
  const handleSaveClick = async () => {
    await handleOpenCreateDialog();
  };




  /**
   * Renderiza a mensagem do assistente com o MESMO parser de markdown do
   * preview/exportação (títulos #..####, listas com "-" ou "*", tabelas),
   * evitando que headings e bullets vazem como texto cru no chat.
   */
  const renderMessageContent = (content: string) => {
    const codeBlocks = content.split(/```([\s\S]*?)```/);
    const parts: React.ReactNode[] = [];

    codeBlocks.forEach((block, index) => {
      if (index % 2 === 0) {
        if (block.trim()) {
          parts.push(<DocGenMarkdown key={`md-${index}`} content={block} />);
        }
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

  // Score de compliance deixou de existir no DocGen: o documento é escrito em
  // conformidade com os referenciais escolhidos e a avaliação formal acontece
  // na Análise de Aderência.



  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia, Shift+Enter quebra linha. Ignora durante composição IME (acentos compostos).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---- Rascunho do briefing (recuperação após fecho acidental) ----
  const draftKey = `docgen:draft:${userInfo?.empresa_id || 'anon'}:${userInfo?.user_id || 'anon'}`;

  const saveDraft = (brief: BriefingDefaults, step: number) => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        briefing: brief, templateId: selectedTemplate?.id, step, updatedAt: Date.now(),
      }));
      setDraft({ briefing: brief, templateId: selectedTemplate?.id, step });
    } catch { /* quota — ignorar */ }
  };

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch { /* noop */ }
    setDraft(null);
  };

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(draftKey);
      setDraft(raw ? JSON.parse(raw) : null);
    } catch { setDraft(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey]);

  const resumeDraft = () => {
    if (!draft) return;
    const tpl = draft.templateId ? DOCGEN_TEMPLATES.find(x => x.id === draft.templateId) : null;
    setSelectedTemplate(tpl || null);
    setBriefingValue(draft.briefing);
    setPhase('briefing');
  };

  // Cronómetro da geração: alimenta as etapas e a percentagem mostradas ao usuário.
  useEffect(() => {
    if (!isGeneratingDoc && !refineProgress) {
      setGenElapsed(0);
      return;
    }
    const started = Date.now() - genElapsed * 1000;
    const id = setInterval(() => setGenElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneratingDoc, !!refineProgress]);

  /** Etapa atual (1..5) e percentagem apresentada. */
  const generationStage = refineProgress
    ? 5
    : genElapsed < 6 ? 1
      : genElapsed < 14 ? 2
        : genElapsed < 40 ? 3
          : 4;
  const generationPercent = refineProgress
    ? Math.min(96, 70 + Math.round((refineProgress.attempt / Math.max(1, refineProgress.total)) * 26))
    : Math.min(70, Math.round((genElapsed / 45) * 70));
  const generationStageLabel = refineProgress
    ? t('docgen.dialog.progressRefining', {
        attempt: String(refineProgress.attempt),
        total: String(refineProgress.total),
      })
    : t(`docgen.dialog.progressStage${generationStage}` as any);


  // Existe trabalho em curso que se perderia ao fechar?
  const hasWorkInProgress =
    (hasUnsavedChanges && !isDocumentSaved && !isDocumentExported) ||
    (phase === 'briefing') ||
    (phase === 'chat' && messages.length > 0 && !isDocumentSaved && !isDocumentExported);

  // O texto do aviso muda conforme o que realmente está em risco:
  // briefing em preenchimento, conversa sem documento, ou documento pronto.
  const discardCopyKey: 'discard' | 'discardBriefing' | 'discardChat' =
    generatedDocument ? 'discard' : phase === 'briefing' ? 'discardBriefing' : 'discardChat';


  // Verificar mudanças antes de fechar
  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen && hasWorkInProgress) {
      setDiscardDialogOpen(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const confirmDiscardAndClose = () => {
    setDiscardDialogOpen(false);
    setHasUnsavedChanges(false);
    clearDraft();
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
                {messages.length === 1
                  ? t('docgen.dialog.messageCountOne')
                  : t('docgen.dialog.messageCount', { count: messages.length })}

              </span>
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
          <div className="flex-1 min-h-0 flex flex-col">
            {draft && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{t('docgen.dialog.draftBannerTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('docgen.dialog.draftBannerDescription')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={clearDraft}>{t('docgen.dialog.draftDiscard')}</Button>
                  <Button size="sm" variant="soft" onClick={resumeDraft}>{t('docgen.dialog.draftResume')}</Button>
                </div>
              </div>
            )}
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
              onDraftChange={(brief, step) => saveDraft(brief, step)}
              onConfirm={(brief) => { clearDraft(); enterChatPhase(brief, selectedTemplate?.seedPromptHint); }}
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
                    <Card>
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

            {generationError && !generatedDocument && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
                <p className="text-sm font-medium text-destructive">{t('docgen.dialog.generationFailedTitle')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{generationError}</p>
                <Button
                  size="sm"
                  variant="soft"
                  className="mt-2"
                  disabled={isGeneratingDoc}
                  onClick={() => generateDocument(lastGenerationArgsRef.current)}
                >
                  {t('docgen.dialog.retryGeneration')}
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            {documentReady && !generatedDocument && !generationError && !isGeneratingDoc && (
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={() => generateDocument()}
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
                  <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                    <AkurisPulse size={44} />
                    <div className="w-full max-w-sm space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{generationStageLabel}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {t('docgen.dialog.progressPercent', { percent: String(generationPercent) })}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-700"
                          style={{ width: `${Math.max(4, generationPercent)}%` }}
                        />
                      </div>
                      <ol className="mt-3 space-y-1 text-left text-xs">
                        {[1, 2, 3, 4, 5].map((step) => (
                          <li
                            key={step}
                            className={
                              step < generationStage
                                ? 'text-muted-foreground line-through'
                                : step === generationStage
                                  ? 'text-foreground font-medium'
                                  : 'text-muted-foreground/60'
                            }
                          >
                            {t(`docgen.dialog.progressStage${step}` as any)}
                          </li>
                        ))}
                      </ol>
                    </div>
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
            <AlertDialogTitle>{t(`docgen.dialog.${discardCopyKey}Title`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`docgen.dialog.${discardCopyKey}Description`)}
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


    </DialogShell>
  );
};