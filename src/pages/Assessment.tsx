import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, FileText, ArrowRight, ArrowLeft, AlertCircle, Upload, Building2, Check, Clock, Calendar, ListChecks, ShieldCheck, Save, ChevronRight, FileQuestion, AlertTriangle } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { getCompanyLogo } from '@/lib/brand-logo';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
const assessmentLogger = {
  info: (message: string, data?: any) => {
    logger.info(`[Assessment] ${message}`, { module: 'Assessment', details: data });
  },
  warn: (message: string, data?: any) => {
    logger.warn(`[Assessment] ${message}`, { module: 'Assessment', details: data });
  },
  error: (message: string, error?: any) => {
    logger.error(`[Assessment] ${message}`, { module: 'Assessment', error: String(error) });
  }
};

interface QuestionData {
  id: string;
  titulo: string;
  descricao?: string;
  pergunta: string;
  tipo: 'texto' | 'multipla_escolha' | 'radio' | 'arquivo' | 'numerico' | 'booleano' | 'select';
  opcoes?: string[];
  obrigatoria: boolean;
  peso?: number;
  ordem?: number;
  configuracoes?: {
    mostrar_evidencia_quando?: string;
    mostrar_justificativa_quando?: string;
    label_evidencia?: string;
    label_justificativa?: string;
    placeholder?: string;
    min?: number;
  };
}

interface AssessmentData {
  id: string;
  fornecedor_nome: string;
  status: 'enviado' | 'em_andamento' | 'concluido';
  data_envio: string;
  data_limite: string;
  data_conclusao?: string;
  empresa: {
    nome: string;
    logo_url?: string;
  };
  template: {
    nome: string;
    descricao?: string;
  };
}

type PublicAssessmentErrorCode = 'NOT_FOUND' | 'EXPIRED' | 'COMPLETED' | 'UNAVAILABLE' | 'INTERNAL_ERROR';

const invokePublicAssessment = async <T,>(body: Record<string, unknown> | FormData): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('public-assessment', { body });
  if (error) {
    const context = error.context as Response | undefined;
    const payload = context ? await context.clone().json().catch(() => null) : null;
    const apiError = new Error(payload?.error || 'Não foi possível acessar o questionário') as Error & { code?: PublicAssessmentErrorCode };
    apiError.code = payload?.code;
    throw apiError;
  }
  return data as T;
};

// Wrapper component: light background with bottom purple glow preserved
const AssessmentShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 relative overflow-hidden">
    {/* Bottom purple glow */}
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_center,hsl(250,80%,60%,0.18),transparent_70%)]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_center,hsl(250,80%,50%,0.12),transparent_70%)]" />
    </div>
    <div className="relative z-10">
      {children}
    </div>
    {/* Footer */}
    <div className="relative z-10 text-center pb-6 pt-8">
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="h-3 w-3" />
        <span>Plataforma segura — Powered by</span>
        <span className="font-semibold text-slate-700">Akuris</span>
      </div>
    </div>
  </div>
);

// === Top Bar (A + H kept) ===
const TopBar = ({
  assessment,
  logoError,
  logoLoading,
  onLogoLoad,
  onLogoError,
  savedAt,
  saving,
}: {
  assessment: AssessmentData;
  logoError: boolean;
  logoLoading: boolean;
  onLogoLoad: () => void;
  onLogoError: () => void;
  savedAt: Date | null;
  saving: boolean;
}) => {
  const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <header className="relative z-20 border-b border-white/10 bg-[hsl(230,25%,7%)]">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Akuris brand */}
        <div className="flex items-center gap-2 shrink-0">
          <img src="/akuris-logo.png" alt="Akuris" className="h-7 w-auto opacity-90" />
        </div>

        {/* Center: Company + template */}
        <div className="flex items-center gap-3 min-w-0 flex-1 justify-center">
          <div className="relative h-8 w-8 shrink-0">
            {logoLoading && assessment.empresa.logo_url && (
              <div className="absolute inset-0 flex items-center justify-center">
                <AkurisPulse size={16} />
              </div>
            )}
            <img
              src={logoError ? getCompanyLogo(null) : getCompanyLogo(assessment.empresa.logo_url)}
              alt={`Logo ${assessment.empresa.nome}`}
              className={cn('h-8 w-8 object-contain rounded', logoLoading && assessment.empresa.logo_url ? 'opacity-0' : 'opacity-100', 'transition-opacity duration-300')}
              onLoad={onLogoLoad}
              onError={onLogoError}
            />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs text-white/40 leading-tight">Solicitado por</p>
            <p className="text-sm text-white font-medium leading-tight truncate">{assessment.empresa.nome}</p>
          </div>
        </div>

        {/* Right: spacer to balance layout */}
        <div className="shrink-0 w-8" />
      </div>
    </header>
  );
};

// === Welcome Screen (B) ===
const WelcomeScreen = ({
  assessment,
  totalQuestions,
  totalRequired,
  onStart,
}: {
  assessment: AssessmentData;
  totalQuestions: number;
  totalRequired: number;
  onStart: () => void;
}) => {
  const estimatedMinutes = Math.max(5, Math.round(totalQuestions * 0.75));
  const deadlineRaw = assessment.data_limite ? new Date(assessment.data_limite) : null;
  const deadline = deadlineRaw && !isNaN(deadlineRaw.getTime()) ? deadlineRaw : null;
  const now = new Date();
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const overdue = deadline ? deadline.getTime() < now.getTime() : false;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="space-y-6 animate-fade-in">
        {/* Hero */}
        <Card className="bg-white border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[hsl(250,80%,60%)]/10 via-transparent to-[hsl(250,80%,60%)]/5 p-8 sm:p-10">
            <div className="flex items-center gap-2 mb-4">
              <AkurisAIIcon className="h-4 w-4 text-[hsl(250,80%,55%)]" />
              <span className="text-xs font-medium uppercase tracking-wider text-[hsl(250,80%,55%)]">
                Questionário de Due Diligence
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 leading-tight">
              Olá, {assessment.fornecedor_nome.split(' ')[0]} 👋
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              <span className="text-slate-900 font-medium">{assessment.empresa.nome}</span> precisa
              de algumas informações sobre sua empresa para concluir o processo de avaliação.
              Suas respostas são confidenciais e serão analisadas pela equipe responsável.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 border-t border-slate-200">
            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="h-10 w-10 rounded-lg bg-[hsl(250,80%,60%)]/15 flex items-center justify-center shrink-0">
                  <ListChecks className="h-5 w-5 text-[hsl(250,80%,55%)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Perguntas</p>
                  <p className="text-base font-semibold text-slate-900">{totalQuestions} no total</p>
                  {totalRequired > 0 && (
                    <p className="text-[11px] text-slate-500">{totalRequired} obrigatórias</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="h-10 w-10 rounded-lg bg-[hsl(250,80%,60%)]/15 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-[hsl(250,80%,55%)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Tempo estimado</p>
                  <p className="text-base font-semibold text-slate-900">~{estimatedMinutes} min</p>
                  <p className="text-[11px] text-slate-500">Pode pausar e voltar</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                  "bg-[hsl(250,80%,60%)]/15"
                )}>
                  <Calendar className={cn(
                    "h-5 w-5",
                    "text-[hsl(250,80%,55%)]"
                  )} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Prazo</p>
                  <p className="text-base font-semibold text-slate-900">
                    {deadline ? deadline.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Sem prazo'}
                  </p>
                  <p className={cn(
                    "text-[11px]",
                    overdue ? "text-[hsl(250,80%,45%)] font-medium" : "text-slate-500"
                  )}>
                    {!deadline ? 'Sem prazo definido' : overdue ? 'Em atraso' : daysLeft === 0 ? 'Vence hoje' : `Faltam ${daysLeft} dias`}
                  </p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2 mb-6">
              <h3 className="text-sm font-semibold text-slate-800">Antes de começar:</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Suas respostas são <strong className="text-slate-900">salvas automaticamente</strong> a cada alteração.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Você pode <strong className="text-slate-900">fechar e voltar</strong> a qualquer momento usando o mesmo link.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Algumas perguntas podem solicitar <strong className="text-slate-900">evidências</strong> ou anexo de documentos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Após finalizar, <strong className="text-slate-900">não será possível editar</strong> as respostas.</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={onStart}
              size="lg"
              className="w-full bg-gradient-to-r from-[hsl(250,80%,60%)] to-[hsl(250,80%,50%)] hover:from-[hsl(250,80%,55%)] hover:to-[hsl(250,80%,45%)] text-white shadow-lg shadow-[hsl(250,80%,60%)]/30"
            >
              Começar questionário
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function Assessment() {
  const { token } = useParams();
  
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(-1); // -1 = welcome screen
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [logoLoading, setLogoLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<{ title: string; message: string } | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const questionsPerPage = 5;
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const currentQuestions = questions.slice(
    currentPage * questionsPerPage,
    (currentPage + 1) * questionsPerPage
  );

  const isAnswered = useCallback((qId: string) => {
    const v = responses[qId];
    return v !== undefined && v !== null && v.toString().trim() !== '';
  }, [responses]);

  const calculateProgress = () => {
    if (questions.length === 0) return 0;
    const answeredQuestions = questions.filter(q => isAnswered(q.id)).length;
    return (answeredQuestions / questions.length) * 100;
  };

  const totalRequired = useMemo(() => questions.filter(q => q.obrigatoria).length, [questions]);

  // Page status for sidebar
  const pageStatuses = useMemo(() => {
    const statuses: { answered: number; total: number; required: number; missingRequired: number }[] = [];
    for (let p = 0; p < totalPages; p++) {
      const slice = questions.slice(p * questionsPerPage, (p + 1) * questionsPerPage);
      const answered = slice.filter(q => isAnswered(q.id)).length;
      const required = slice.filter(q => q.obrigatoria).length;
      const missingRequired = slice.filter(q => q.obrigatoria && !isAnswered(q.id)).length;
      statuses.push({ answered, total: slice.length, required, missingRequired });
    }
    return statuses;
  }, [questions, totalPages, isAnswered]);

  const handleLogoLoad = useCallback(() => {
    setLogoLoading(false);
    setLogoError(false);
  }, []);

  const handleLogoError = useCallback(() => {
    setLogoLoading(false);
    setLogoError(true);
  }, []);

  const fetchAssessment = useCallback(async () => {
    if (!token) {
      assessmentLogger.error('Token não fornecido');
      return;
    }

    try {
      setLoading(true);
      const payload = await invokePublicAssessment<{
        assessment: AssessmentData;
        questions: QuestionData[];
        responses: Array<{ question_id: string; resposta: string | null; pontuacao: number | null; evidencia: string | null; justificativa: string | null; arquivo_url: string | null; arquivo_signed_url: string | null }>;
      }>({ action: 'load', token });
      const assessment = payload.assessment;

      if (assessment.status === 'concluido') {
        setIsFinished(true);
        setAssessment({
          id: assessment.id,
          fornecedor_nome: assessment.fornecedor_nome,
          status: assessment.status,
          data_envio: assessment.data_envio,
          data_limite: assessment.data_limite,
          data_conclusao: assessment.data_conclusao,
          empresa: assessment.empresa,
          template: assessment.template
        });
        return;
      }

      const questionsData = payload.questions;
      const responsesData = payload.responses;

      if (!questionsData || questionsData.length === 0) {
        throw new Error('Este questionário não possui perguntas configuradas. Por favor, entre em contato com o remetente.');
      }

      const responsesMap: Record<string, any> = {};
      responsesData.forEach((response: any) => {
        responsesMap[response.question_id] = response.resposta || response.pontuacao;
        if (response.evidencia) responsesMap[`${response.question_id}_evidencia`] = response.evidencia;
        if (response.justificativa) responsesMap[`${response.question_id}_justificativa`] = response.justificativa;
        if (response.arquivo_url) responsesMap[`${response.question_id}_arquivo`] = response.arquivo_url;
        if (response.arquivo_signed_url) responsesMap[`${response.question_id}_arquivo_url`] = response.arquivo_signed_url;
      });

      setAssessment({
        id: assessment.id,
        fornecedor_nome: assessment.fornecedor_nome,
        status: assessment.status,
        data_envio: assessment.data_envio,
        data_limite: assessment.data_limite,
        data_conclusao: assessment.data_conclusao,
        empresa: assessment.empresa,
        template: assessment.template
      });
      
      setQuestions(questionsData.map((q: any) => ({
        id: q.id,
        titulo: q.titulo,
        descricao: q.descricao,
        pergunta: q.titulo || q.pergunta,
        tipo: q.tipo,
        opcoes: q.opcoes,
        obrigatoria: q.obrigatoria,
        peso: q.peso,
        ordem: q.ordem,
        configuracoes: q.configuracoes
      })));
      setResponses(responsesMap);

      // If user already has any responses, skip welcome screen
      if (Object.keys(responsesMap).length > 0) {
        setCurrentPage(0);
      }
      
    } catch (error) {
      assessmentLogger.error('Erro ao carregar assessment:', error);
      const code = (error as Error & { code?: PublicAssessmentErrorCode }).code;
      setLoadError(code === 'EXPIRED'
        ? { title: 'Link expirado', message: 'O prazo para responder este questionário terminou. Solicite um novo link ao remetente.' }
        : code === 'NOT_FOUND'
          ? { title: 'Link inválido', message: 'Este link não corresponde a um questionário disponível.' }
          : code === 'UNAVAILABLE'
            ? { title: 'Questionário indisponível', message: 'Este questionário não está disponível para resposta.' }
            : { title: 'Não foi possível carregar', message: 'Ocorreu uma falha temporária. Tente novamente em alguns instantes.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveResponse = useCallback(async (questionId: string, value: any) => {
    if (!assessment) return;

    try {
      setSaving(true);
      const isEvidencia = questionId.endsWith('_evidencia');
      const isJustificativa = questionId.endsWith('_justificativa');
      const isArquivo = questionId.endsWith('_arquivo');
      const baseQuestionId = isEvidencia || isJustificativa || isArquivo ? 
        questionId.replace(/_evidencia|_justificativa|_arquivo$/, '') : questionId;

      const question = questions.find(q => q.id === baseQuestionId);
      const responseData: any = {
        assessment_id: assessment.id,
        question_id: baseQuestionId
      };

      if (isEvidencia || isJustificativa || isArquivo) {
        try {
          const existingResponse = await supabaseRequest(
            `due_diligence_responses?assessment_id=eq.${assessment.id}&question_id=eq.${baseQuestionId}`,
            { method: 'GET' }
          );
          
          if (existingResponse && existingResponse.length > 0) {
            const updateData: any = {};
            if (isEvidencia) updateData.evidencia = value;
            else if (isJustificativa) updateData.justificativa = value;
            else if (isArquivo) updateData.arquivo_url = value;

            await supabaseRequest(
              `due_diligence_responses?assessment_id=eq.${assessment.id}&question_id=eq.${baseQuestionId}`,
              { method: 'PATCH', body: JSON.stringify(updateData) }
            );
          } else {
            if (isEvidencia) responseData.evidencia = value;
            else if (isJustificativa) responseData.justificativa = value;
            else if (isArquivo) responseData.arquivo_url = value;
            await supabaseRequest('due_diligence_responses', {
              method: 'POST', body: JSON.stringify(responseData)
            });
          }
        } catch (error) {
          assessmentLogger.error('Erro ao salvar evidência/justificativa:', error);
        }
        setSavedAt(new Date());
        return;
      }

      if (question?.tipo === 'numerico') {
        responseData.pontuacao = parseFloat(value) || 0;
      } else {
        responseData.resposta = value;
      }

      try {
        const existingResponse = await supabaseRequest(
          `due_diligence_responses?assessment_id=eq.${assessment.id}&question_id=eq.${questionId}`,
          { method: 'GET' }
        );
        
        if (existingResponse && existingResponse.length > 0) {
          await supabaseRequest(
            `due_diligence_responses?assessment_id=eq.${assessment.id}&question_id=eq.${questionId}`,
            { method: 'PATCH', body: JSON.stringify(responseData) }
          );
        } else {
          await supabaseRequest('due_diligence_responses', {
            method: 'POST', body: JSON.stringify(responseData)
          });
        }
      } catch (error) {
        await supabaseRequest('due_diligence_responses', {
          method: 'POST', body: JSON.stringify(responseData)
        });
      }
      setSavedAt(new Date());
    } catch (error) {
      assessmentLogger.error('Erro ao salvar resposta:', error);
    } finally {
      setSaving(false);
    }
  }, [assessment, questions, supabaseRequest]);

  const handleResponseChange = useCallback((questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveResponse(questionId, value);
    }, 1000);
  }, [saveResponse]);

  const submitAssessment = useCallback(async () => {
    if (!assessment) return;

    try {
      setSubmitting(true);

      if (assessment.status === 'concluido') {
        setIsFinished(true);
        return;
      }

      const requiredQuestions = questions.filter(q => q.obrigatoria);
      const missingRequired = requiredQuestions.filter(q => !isAnswered(q.id));

      if (missingRequired.length > 0) {
        toast.error(`Existem ${missingRequired.length} pergunta(s) obrigatória(s) sem resposta.`);
        return;
      }

      for (const [questionId, value] of Object.entries(responses)) {
        if (value && value.toString().trim()) {
          await saveResponse(questionId, value);
        }
      }

      const { error: updateError } = await supabase
        .from('due_diligence_assessments')
        .update({
          status: 'concluido',
          data_conclusao: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('link_token', token)
        .select();

      if (updateError) {
        throw new Error(`Erro ao finalizar assessment: ${updateError.message}`);
      }

      try {
        await supabase.functions.invoke('calculate-assessment-score', {
          body: { assessment_id: assessment.id }
        });
      } catch (scoreError) {
        assessmentLogger.warn('Erro ao calcular score:', scoreError);
      }

      setAssessment(prev => prev ? {
        ...prev,
        status: 'concluido',
        data_conclusao: new Date().toISOString()
      } : null);

      setIsFinished(true);
      toast.success('Questionário enviado com sucesso e está sendo avaliado!');

    } catch (error: any) {
      assessmentLogger.error('Erro ao finalizar assessment:', error);
      toast.error(`Erro ao enviar questionário: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
      setShowConfirmDialog(false);
    }
  }, [assessment, questions, responses, saveResponse, token, isAnswered]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  // === RENDER: Loading ===
  if (loading) {
    return (
      <AssessmentShell>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <AkurisPulse size={48} className="mb-4" />
            <p className="text-slate-600 text-sm">Carregando questionário...</p>
          </div>
        </div>
      </AssessmentShell>
    );
  }

  // === RENDER: Error ===
  if (!assessment) {
    return (
      <AssessmentShell>
        <div className="flex items-center justify-center min-h-[80vh] p-4">
          <Card className="w-full max-w-md bg-white border-slate-200 shadow-xl">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-slate-900">Questionário não encontrado</h2>
              <p className="text-slate-500">
                O link pode ter expirado ou ser inválido.
              </p>
            </CardContent>
          </Card>
        </div>
      </AssessmentShell>
    );
  }

  // === RENDER: Completed ===
  if (assessment.status === 'concluido' || isFinished) {
    return (
      <AssessmentShell>
        <div className="flex items-center justify-center min-h-[80vh] p-4">
          <div className="text-center max-w-lg mx-auto">
            <div className="relative mb-8 animate-scale-in">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                <CheckCircle className="w-12 h-12 text-white animate-fade-in" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-[hsl(250,80%,60%)] to-[hsl(250,80%,50%)] rounded-full animate-pulse"></div>
            </div>
            
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-3xl font-bold text-slate-900">Questionário Enviado!</h2>
              <p className="text-lg text-slate-600 max-w-md mx-auto leading-relaxed">
                Obrigado por responder ao questionário de due diligence. 
                Suas respostas foram enviadas com sucesso e estão sendo analisadas pela equipe da {assessment.empresa.nome}.
              </p>
              
              <div className="mt-8 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-center space-x-3 text-emerald-600 mb-3">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Concluído com sucesso</span>
                </div>
                {assessment.data_conclusao && (
                  <p className="text-sm text-slate-500">
                    <strong className="text-slate-700">Concluído em:</strong>{' '}
                    {new Date(assessment.data_conclusao).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </AssessmentShell>
    );
  }

  const progress = calculateProgress();
  const answeredCount = questions.filter(q => isAnswered(q.id)).length;
  const missingRequiredList = questions.filter(q => q.obrigatoria && !isAnswered(q.id));

  // === RENDER: Welcome screen (B) ===
  if (currentPage === -1) {
    return (
      <AssessmentShell>
        <TopBar
          assessment={assessment}
          logoError={logoError}
          logoLoading={logoLoading}
          onLogoLoad={handleLogoLoad}
          onLogoError={handleLogoError}
          savedAt={savedAt}
          saving={saving}
        />
        <WelcomeScreen
          assessment={assessment}
          totalQuestions={questions.length}
          totalRequired={totalRequired}
          onStart={() => setCurrentPage(0)}
        />
      </AssessmentShell>
    );
  }

  // === RENDER: Main form with sidebar (C) ===
  return (
    <AssessmentShell>
      <TopBar
        assessment={assessment}
        logoError={logoError}
        logoLoading={logoLoading}
        onLogoLoad={handleLogoLoad}
        onLogoError={handleLogoError}
        savedAt={savedAt}
        saving={saving}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* === Sidebar === */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              {/* Progress card */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Progresso</span>
                    <span className="text-xs font-semibold text-slate-900">{Math.round(progress)}%</span>
                  </div>
                  <Progress
                    value={progress}
                    className="h-2 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-[hsl(250,80%,60%)] [&>div]:to-[hsl(250,80%,50%)] mb-3"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{answeredCount} de {questions.length}</span>
                    {missingRequiredList.length > 0 && (
                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                        <AlertTriangle className="h-3 w-3 text-[hsl(250,80%,55%)]" />
                        {missingRequiredList.length} obrig.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Summary card — replaces "Páginas" header */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2.5">
                  {(() => {
                    const deadlineRaw = assessment.data_limite ? new Date(assessment.data_limite) : null;
                    const validDeadline = deadlineRaw && !isNaN(deadlineRaw.getTime()) ? deadlineRaw : null;
                    const now = new Date();
                    const daysLeft = validDeadline
                      ? Math.ceil((validDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    const overdue = daysLeft !== null && daysLeft < 0;
                    const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
                    const remainingQuestions = questions.length - answeredCount;
                    const estimatedMinutes = Math.max(1, Math.round(remainingQuestions * 0.75));

                    return (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            Prazo
                          </span>
                          <span className={cn(
                            'font-semibold',
                            overdue ? 'text-[hsl(250,80%,45%)]' : urgent ? 'text-slate-900' : 'text-slate-700'
                          )}>
                            {daysLeft === null
                              ? 'Sem prazo'
                              : overdue
                                ? 'Em atraso'
                                : daysLeft === 0
                                  ? 'Vence hoje'
                                  : `${daysLeft}d restantes`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="h-3.5 w-3.5" />
                            Tempo estimado
                          </span>
                          <span className="font-semibold text-slate-700">~{estimatedMinutes} min</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Save className="h-3.5 w-3.5" />
                            Último salvamento
                          </span>
                          <span className="font-semibold text-slate-700 text-right">
                            {savedAt
                              ? savedAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Sections (was "Páginas") */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Seções
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-1 pr-2">
                      {Array.from({ length: totalPages }).map((_, idx) => {
                        const status = pageStatuses[idx];
                        const isCurrent = currentPage === idx;
                        const isComplete = status && status.answered === status.total && status.missingRequired === 0;
                        const hasContent = status && status.answered > 0;

                        // Use first question title as section label
                        const firstQuestion = questions[idx * questionsPerPage];
                        const sectionLabel = firstQuestion?.titulo || firstQuestion?.pergunta || `Seção ${idx + 1}`;

                        return (
                          <button
                            key={idx}
                            onClick={() => setCurrentPage(idx)}
                            className={cn(
                              'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 group',
                              'flex items-center gap-3',
                              isCurrent
                                ? 'bg-[hsl(250,80%,60%)]/10 border border-[hsl(250,80%,60%)]/30'
                                : 'hover:bg-slate-50 border border-transparent'
                            )}
                          >
                            {/* Status icon */}
                            <div className={cn(
                              'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-colors',
                              isComplete
                                ? 'bg-slate-900 text-white'
                                : isCurrent
                                  ? 'bg-[hsl(250,80%,60%)]/20 text-[hsl(250,80%,40%)]'
                                  : hasContent
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-slate-100 text-slate-500'
                            )}>
                              {isComplete ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                'text-sm font-medium truncate',
                                isCurrent ? 'text-slate-900' : 'text-slate-700'
                              )} title={sectionLabel}>
                                {sectionLabel}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {status?.answered || 0}/{status?.total || 0} respondidas
                                {status && status.missingRequired > 0 && (
                                  <span className="text-slate-600"> · {status.missingRequired} obrig.</span>
                                )}
                              </p>
                            </div>

                            {isCurrent && <ChevronRight className="h-4 w-4 text-[hsl(250,80%,55%)] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Pendencies — only show when there are missing required */}
              {missingRequiredList.length > 0 && (
                <Card className="bg-white border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-[hsl(250,80%,55%)]" />
                      Pendências obrigatórias
                      <span className="ml-auto text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {missingRequiredList.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[260px]">
                      <ul className="space-y-1 pr-2">
                        {missingRequiredList.map((q) => {
                          const qIdx = questions.findIndex(x => x.id === q.id);
                          const pageOfQ = Math.floor(qIdx / questionsPerPage);
                          return (
                            <li key={q.id}>
                              <button
                                onClick={() => setCurrentPage(pageOfQ)}
                                className="w-full text-left flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 p-2 rounded hover:bg-slate-50 transition-colors"
                              >
                                <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="flex-1 truncate" title={q.titulo || q.pergunta}>
                                  {q.titulo || q.pergunta}
                                </span>
                                <span className="text-[10px] text-slate-500 shrink-0">Pág. {pageOfQ + 1}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </aside>

          {/* === Main content === */}
          <main className="min-w-0">
            {/* Mobile progress */}
            <Card className="lg:hidden mb-4 bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-slate-500">
                    Página {currentPage + 1} de {totalPages}
                  </span>
                  <span className="text-xs font-semibold text-slate-900">{Math.round(progress)}%</span>
                </div>
                <Progress
                  value={progress}
                  className="h-2 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-[hsl(250,80%,60%)] [&>div]:to-[hsl(250,80%,50%)]"
                />
              </CardContent>
            </Card>

            {/* Page header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1">
                  {assessment.template.nome}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Página {currentPage + 1}
                  <span className="text-slate-400 font-normal text-base ml-2">de {totalPages}</span>
                </h2>
              </div>
            </div>

            {/* Questions list (D + E) */}
            <div className="space-y-4">
              {currentQuestions.map((question, index) => {
                const answered = isAnswered(question.id);
                const questionNumber = currentPage * questionsPerPage + index + 1;

                return (
                  <Card
                    key={question.id}
                    className={cn(
                      'border bg-white transition-all duration-300 overflow-hidden animate-fade-in shadow-sm',
                      answered
                        ? 'border-slate-300 shadow-[0_0_0_1px_hsl(250,80%,60%,0.08),0_8px_24px_-12px_hsl(250,80%,60%,0.18)]'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <CardContent className="p-6 sm:p-7 space-y-5">
                      {/* Question header */}
                      <div className="flex items-start gap-4">
                        {/* Number badge */}
                        <div className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors',
                          answered
                            ? 'bg-slate-900 text-white border border-slate-900'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        )}>
                          {answered ? <Check className="h-4 w-4" /> : questionNumber}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
                              {question.titulo || question.pergunta}
                            </h3>
                            {question.obrigatoria && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 mt-1">
                                Obrigatória
                              </span>
                            )}
                          </div>
                          {question.descricao && (
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {question.descricao}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Input controls */}
                      <div className="pl-0 sm:pl-[52px]">
                        {question.tipo === 'texto' && (
                          <Textarea
                            value={responses[question.id] || ''}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            placeholder="Digite sua resposta..."
                            className="min-h-[120px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[hsl(250,80%,60%)]/60 focus:ring-2 focus:ring-[hsl(250,80%,60%)]/20 transition-all duration-200"
                          />
                        )}

                        {question.tipo === 'radio' && question.opcoes && (
                          <RadioGroup
                            value={responses[question.id] || ''}
                            onValueChange={(value) => handleResponseChange(question.id, value)}
                            className="space-y-2"
                          >
                            {question.opcoes.map((opcao, idx) => {
                              const selected = responses[question.id] === opcao;
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    'flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer',
                                    selected
                                      ? 'bg-[hsl(250,80%,60%)]/10 border-[hsl(250,80%,60%)]/40'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                  )}
                                  onClick={() => handleResponseChange(question.id, opcao)}
                                >
                                  <RadioGroupItem value={opcao} id={`${question.id}-${idx}`} className="border-slate-300 text-[hsl(250,80%,55%)]" />
                                  <Label htmlFor={`${question.id}-${idx}`} className="text-sm font-medium cursor-pointer flex-1 text-slate-800">{opcao}</Label>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        )}

                        {question.tipo === 'numerico' && (
                          <Input
                            type="number"
                            value={responses[question.id] || ''}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            placeholder="Digite um número..."
                            className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[hsl(250,80%,60%)]/60 focus:ring-2 focus:ring-[hsl(250,80%,60%)]/20 transition-all duration-200"
                          />
                        )}

                        {question.tipo === 'booleano' && (
                          <RadioGroup
                            value={responses[question.id] || ''}
                            onValueChange={(value) => handleResponseChange(question.id, value)}
                            className="grid grid-cols-2 gap-3"
                          >
                            {[
                              { value: 'sim', label: 'Sim' },
                              { value: 'nao', label: 'Não' },
                            ].map((opt) => {
                              const selected = responses[question.id] === opt.value;
                              return (
                                <div
                                  key={opt.value}
                                  className={cn(
                                    'flex items-center justify-center space-x-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer',
                                    selected
                                      ? 'bg-[hsl(250,80%,60%)]/10 border-[hsl(250,80%,60%)]/40'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                  )}
                                  onClick={() => handleResponseChange(question.id, opt.value)}
                                >
                                  <RadioGroupItem value={opt.value} id={`${question.id}-${opt.value}`} className="border-slate-300 text-[hsl(250,80%,55%)]" />
                                  <Label htmlFor={`${question.id}-${opt.value}`} className="text-sm font-semibold cursor-pointer text-slate-800">{opt.label}</Label>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        )}

                        {question.tipo === 'select' && question.opcoes && (
                          <Select
                            value={responses[question.id] || ''}
                            onValueChange={(value) => handleResponseChange(question.id, value)}
                          >
                            <SelectTrigger className="bg-white border-slate-200 text-slate-900 focus:border-[hsl(250,80%,60%)]/60 focus:ring-2 focus:ring-[hsl(250,80%,60%)]/20 transition-all duration-200">
                              <SelectValue placeholder="Selecione uma opção..." />
                            </SelectTrigger>
                            <SelectContent>
                              {question.opcoes.map((opcao, idx) => (
                                <SelectItem key={idx} value={opcao}>
                                  {opcao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {question.tipo === 'arquivo' && (
                          <div className="space-y-3">
                            <div className="border-2 border-dashed border-slate-200 hover:border-[hsl(250,80%,60%)]/40 rounded-xl p-6 text-center transition-colors duration-200 bg-slate-50/50">
                              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                              <p className="text-sm text-slate-500 mb-3">
                                Arraste um arquivo ou clique para selecionar
                              </p>
                              <Input
                                type="file"
                                className="bg-white border-slate-200 text-slate-700"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (file.size > 10 * 1024 * 1024) {
                                    toast.error('Arquivo deve ter no máximo 10MB.');
                                    return;
                                  }
                                  try {
                                    toast.info('Enviando arquivo...');
                                    const fileName = `${Date.now()}-${file.name}`;
                                    const filePath = `${assessment?.id || 'temp'}/${question.id}/${fileName}`;
                                    const { error: uploadError } = await supabase.storage
                                      .from('due-diligence-evidencias')
                                      .upload(filePath, file);
                                    if (uploadError) throw uploadError;
                                    const { data: { publicUrl } } = supabase.storage
                                      .from('due-diligence-evidencias')
                                      .getPublicUrl(filePath);
                                    handleResponseChange(question.id, file.name);
                                    handleResponseChange(`${question.id}_arquivo`, publicUrl);
                                    toast.success('Arquivo enviado com sucesso!');
                                  } catch (err: any) {
                                    assessmentLogger.error('Erro no upload:', err);
                                    toast.error('Erro ao enviar arquivo. Tente novamente.');
                                  }
                                }}
                              />
                            </div>
                            {responses[question.id] && (
                              <div className="flex items-center space-x-3 text-sm text-slate-700 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <FileText className="h-4 w-4 text-slate-500" />
                                <span className="font-medium">{responses[question.id]}</span>
                                {responses[`${question.id}_arquivo`] && (
                                  <a href={responses[`${question.id}_arquivo`]} target="_blank" rel="noopener noreferrer" className="text-[hsl(250,80%,55%)] underline text-xs ml-auto">
                                    Ver arquivo
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Conditional evidence and justification fields */}
                        {question.configuracoes && responses[question.id] && (
                          <>
                            {question.configuracoes.mostrar_evidencia_quando &&
                             question.configuracoes.mostrar_evidencia_quando.split(',').includes(responses[question.id]) && (
                              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg animate-fade-in">
                                <Label className="text-sm font-medium text-slate-700 mb-3 block">
                                  {question.configuracoes.label_evidencia || 'Evidência:'}
                                </Label>
                                <Textarea
                                  value={responses[`${question.id}_evidencia`] || ''}
                                  onChange={(e) => handleResponseChange(`${question.id}_evidencia`, e.target.value)}
                                  placeholder="Descreva as evidências que comprovam sua resposta..."
                                  className="min-h-[100px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[hsl(250,80%,60%)]/60 focus:ring-2 focus:ring-[hsl(250,80%,60%)]/20 transition-all duration-200 mb-4"
                                />
                                <div className="space-y-3">
                                  <Label className="text-sm font-medium text-slate-700 block">
                                    Anexar documento (opcional):
                                  </Label>
                                  <div className="border-2 border-dashed border-slate-200 hover:border-[hsl(250,80%,60%)]/40 rounded-lg p-4 text-center transition-colors duration-200 bg-white">
                                    <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                                    <p className="text-xs text-slate-600 mb-2">
                                      Clique para selecionar um arquivo
                                    </p>
                                    <Input
                                      type="file"
                                      className="text-xs bg-white border-slate-200 text-slate-700 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-700"
                                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (file.size > 10 * 1024 * 1024) {
                                          toast.error('Arquivo deve ter no máximo 10MB.');
                                          return;
                                        }
                                        try {
                                          toast.info('Enviando evidência...');
                                          const fileName = `${Date.now()}-${file.name}`;
                                          const filePath = `${assessment?.id || 'temp'}/evidencias/${question.id}/${fileName}`;
                                          const { error: uploadError } = await supabase.storage
                                            .from('due-diligence-evidencias')
                                            .upload(filePath, file);
                                          if (uploadError) throw uploadError;
                                          const { data: { publicUrl } } = supabase.storage
                                            .from('due-diligence-evidencias')
                                            .getPublicUrl(filePath);
                                          handleResponseChange(`${question.id}_arquivo`, publicUrl);
                                          toast.success('Evidência anexada com sucesso!');
                                        } catch (err: any) {
                                          assessmentLogger.error('Erro no upload de evidência:', err);
                                          toast.error('Erro ao enviar arquivo. Tente novamente.');
                                        }
                                      }}
                                    />
                                  </div>
                                  {responses[`${question.id}_arquivo`] && (
                                    <div className="flex items-center space-x-2 text-xs text-slate-700 bg-white p-2 rounded border border-slate-200">
                                      <FileText className="h-3 w-3 text-slate-500" />
                                      <span>Evidência anexada</span>
                                      <a href={responses[`${question.id}_arquivo`]} target="_blank" rel="noopener noreferrer" className="text-[hsl(250,80%,55%)] underline ml-auto">
                                        Ver
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {question.configuracoes.mostrar_justificativa_quando &&
                             question.configuracoes.mostrar_justificativa_quando.split(',').includes(responses[question.id]) && (
                              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg animate-fade-in">
                                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                                  {question.configuracoes.label_justificativa || 'Justificativa:'}
                                </Label>
                                <Textarea
                                  value={responses[`${question.id}_justificativa`] || ''}
                                  onChange={(e) => handleResponseChange(`${question.id}_justificativa`, e.target.value)}
                                  placeholder="Explique o motivo e planos futuros..."
                                  className="min-h-[100px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[hsl(250,80%,60%)]/60 focus:ring-2 focus:ring-[hsl(250,80%,60%)]/20 transition-all duration-200"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8 gap-3 animate-fade-in">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                size="lg"
                className="shadow-sm border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>

              {currentPage === totalPages - 1 ? (
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={submitting}
                  size="lg"
                  className="shadow-lg shadow-[hsl(250,80%,60%)]/20 bg-gradient-to-r from-[hsl(250,80%,60%)] to-[hsl(250,80%,50%)] hover:from-[hsl(250,80%,55%)] hover:to-[hsl(250,80%,45%)] text-white px-6 sm:px-8"
                >
                  {submitting ? (
                    <>
                      <AkurisPulse size={16} className="mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Finalizar Questionário
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  size="lg"
                  className="shadow-md shadow-[hsl(250,80%,60%)]/20 bg-gradient-to-r from-[hsl(250,80%,60%)] to-[hsl(250,80%,50%)] hover:from-[hsl(250,80%,55%)] hover:to-[hsl(250,80%,45%)] text-white"
                >
                  Próxima página
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* === Confirmation dialog (G - enriched) === */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-white border-slate-200 shadow-2xl max-w-lg">
          <AlertDialogHeader className="space-y-3">
            <div className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full mx-auto',
              missingRequiredList.length > 0
                ? 'bg-amber-100'
                : 'bg-[hsl(250,80%,60%)]/15'
            )}>
              {missingRequiredList.length > 0 ? (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              ) : (
                <CheckCircle className="w-6 h-6 text-[hsl(250,80%,55%)]" />
              )}
            </div>
            <AlertDialogTitle className="text-center text-xl text-slate-900">
              {missingRequiredList.length > 0
                ? 'Existem perguntas obrigatórias pendentes'
                : 'Finalizar Questionário'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center text-slate-600 leading-relaxed space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900">{questions.length}</p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-0.5">Total</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-700">{answeredCount}</p>
                    <p className="text-[11px] text-emerald-700/80 uppercase tracking-wider mt-0.5">Respondidas</p>
                  </div>
                  <div className={cn(
                    'p-3 border rounded-lg',
                    missingRequiredList.length > 0
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  )}>
                    <p className={cn(
                      'text-2xl font-bold',
                      missingRequiredList.length > 0 ? 'text-amber-700' : 'text-slate-600'
                    )}>
                      {missingRequiredList.length}
                    </p>
                    <p className={cn(
                      'text-[11px] uppercase tracking-wider mt-0.5',
                      missingRequiredList.length > 0 ? 'text-amber-700/80' : 'text-slate-500'
                    )}>
                      Pendentes
                    </p>
                  </div>
                </div>

                {/* Missing list */}
                {missingRequiredList.length > 0 ? (
                  <div className="text-left space-y-2 mt-2">
                    <p className="text-sm text-amber-700 font-medium flex items-center gap-2">
                      <FileQuestion className="h-4 w-4" />
                      Perguntas obrigatórias sem resposta:
                    </p>
                    <ScrollArea className="max-h-[180px]">
                      <ul className="space-y-1.5 pr-2">
                        {missingRequiredList.slice(0, 10).map((q) => {
                          const qIdx = questions.findIndex(x => x.id === q.id);
                          const pageOfQ = Math.floor(qIdx / questionsPerPage);
                          return (
                            <li key={q.id}>
                              <button
                                onClick={() => {
                                  setShowConfirmDialog(false);
                                  setCurrentPage(pageOfQ);
                                }}
                                className="w-full text-left flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 p-2 rounded hover:bg-slate-50 transition-colors"
                              >
                                <ChevronRight className="h-3 w-3 text-amber-600 shrink-0" />
                                <span className="flex-1 truncate">{q.titulo || q.pergunta}</span>
                                <span className="text-[10px] text-slate-500 shrink-0">Pág. {pageOfQ + 1}</span>
                              </button>
                            </li>
                          );
                        })}
                        {missingRequiredList.length > 10 && (
                          <li className="text-xs text-slate-500 px-2">
                            ...e mais {missingRequiredList.length - 10} pergunta(s)
                          </li>
                        )}
                      </ul>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">
                    Tem certeza que deseja finalizar e enviar o questionário?
                    <br />
                    <span className="text-slate-500 text-xs">Após o envio, não será possível fazer alterações.</span>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={submitting}
              className="flex-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              {missingRequiredList.length > 0 ? 'Voltar e responder' : 'Cancelar'}
            </Button>
            {missingRequiredList.length === 0 && (
              <AlertDialogAction 
                onClick={submitAssessment} 
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-[hsl(250,80%,60%)] to-[hsl(250,80%,50%)] hover:from-[hsl(250,80%,55%)] hover:to-[hsl(250,80%,45%)] text-white shadow-lg shadow-[hsl(250,80%,60%)]/20"
              >
                {submitting ? (
                  <>
                    <AkurisPulse size={16} className="mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar envio
                  </>
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AssessmentShell>
  );
}
