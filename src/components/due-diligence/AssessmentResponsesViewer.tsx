import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { IconDownload, IconCalendar, IconFile, IconPerson, IconMail } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDueDiligenceStatusTone } from '@/lib/status-tone';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { ScoreVisualization } from './ScoreVisualization';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
interface Assessment {
  id: string;
  fornecedor_nome: string;
  fornecedor_email: string;
  status: string;
  data_inicio?: string;
  data_conclusao?: string;
  data_expiracao: string;
  score_final?: number;
  template: {
    id: string;
    nome: string;
    categoria: string;
  };
}

interface Question {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  categoria?: string;
  obrigatoria: boolean;
  opcoes?: any;
  peso?: number;
  ordem: number;
}

interface Response {
  id: string;
  question_id: string;
  resposta: string;
  pontuacao?: number;
  created_at: string;
}

interface AssessmentResponsesViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: Assessment | null;
}

export function AssessmentResponsesViewer({
  open,
  onOpenChange,
  assessment
}: AssessmentResponsesViewerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [scoreData, setScoreData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (open && assessment) {
      fetchAssessmentData();
    }
  }, [open, assessment]);

  const fetchAssessmentData = async () => {
    if (!assessment) return;

    try {
      setLoading(true);

      // Buscar perguntas do template
      const { data: questionsData, error: questionsError } = await supabase
        .from('due_diligence_questions')
        .select('*')
        .eq('template_id', assessment.template.id)
        .order('ordem', { ascending: true });

      if (questionsError) throw questionsError;

      // Buscar respostas do assessment
      const { data: responsesData, error: responsesError } = await supabase
        .from('due_diligence_responses')
        .select('*')
        .eq('assessment_id', assessment.id);

      if (responsesError) throw responsesError;

      // Buscar dados do score
      const { data: scoreDataResult, error: scoreError } = await supabase
        .from('due_diligence_scores')
        .select('*')
        .eq('assessment_id', assessment.id)
        .single();

      if (scoreError && scoreError.code !== 'PGRST116') {
        console.error('Erro ao buscar score:', scoreError);
      }

      setQuestions(questionsData || []);
      setResponses(responsesData || []);
      setScoreData(scoreDataResult);

    } catch (error) {
      console.error('Erro ao buscar dados do assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResponseForQuestion = (questionId: string) => {
    return responses.find(r => r.question_id === questionId);
  };

  const getQuestionTypeLabel = (tipo: string) => {
    const types = {
      'texto': t('dueDiligence.assessmentResponsesViewer.typeText'),
      'textarea': t('dueDiligence.assessmentResponsesViewer.typeTextarea'),
      'radio': t('dueDiligence.assessmentResponsesViewer.typeRadio'),
      'checkbox': t('dueDiligence.assessmentResponsesViewer.typeCheckbox'),
      'booleano': t('dueDiligence.assessmentResponsesViewer.typeBoolean'),
      'numerico': t('dueDiligence.assessmentResponsesViewer.typeNumeric'),
      'data': t('dueDiligence.assessmentResponsesViewer.typeDate'),
      'arquivo': t('dueDiligence.assessmentResponsesViewer.typeFile')
    };
    return types[tipo as keyof typeof types] || tipo;
  };

  const formatResponse = (response: Response, question: Question) => {
    if (!response) return t('dueDiligence.assessmentResponsesViewer.notAnswered');
    
    switch (question.tipo) {
      case 'booleano':
        return response.resposta === 'sim' ? t('dueDiligence.assessmentResponsesViewer.yes') : t('dueDiligence.assessmentResponsesViewer.no');
      case 'data':
        try {
          return new Date(response.resposta).toLocaleDateString(intlLocale());
        } catch {
          return response.resposta;
        }
      case 'checkbox':
        try {
          const values = JSON.parse(response.resposta);
          return Array.isArray(values) ? values.join(', ') : response.resposta;
        } catch {
          return response.resposta;
        }
      default:
        return response.resposta;
    }
  };

  const groupQuestionsByCategory = () => {
    const grouped: Record<string, Question[]> = {};
    questions.forEach(question => {
      // Use categoria diretamente se estiver presente, senão usa 'geral'
      const categoria = question.categoria || 'geral';
      if (!grouped[categoria]) {
        grouped[categoria] = [];
      }
      grouped[categoria].push(question);
    });
    return grouped;
  };

  const exportToPDF = () => {
    // Funcionalidade para exportar respostas como PDF
    // Implementar posteriormente se necessário
    logger.debug('Exportar avaliação para PDF: por implementar');
  };

  if (!assessment) return null;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconFile}
      title={t('dueDiligence.assessmentResponsesViewer.title', { fornecedor: assessment.fornecedor_nome })}
      size="xl"
      hideFooter
    >
        <div>
          <div className="space-y-6 p-1">
            {/* Informações do Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconPerson className="h-4 w-4" />
                  {t('dueDiligence.assessmentResponsesViewer.infoCardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('dueDiligence.assessmentResponsesViewer.fieldSupplier')}</span>
                    <p className="font-medium">{assessment.fornecedor_nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('dueDiligence.assessmentResponsesViewer.fieldEmail')}</span>
                    <p className="font-medium">{assessment.fornecedor_email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('dueDiligence.assessmentResponsesViewer.fieldTemplate')}</span>
                    <p className="font-medium">{assessment.template.nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('dueDiligence.assessmentResponsesViewer.fieldStatus')}</span>
                    <StatusBadge {...resolveDueDiligenceStatusTone(assessment.status)}>{formatStatus(assessment.status)}</StatusBadge>
                  </div>
                  {assessment.data_conclusao && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <IconCalendar className="h-3 w-3" />
                        {t('dueDiligence.assessmentResponsesViewer.completedAt')}
                      </span>
                      <p className="font-medium">
                        {parseDataLocal(assessment.data_conclusao).toLocaleDateString(intlLocale(), {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Visualização do Score */}
            {scoreData && (
              <ScoreVisualization 
                scoreData={scoreData}
                assessmentData={{
                  fornecedor_nome: assessment.fornecedor_nome,
                  template: assessment.template
                }}
              />
            )}

            {/* Respostas por Categoria */}
            {loading ? (
              <div className="text-center py-8">
                <AkurisPulse size={32} />
                <p className="mt-2 text-muted-foreground">{t('dueDiligence.assessmentResponsesViewer.loadingResponses')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupQuestionsByCategory()).map(([categoria, categoryQuestions]) => (
                  <Card key={categoria}>
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">{categoria}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {categoryQuestions.map((question, index) => {
                        const response = getResponseForQuestion(question.id);
                        return (
                          <div key={question.id} className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {index + 1}.
                                  </span>
                                  <h4 className="font-medium">{question.titulo}</h4>
                                  {question.obrigatoria && (
                                    <StatusBadge tone="neutral" variant="outline">{t('dueDiligence.assessmentResponsesViewer.requiredBadge')}</StatusBadge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <StatusBadge tone="neutral">
                                    {getQuestionTypeLabel(question.tipo)}
                                  </StatusBadge>
                                  {question.peso && (
                                    <StatusBadge tone="neutral" variant="outline">
                                      {t('dueDiligence.assessmentResponsesViewer.weightLabel', { peso: question.peso })}
                                    </StatusBadge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-card p-3 rounded-md border border-border">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <span className="text-sm text-muted-foreground">{t('dueDiligence.assessmentResponsesViewer.responseLabel')}</span>
                                  <p className="font-medium mt-1">
                                    {formatResponse(response!, question)}
                                  </p>
                                </div>
                                {response?.pontuacao && (
                                  <div className="text-right">
                                    <span className="text-sm text-muted-foreground">{t('dueDiligence.assessmentResponsesViewer.scoreLabel')}</span>
                                    <p className="font-semibold text-primary">
                                      {response.pontuacao.toFixed(1)}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {response && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {t('dueDiligence.assessmentResponsesViewer.answeredAt', { data: new Date(response.created_at).toLocaleDateString(intlLocale(), {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) })}
                                </p>
                              )}
                            </div>
                            
                            {index < categoryQuestions.length - 1 && <Separator />}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Ações */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {t('dueDiligence.assessmentResponsesViewer.totalResponsesFooter', { responses: responses.length, questions: questions.length })}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={exportToPDF}
                  className="flex items-center gap-2"
                  disabled // Implementar posteriormente
                >
                  <IconDownload className="h-4 w-4" />
                  {t('dueDiligence.assessmentResponsesViewer.exportPdf')}
                </Button>
                <Button onClick={() => onOpenChange(false)}>
                  {t('dueDiligence.assessmentResponsesViewer.close')}
                </Button>
              </div>
            </div>
          </div>
        </div>
    </DialogShell>
  );
}