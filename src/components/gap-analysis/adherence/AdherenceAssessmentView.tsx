import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Eye, FileCheck, AlertTriangle, TrendingUp, Target, Trash2 } from 'lucide-react';
import { useAdherenceStats } from '@/hooks/useAdherenceStats';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { supabase } from '@/integrations/supabase/client';
import { formatDateOnly } from '@/lib/date-utils';
import { AdherenceAssessmentDialog } from './AdherenceAssessmentDialog';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { AdherenceAssessment } from './types';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface AdherenceAssessmentViewProps {
  onViewResult: (assessment: AdherenceAssessment) => void;
  frameworkId?: string;
  frameworkNome?: string;
  /** Quando embutido sob o DocumentsHero, esconde guidance/stats/botão duplicados
      e mostra apenas a lista de "Avaliações Recentes". */
  embedded?: boolean;
  /** Ao incrementar, abre o diálogo de nova avaliação (acionado pelos CTAs do hero). */
  openSignal?: number;
}

export function AdherenceAssessmentView({ onViewResult, frameworkId, frameworkNome, embedded, openSignal }: AdherenceAssessmentViewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: stats } = useAdherenceStats();

  // CTAs do DocumentsHero abrem este mesmo diálogo (antes eram botões mortos).
  useEffect(() => {
    if (openSignal) setIsDialogOpen(true);
  }, [openSignal]);

  const { data: assessments, loading: isLoading, refetch } = useOptimizedQuery(
    async () => {
      let query = supabase
        .from('gap_analysis_adherence_assessments')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtrar por framework se informado
      if (frameworkId) {
        query = query.eq('framework_id', frameworkId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    },
    [frameworkId],
    { cacheKey: `adherence-assessments-${frameworkId || 'all'}`, cacheDuration: 0 }
  );

  type Variant = 'success' | 'warning' | 'destructive' | 'secondary' | 'outline';

  const getStatusVariant = (status: string): Variant => {
    switch (status) {
      case 'concluido': return 'success';
      case 'processando': return 'secondary';
      case 'erro': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'concluido': return 'Concluído';
      case 'processando': return <><AkurisPulse size={12} className="mr-1 inline" />Processando</>;
      case 'erro': return 'Erro';
      default: return status;
    }
  };

  const getResultVariant = (resultado?: string): Variant => {
    switch (resultado) {
      case 'conforme': return 'success';
      case 'nao_conforme': return 'destructive';
      case 'parcial': return 'warning';
      default: return 'outline';
    }
  };

  const getResultLabel = (resultado?: string): string | null => {
    if (!resultado) return null;
    switch (resultado) {
      case 'conforme': return 'Conforme';
      case 'nao_conforme': return 'Não Conforme';
      case 'parcial': return 'Parcial';
      default: return resultado;
    }
  };

  const handleDelete = async () => {
    if (!assessmentToDelete) return;
    
    setIsDeleting(true);
    try {
      const assessment = (assessments as any[])?.find(a => a.id === assessmentToDelete);
      
      // 1. Excluir detalhes relacionados
      const { error: detailsError } = await supabase
        .from('gap_analysis_adherence_details')
        .delete()
        .eq('assessment_id', assessmentToDelete);
      
      if (detailsError) throw detailsError;

      // 2. Excluir arquivo do storage
      if (assessment?.storage_file_name) {
        const { error: storageError } = await supabase.storage
          .from('adherence-documents')
          .remove([assessment.storage_file_name]);
        
        if (storageError) {
          logger.error('Erro ao excluir arquivo do storage:', { error: storageError instanceof Error ? storageError.message : String(storageError) });
        }
      }

      // 3. Excluir registro principal
      const { error: assessmentError } = await supabase
        .from('gap_analysis_adherence_assessments')
        .delete()
        .eq('id', assessmentToDelete);
      
      if (assessmentError) throw assessmentError;

      toast.success('Avaliação excluída com sucesso');
      refetch();
    } catch (error: any) {
      logger.error('Erro ao excluir avaliação:', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Erro ao excluir avaliação: ' + error.message);
    } finally {
      setIsDeleting(false);
      setAssessmentToDelete(null);
    }
  };

  const statsCards = [
    {
      title: 'Total de Avaliações',
      value: stats?.totalAvaliacoes || 0,
      icon: <Target className="h-4 w-4" strokeWidth={1.5}/>,
      description: 'Avaliações realizadas'
    },
    {
      title: 'Avaliações Conformes',
      value: stats?.avaliacoesConformes || 0,
      icon: <FileCheck className="h-4 w-4" strokeWidth={1.5}/>,
      description: 'Documentos em conformidade'
    },
    {
      title: 'Não Conformes',
      value: stats?.avaliacoesNaoConformes || 0,
      icon: <AlertTriangle className="h-4 w-4" strokeWidth={1.5}/>,
      description: 'Requerem atenção'
    },
    {
      title: 'Conformidade Média',
      value: `${stats?.mediaConformidade || 0}%`,
      icon: <TrendingUp className="h-4 w-4" strokeWidth={1.5}/>,
      description: 'Média geral de conformidade'
    }
  ];

  const DOCUMENT_EXAMPLES: Record<string, string[]> = {
    'ISO': ['Política de Segurança da Informação', 'Matriz RACI', 'Relatório de Análise de Riscos', 'Plano de Continuidade de Negócios', 'Registro de Ativos'],
    'LGPD': ['Política de Privacidade', 'ROPA (Registro de Operações)', 'Termo de Consentimento', 'RIPD (Relatório de Impacto)', 'Procedimento de Atendimento ao Titular'],
    'NIST': ['Inventário de Ativos', 'Plano de Resposta a Incidentes', 'Política de Controle de Acesso', 'Relatório de Vulnerabilidades', 'Plano de Recuperação'],
    'PCI': ['Diagrama de Rede', 'Política de Senhas', 'Logs de Auditoria', 'Procedimento de Criptografia'],
  };

  const getDocExamples = (): string[] => {
    if (!frameworkNome) return ['Políticas', 'Procedimentos', 'Registros', 'Relatórios'];
    for (const [key, examples] of Object.entries(DOCUMENT_EXAMPLES)) {
      if (frameworkNome.toUpperCase().includes(key)) return examples;
    }
    return ['Políticas', 'Procedimentos', 'Registros', 'Relatórios'];
  };

  return (
    <div className="space-y-6">
      {/* Guidance Card — escondido quando embutido (o DocumentsHero já explica) */}
      {!embedded && (
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <FileCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.5}/>
          <div>
            <p className="text-sm font-medium mb-1">Como funciona a Análise de Documentos?</p>
            <p className="text-xs text-muted-foreground mb-2">
              Envie documentos como políticas, procedimentos, registros ou relatórios. A IA analisa automaticamente
              a aderência ao framework e sugere o status de conformidade para cada requisito relacionado.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground">Exemplos:</span>
              {getDocExamples().map((doc, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">{doc}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
      )}

      {/* Botão Nova Avaliação — escondido quando embutido (CTAs vivem no hero) */}
      {!embedded && (
      <div className="flex justify-end">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.5}/>
          Nova Avaliação
        </Button>
      </div>
      )}

      {/* Stats — escondido quando embutido (o DocumentsHero já traz os KPIs) */}
      {!embedded && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
      )}

      {/* Lista de Avaliações */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Avaliações Recentes</h3>
        
        {isLoading ? (
          <div className="min-h-[180px] flex flex-col items-center justify-center gap-2">
            <AkurisPulse size={48} />
            <p className="text-xs text-muted-foreground">Carregando avaliações...</p>
          </div>
        ) : assessments && assessments.length > 0 ? (
          <div className="space-y-4">
            {(assessments as any[]).map((assessment: any) => (
              <Card key={assessment.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{assessment.nome_analise}</h4>
                      <Badge variant={getStatusVariant(assessment.status)} className="whitespace-nowrap">{getStatusLabel(assessment.status)}</Badge>
                      {assessment.resultado_geral && <Badge variant={getResultVariant(assessment.resultado_geral)} className="whitespace-nowrap">{getResultLabel(assessment.resultado_geral)}</Badge>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                      <div>
                        <span className="font-medium">Framework:</span> {assessment.framework_nome} {assessment.framework_versao}
                      </div>
                      <div>
                        <span className="font-medium">Documento:</span> {assessment.documento_nome}
                      </div>
                    </div>

                    {assessment.status === 'processando' && (
                      <div className="flex items-center gap-2 text-info text-sm">
                        <AkurisPulse size={16} />
                        <span>Identificando requisitos relevantes e analisando... (1-2 minutos)</span>
                      </div>
                    )}

                    {assessment.status === 'concluido' && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Conformidade</span>
                            <span className="font-semibold">{assessment.percentual_conformidade}%</span>
                          </div>
                          <Progress value={assessment.percentual_conformidade} className="h-2" />
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      Analisado em {formatDateOnly(assessment.created_at)}
                    </p>
                  </div>

                  <div className="ml-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewResult(assessment)}
                      disabled={assessment.status !== 'concluido'}
                    >
                      <Eye className="mr-2 h-4 w-4" strokeWidth={1.5}/>
                      Ver Detalhes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAssessmentToDelete(assessment.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5}/>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" strokeWidth={1.5}/>
            <p className="text-muted-foreground mb-4">Nenhuma avaliação realizada ainda</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.5}/>
              Criar Primeira Avaliação
            </Button>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <AdherenceAssessmentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={refetch}
        preSelectedFrameworkId={frameworkId}
        preSelectedFrameworkNome={frameworkNome}
      />
      
      <ConfirmDialog
        open={!!assessmentToDelete}
        onOpenChange={(open) => !open && setAssessmentToDelete(null)}
        title="Excluir avaliação?"
        description="Esta ação não pode ser desfeita. A avaliação e todos os seus dados serão permanentemente removidos."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  );
}