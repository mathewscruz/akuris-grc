import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { DialogShell } from '@/components/ui/dialog-shell';
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
import { akurisToast } from '@/lib/akuris-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Send, FileText, Download, Save, Plus, History, CheckCircle2 } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import DocLayoutBuilder from './DocLayoutBuilder';
import { formatStatus } from '@/lib/text-utils';
import { DocumentoDialog } from '@/components/documentos/DocumentoDialog';
import jsPDF from 'jspdf';
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun, ImageRun } from 'docx';
import { CreditsExhaustedDialog } from '@/components/CreditsExhaustedDialog';
import { useAuth } from '@/components/AuthProvider';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
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

const TOOLTIPS: Record<string, string> = {
  'BIA': 'Business Impact Analysis - Análise de Impacto no Negócio. Processo que identifica e avalia os efeitos potenciais de interrupções nas operações críticas da organização.',
  'ROPA': 'Record of Processing Activities - Registro das Atividades de Tratamento. Documento que lista todos os tratamentos de dados pessoais realizados pela organização.',
  'RTO': 'Recovery Time Objective - Tempo máximo aceitável para restaurar um sistema após uma interrupção.',
  'ISO': 'International Organization for Standardization - Organização internacional que desenvolve padrões técnicos.',
  'LGPD': 'Lei Geral de Proteção de Dados - Lei brasileira que regula o tratamento de dados pessoais.',
  'SLA': 'Service Level Agreement - Acordo de Nível de Serviço que define padrões de qualidade esperados.',
  'KPI': 'Key Performance Indicator - Indicador-chave de performance usado para medir eficiência.',
  'PDCA': 'Plan-Do-Check-Act - Metodologia de melhoria contínua em quatro etapas.'
};

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

  // Dialog de criação via DocGen
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [docCategorias, setDocCategorias] = useState<any[]>([]);
  const [initialGeneratedFile, setInitialGeneratedFile] = useState<File | null>(null);

  // Buscar informações do usuário
  const [userInfo, setUserInfo] = useState<{ user_id: string; empresa_id: string; nome: string } | null>(null);

  // Histórico de conversas
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<Array<{ id: string; titulo: string; tipo_documento_identificado: string | null; updated_at: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // AlertDialog de descarte
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

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
      // Iniciar conversa com saudação contextualizada (apenas se chat estiver vazio — preserva conversa em andamento)
      setMessages(prev => {
        if (prev.length > 0) return prev;
        let greeting: string;
        if (requirementContext) {
          greeting = `Olá! Sou o DocGen, o Gerador de Documentos com IA da Akuris.\n\nVamos trabalhar o requisito **${requirementContext.requirementCode} — ${requirementContext.requirementTitle}**${frameworkName ? ` do framework **${frameworkName}**` : ''}.\n\nPosso gerar uma política, procedimento ou norma sob medida para atender este requisito. Que tipo de documento você quer criar?`;
        } else if (frameworkName) {
          greeting = `Olá! Sou o DocGen, o Gerador de Documentos com IA da Akuris.\n\nVejo que você está trabalhando com o framework **${frameworkName}**. Posso ajudá-lo a gerar políticas, procedimentos ou normas alinhados a esse framework, usando os gaps identificados na sua avaliação para garantir que o documento cubra os pontos necessários.\n\nQue tipo de documento você gostaria de criar?`;
        } else {
          greeting = 'Olá! Sou o DocGen, o Gerador de Documentos com IA da Akuris. Estou aqui para ajudá-lo a criar qualquer tipo de documento que você precisa.\n\nPode me contar que tipo de documento você gostaria de criar?';
        }
        return [{ role: 'assistant', content: greeting, timestamp: new Date() }];
      });
      // Foco no input ao abrir
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, frameworkName, requirementContext]);

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

  const sendMessage = async () => {
    if (!inputMessage.trim() || !userInfo || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('docgen-chat', {
        body: {
          message: inputMessage,
          conversation_id: conversationId,
          user_id: userInfo.user_id,
          empresa_id: userInfo.empresa_id,
          action: 'chat',
          ...(frameworkName && { framework_context: { framework_name: frameworkName, framework_id: frameworkId } }),
          ...(requirementContext && { requirement_context: requirementContext }),
        }
      });

      if (error) throw error;

      // Verificar se créditos foram esgotados
      if (data?.error === 'CREDITS_EXHAUSTED') {
        setShowCreditsDialog(true);
        return;
      }

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
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateDocument = async () => {
    if (!userInfo || !conversationId || isGeneratingDoc) return;

    setIsGeneratingDoc(true);

    try {
      const { data, error } = await supabase.functions.invoke('docgen-chat', {
        body: {
          conversation_id: conversationId,
          user_id: userInfo.user_id,
          empresa_id: userInfo.empresa_id,
          action: 'generate_document',
          doc_type_hint: currentDocName || currentDocType,
          ...(frameworkName && { framework_context: { framework_name: frameworkName, framework_id: frameworkId } }),
          ...(requirementContext && { requirement_context: requirementContext }),
        }
      });

      if (error) throw error;

      // Verificar se créditos foram esgotados
      if (data?.error === 'CREDITS_EXHAUSTED') {
        setShowCreditsDialog(true);
        return;
      }

      setGeneratedDocument(data.document);
      toast({
        title: "Documento Gerado!",
        description: "Seu documento foi criado com sucesso. Agora você pode salvá-lo no sistema ou exportar.",
      });

    } catch (error) {
      console.error('Erro ao gerar documento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o documento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const saveDocument = async () => {
    if (!generatedDocument || !userInfo) return;

    try {
      const { error } = await supabase
        .from('documentos')
        .insert({
          nome: generatedDocument.titulo,
          tipo: currentDocType || 'outros',
          conteudo: generatedDocument,
          status: 'rascunho',
          versao: generatedDocument.versao,
          empresa_id: userInfo.empresa_id,
          created_by: userInfo.user_id,
          data_criacao: new Date().toISOString(),
          classificacao: generatedDocument.metadados?.classificacao || 'interno'
        });

      if (error) throw error;

      setIsDocumentSaved(true);
      setHasUnsavedChanges(false);

      toast({
        title: "Documento Salvo!",
        description: "O documento foi salvo no sistema com sucesso.",
      });

      onDocumentSaved?.();
      onOpenChange(false);

    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o documento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Geração e exportação de arquivos
  const generateDocxBlob = async () => {
    if (!generatedDocument) return null;
    const children: any[] = [];

    // Logo no topo (se houver)
    const logoUrl: string | undefined = generatedDocument.metadados?.logo_url || companyInfo?.logo_url;
    const logoAltura: number = parseInt(generatedDocument.metadados?.logo_altura || '48', 10);
    const logoPosicao: string = generatedDocument.metadados?.logo_posicao || 'esquerda';
    
    if (logoUrl) {
      try {
        const resp = await fetch(logoUrl);
        const buf = await resp.arrayBuffer();
        
        const alignment = logoPosicao === 'centro' ? 'center' : 
                         logoPosicao === 'direita' ? 'right' : 'left';
        
        children.push(
          new Paragraph({
            alignment: alignment as any,
            children: [
              new ImageRun({ data: buf, transformation: { width: Math.round(logoAltura * 2), height: logoAltura } })
            ]
          })
        );
      } catch (_) { /* ignora erro de logo */ }
    }

    children.push(
      new Paragraph({
        text: generatedDocument.titulo || 'Documento',
        heading: HeadingLevel.TITLE,
      })
    );
    children.push(new Paragraph({ text: `Versão: ${generatedDocument.versao || ''}` }));
    children.push(new Paragraph({ text: `Data: ${generatedDocument.data_criacao || ''}` }));

    (generatedDocument.secoes || []).forEach((secao: any) => {
      children.push(
        new Paragraph({ text: ' ' }),
      );
      children.push(
        new Paragraph({ text: secao.nome || 'Seção', heading: HeadingLevel.HEADING_2 })
      );
      const conteudo = (secao.conteudo || '').toString().split('\n');
      conteudo.forEach((line: string) =>
        children.push(new Paragraph({ children: [new TextRun(line)] }))
      );
    });

    const doc = new DocxDocument({ sections: [{ properties: {}, children }] });
    const blob = await Packer.toBlob(doc);
    return blob;
  };

  const generatePdfBlob = async () => {
    if (!generatedDocument) return null;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 50;

    // Tentar carregar logo da empresa
    const logoUrl: string | undefined = generatedDocument.metadados?.logo_url || companyInfo?.logo_url;
    const logoAltura: number = parseInt(generatedDocument.metadados?.logo_altura || '48', 10);
    const logoPosicao: string = generatedDocument.metadados?.logo_posicao || 'esquerda';
    
    if (logoUrl) {
      try {
        const resp = await fetch(logoUrl);
        const blob = await resp.blob();
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Falha ao carregar logo'));
          reader.readAsDataURL(blob);
        });
        
        const logoWidth = Math.round(logoAltura * 2);
        const pageWidth = pdf.internal.pageSize.getWidth();
        
        let logoX = marginX; // posição padrão (esquerda)
        if (logoPosicao === 'centro') {
          logoX = (pageWidth - logoWidth) / 2;
        } else if (logoPosicao === 'direita') {
          logoX = pageWidth - marginX - logoWidth;
        }
        
        pdf.addImage(dataUrl, (blob.type.includes('png') ? 'PNG' : 'JPEG') as any, logoX, y, logoWidth, logoAltura);
        y += logoAltura + 16;
      } catch (_) { /* ignora erro de logo */ }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(generatedDocument.titulo || 'Documento', marginX, y);
    y += 24;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Versão: ${generatedDocument.versao || ''}`, marginX, y);
    y += 16;
    pdf.text(`Data: ${generatedDocument.data_criacao || ''}`, marginX, y);
    y += 24;

    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pdf.internal.pageSize.getWidth() - marginX * 2;

    (generatedDocument.secoes || []).forEach((secao: any, idx: number) => {
      if (idx > 0) y += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      const titleLines = pdf.splitTextToSize(secao.nome || 'Seção', maxWidth);
      titleLines.forEach((line: string) => {
        if (y > pageHeight - 60) {
          pdf.addPage();
          y = 50;
        }
        pdf.text(line, marginX, y);
        y += 18;
      });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize((secao.conteudo || '').toString(), maxWidth);
      lines.forEach((line: string) => {
        if (y > pageHeight - 40) {
          pdf.addPage();
          y = 50;
        }
        pdf.text(line, marginX, y);
        y += 16;
      });
    });

    return pdf.output('blob');
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
      toast({ title: 'Documento Exportado', description: `Exportado como ${format.toUpperCase()}.` });
    } catch (e) {
      console.error('Erro ao exportar documento:', e);
      toast({ title: 'Erro ao exportar', description: 'Tente novamente.', variant: 'destructive' });
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
      toast({ title: 'Erro', description: 'Falha ao preparar arquivo para salvar.', variant: 'destructive' });
    }
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
    const greeting = frameworkName
      ? `Olá! Sou o DocGen, seu assistente inteligente para criação de documentos.\n\nVejo que você está trabalhando com o framework **${frameworkName}**. Posso ajudá-lo a gerar políticas, procedimentos ou normas alinhados a esse framework.\n\nQue tipo de documento você gostaria de criar?`
      : 'Olá! Sou o DocGen, seu assistente inteligente para criação de documentos. Pode me contar que tipo de documento você gostaria de criar?';
    setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
    setTimeout(() => inputRef.current?.focus(), 100);
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
      toast({ title: 'Erro', description: 'Não foi possível carregar o histórico.', variant: 'destructive' });
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
        content: 'Conversa restaurada. Como posso continuar te ajudando?',
        timestamp: new Date(),
      }]);
      setConversationId(data.id);
      setCurrentDocType(data.tipo_documento_identificado || null);
      setCurrentDocName((data.contexto as any)?.documento_nome_identificado || null);
      setGeneratedDocument(null);
      setDocumentReady(false);
      setHasUnsavedChanges(false);
      setHistoryOpen(false);
      setTimeout(() => inputRef.current?.focus(), 100);
      toast({ title: 'Conversa restaurada', description: data.titulo });
    } catch (e) {
      console.error('Erro ao restaurar conversa:', e);
      toast({ title: 'Erro', description: 'Não foi possível restaurar a conversa.', variant: 'destructive' });
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
      title={`Gerador de Documentos (IA)${currentDocType ? ` · ${currentDocType}` : ''}${requirementContext ? ` — ${requirementContext.requirementCode}` : ''}`}
      icon={AkurisAIIcon}
      size="xl"
      noScroll
      hideFooter
      disableShortcuts
      className="h-[100dvh] sm:h-[92vh]"
    >
      <div className="flex flex-col h-full p-4 sm:p-6 gap-4 min-h-0 overflow-hidden">
        {/* Toolbar de ações da conversa */}
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <div className="text-xs text-muted-foreground">
            {currentDocName ? <span><strong className="text-foreground">{currentDocName}</strong> · </span> : null}
            {messages.length} mensagem{messages.length === 1 ? '' : 's'} nesta conversa
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
              Nova conversa
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
                  Histórico
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 border-b">
                  <h4 className="text-sm font-semibold">Conversas anteriores</h4>
                  <p className="text-xs text-muted-foreground">Suas últimas 20 conversas no DocGen.</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {historyLoading && (
                    <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                      <AkurisPulse size={16} /> Carregando…
                    </div>
                  )}
                  {!historyLoading && historyItems.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa anterior.</div>
                  )}
                  {!historyLoading && historyItems.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => loadConversation(it.id)}
                      className="w-full text-left p-3 hover:bg-accent border-b last:border-b-0 transition-colors"
                    >
                      <div className="text-sm font-medium truncate">{it.titulo || 'Conversa sem título'}</div>
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

        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
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
                          <span className="text-sm">DocGen está pensando...</span>
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
                placeholder="Digite sua mensagem aqui... (Enter envia, Shift+Enter quebra linha)"
                className="flex-1 min-h-[60px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="h-[60px]"
                aria-label="Enviar mensagem"
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
                >
                  {isGeneratingDoc ? (
                    <AkurisPulse size={16} />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {isGeneratingDoc ? 'Gerando Documento...' : 'Gerar Documento'}
                </Button>
              </div>
            )}
          </div>

          {/* Document Preview / Skeleton durante geração */}
          {(generatedDocument || isGeneratingDoc) && (
            <div className="w-full lg:w-1/2 lg:border-l lg:pl-4 border-t pt-4 lg:border-t-0 lg:pt-0 flex flex-col min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="font-semibold">
                  {!generatedDocument && isGeneratingDoc
                    ? 'Gerando documento…'
                    : isEditingLayout ? 'Editor de Layout' : 'Preview do Documento'}
                </h3>
                {generatedDocument && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setIsEditingLayout(!isEditingLayout)} size="sm" variant="outline" className="gap-1">
                      {isEditingLayout ? 'Concluir Layout' : 'Editar Layout'}
                    </Button>
                    <Button onClick={handleOpenCreateDialog} size="sm" className="gap-1">
                      <Save className="h-3 w-3" />
                      Salvar no Sistema
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Download className="h-3 w-3" />
                          Exportar
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport('pdf')}>Exportar como PDF</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('docx')}>Exportar como DOCX</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {!generatedDocument && isGeneratingDoc ? (
                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <AkurisAIIcon className="h-4 w-4 animate-pulse text-primary" />
                    <span>Compondo seu documento. Isso pode levar até 40 segundos…</span>
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
                        Versão: {generatedDocument.versao} | {generatedDocument.data_criacao}
                      </p>
                    </div>
                    {generatedDocument.secoes?.map((secao: any, index: number) => (
                      <div key={index} className="space-y-2">
                        <h5 className="font-semibold">{secao.nome}</h5>
                        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {secao.conteudo}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Dialogo de criação com dados do DocGen */}
        <DocumentoDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => {
            onDocumentSaved?.();
            setShowCreateDialog(false);
            onOpenChange(false);
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
            <AlertDialogTitle>Descartar documento gerado?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem um documento gerado que não foi salvo no sistema nem exportado.
              Se fechar agora, ele será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscardAndClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogShell>
  );
};