import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle2, AlertTriangle, Lightbulb, ArrowLeft, Download, TrendingUp, FileText, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import type { AdherenceAssessment, PontoForte, PontoMelhoria } from './types';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { supabase } from '@/integrations/supabase/client';
import { exportAssessmentToPDF } from './ExportPDF';
import { useToast } from '@/hooks/use-toast';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
interface AdherenceResultViewProps {
  assessment: AdherenceAssessment;
  onBack: () => void;
  frameworkId?: string;
  onApplied?: () => void;
}

export function AdherenceResultView({ assessment, onBack, frameworkId, onApplied }: AdherenceResultViewProps) {
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();
  const [applying, setApplying] = useState(false);
  const dateLocale = locale === 'en' ? enUS : ptBR;
  
  const { data: details } = useOptimizedQuery(
    async () => {
      const { data, error } = await supabase
        .from('gap_analysis_adherence_details')
        .select('*')
        .eq('assessment_id', assessment.id)
        .order('requisito_codigo');
      if (error) throw error;
      return { data, error: null };
    },
    [assessment.id],
    { cacheKey: `adherence-details-${assessment.id}`, cacheDuration: 60000 }
  );

  const { data: empresa } = useOptimizedQuery(
    async () => {
      if (!empresaId) return { data: null, error: null };
      const { data, error } = await supabase
        .from('empresas')
        .select('nome, logo_url')
        .eq('id', empresaId)
        .single();
      if (error) throw error;
      return { data, error: null };
    },
    [empresaId],
    { cacheKey: `empresa-${empresaId}`, cacheDuration: 300000 }
  );

  const getResultIconColor = (resultado?: string) => {
    switch (resultado) {
      case 'conforme':
        return { bg: 'bg-success/15', icon: 'text-success' };
      case 'nao_conforme':
        return { bg: 'bg-destructive/15', icon: 'text-destructive' };
      case 'parcial':
        return { bg: 'bg-warning/15', icon: 'text-warning' };
      default:
        return { bg: 'bg-muted', icon: 'text-muted-foreground' };
    }
  };

  const getResultLabel = (resultado?: string) => {
    switch (resultado) {
      case 'conforme': return t('gapAnalysis.adherenceUi.result.resultConforme');
      case 'nao_conforme': return t('gapAnalysis.adherenceUi.result.resultNaoConforme');
      case 'parcial': return t('gapAnalysis.adherenceUi.result.resultParcial');
      default: return t('gapAnalysis.adherenceUi.result.resultUnknown');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'conforme': return 'bg-success';
      case 'nao_conforme': return 'bg-destructive';
      case 'parcial': return 'bg-warning';
      case 'nao_aplicavel': return 'bg-muted-foreground/40';
      default: return 'bg-muted-foreground/40';
    }
  };

  const getPrioridadeBadgeVariant = (prioridade: string) => {
    switch (prioridade) {
      case 'alta': return 'destructive' as const;
      case 'media': return 'warning' as const;
      case 'baixa': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };
  
  const getPrioridadeLabel = (prioridade: string): string => {
    switch (prioridade) {
      case 'alta': return t('gapAnalysis.adherenceUi.result.priorityAlta');
      case 'media': return t('gapAnalysis.adherenceUi.result.priorityMedia');
      case 'baixa': return t('gapAnalysis.adherenceUi.result.priorityBaixa');
      default: return prioridade;
    }
  };

  const handleExportPDF = async () => {
    try {
      const { getCompanyLogoUrl } = await import('@/lib/brand-logo');
      await exportAssessmentToPDF(assessment, details, getCompanyLogoUrl(empresa?.logo_url), t, dateLocale);
      toast({ title: t('gapAnalysis.adherenceUi.result.pdfExportedTitle'), description: t('gapAnalysis.adherenceUi.result.pdfExportedDescription') });
    } catch (error) {
      logger.error('Error exporting PDF:', { error: error instanceof Error ? error.message : String(error) });
      toast({ title: t('gapAnalysis.adherenceUi.result.pdfExportErrorTitle'), description: t('gapAnalysis.adherenceUi.result.pdfExportErrorDescription'), variant: "destructive" });
    }
  };

  const handleApplyToEvaluation = async () => {
    if (!details || !empresaId || !frameworkId) return;
    setApplying(true);
    try {
      const applicableDetails = details.filter(
        (d: any) => d.requirement_id && d.status_aderencia && d.status_aderencia !== 'nao_aplicavel'
      );

      if (applicableDetails.length === 0) {
        toast({ title: t('gapAnalysis.adherenceUi.result.noApplicableResultsTitle'), description: t('gapAnalysis.adherenceUi.result.noApplicableResultsDescription') });
        return;
      }

      // Map adherence status to conformity_status
      const statusMap: Record<string, string> = {
        conforme: 'conforme',
        parcial: 'parcial',
        nao_conforme: 'nao_conforme',
      };

      let applied = 0;
      for (const detail of applicableDetails) {
        const conformityStatus = statusMap[detail.status_aderencia];
        if (!conformityStatus) continue;

        // Check if evaluation exists
        const { data: existing } = await supabase
          .from('gap_analysis_evaluations')
          .select('id, conformity_status')
          .eq('framework_id', frameworkId)
          .eq('requirement_id', detail.requirement_id)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (existing) {
          // Only update if current status is worse or not evaluated
          const priority: Record<string, number> = { nao_avaliado: 0, pendente: 0, nao_conforme: 1, parcial: 2, conforme: 3 };
          const currentPriority = priority[existing.conformity_status || 'nao_avaliado'] || 0;
          const newPriority = priority[conformityStatus] || 0;
          if (newPriority > currentPriority) {
            await supabase.from('gap_analysis_evaluations')
              .update({ conformity_status: conformityStatus, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
            applied++;
          }
        } else {
          await supabase.from('gap_analysis_evaluations')
            .insert({
              framework_id: frameworkId,
              requirement_id: detail.requirement_id,
              empresa_id: empresaId,
              conformity_status: conformityStatus,
              evidence_status: 'pendente',
              status: 'em_andamento',
              observacoes: t('gapAnalysis.adherenceUi.result.autoEvaluatedNote', { doc: assessment.documento_nome }),
            });
          applied++;
        }
      }

      toast({
        title: t('gapAnalysis.adherenceUi.result.appliedResultsTitle'),
        description: t('gapAnalysis.adherenceUi.result.appliedResultsDescription', { count: applied }),
      });
      onApplied?.();
    } catch (err: any) {
      logger.error('Error applying results:', { error: err instanceof Error ? err.message : String(err) });
      toast({ title: t('gapAnalysis.adherenceUi.result.applyErrorTitle'), description: t('gapAnalysis.adherenceUi.result.applyErrorDescription'), variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" strokeWidth={1.5}/>
          {t('gapAnalysis.adherenceUi.result.back')}
        </Button>
        <div className="flex gap-2">
          {frameworkId && details && details.length > 0 && (
            <Button variant="default" onClick={handleApplyToEvaluation} disabled={applying}>
              {applying ? (
                <><AkurisPulse size={16} className="mr-2" />{t('gapAnalysis.adherenceUi.result.applying')}</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5}/>{t('gapAnalysis.adherenceUi.result.applyToManualEvaluation')}</>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.exportPdf')}
          </Button>
        </div>
      </div>

      {/* Resultado Geral */}
      <Card className="p-8 border">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getResultIconColor(assessment.resultado_geral).bg} mb-3`}>
            {assessment.resultado_geral === 'conforme' ? (
              <CheckCircle2 className={`h-6 w-6 ${getResultIconColor(assessment.resultado_geral).icon}`} />
            ) : (
              <AlertTriangle className={`h-6 w-6 ${getResultIconColor(assessment.resultado_geral).icon}`} />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">{getResultLabel(assessment.resultado_geral)}</h2>
          <p className="text-4xl font-bold mb-4 text-foreground">{assessment.percentual_conformidade}%</p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">{t('gapAnalysis.adherenceUi.result.frameworkLabel')}</span> {assessment.framework_nome} {assessment.framework_versao}
            </div>
            <div>|</div>
            <div>
              <span className="font-medium">{t('gapAnalysis.adherenceUi.result.documentLabel')}</span> {assessment.documento_nome}
            </div>
          </div>
          <p className="text-xs mt-2 text-muted-foreground">
            {t('gapAnalysis.adherenceUi.result.analyzedOn', { date: format(new Date(assessment.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: dateLocale }) })}
          </p>
        </div>
      </Card>

      {/* Pontos Fortes */}
      {assessment.pontos_fortes && assessment.pontos_fortes.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.strongPointsTitle', { count: assessment.pontos_fortes.length })}
          </h3>
          <div className="space-y-3">
            {assessment.pontos_fortes.map((ponto: PontoForte, index: number) => (
              <Card key={index} className="p-4">
                <h4 className="font-semibold text-foreground mb-2">{ponto.titulo}</h4>
                <p className="text-sm text-muted-foreground">{ponto.descricao}</p>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Pontos de Melhoria */}
      {assessment.pontos_melhoria && assessment.pontos_melhoria.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.improvementPointsTitle', { count: assessment.pontos_melhoria.length })}
          </h3>
          <div className="space-y-3">
            {assessment.pontos_melhoria.map((ponto: PontoMelhoria, index: number) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-foreground">{ponto.titulo}</h4>
                  <Badge variant={getPrioridadeBadgeVariant(ponto.prioridade)} className="whitespace-nowrap">{getPrioridadeLabel(ponto.prioridade)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{ponto.descricao}</p>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Recomendações */}
      {assessment.recomendacoes && assessment.recomendacoes.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <Lightbulb className="h-5 w-5 text-muted-foreground" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.recommendationsTitle')}
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-foreground">
            {assessment.recomendacoes.map((rec: string, index: number) => (
              <li key={index} className="text-sm">{rec}</li>
            ))}
          </ol>
        </Card>
      )}

      {/* Análise Detalhada por Requisito */}
      {details && details.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" strokeWidth={1.5}/>
            {t('gapAnalysis.adherenceUi.result.detailedAnalysisTitle')}
          </h3>
          <Accordion type="single" collapsible className="w-full">
            {details.map((detail: any, index: number) => (
              <AccordionItem key={detail.id} value={`item-${index}`}>
                <AccordionTrigger>
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(detail.status_aderencia)}`} />
                      <span className="font-mono text-sm">{detail.requisito_codigo}</span>
                      <span className="text-sm">{detail.requisito_titulo}</span>
                    </div>
                    {detail.score_conformidade !== null && (
                      <Badge variant="outline">{detail.score_conformidade}/10</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {detail.evidencias_encontradas && (
                      <div>
                        <h5 className="font-semibold text-sm text-foreground mb-1">{t('gapAnalysis.adherenceUi.result.evidenceFound')}</h5>
                        <p className="text-sm text-muted-foreground">{detail.evidencias_encontradas}</p>
                      </div>
                    )}
                    {detail.gaps_especificos && (
                      <div>
                        <h5 className="font-semibold text-sm text-foreground mb-1">{t('gapAnalysis.adherenceUi.result.gapsIdentified')}</h5>
                        <p className="text-sm text-muted-foreground">{detail.gaps_especificos}</p>
                      </div>
                    )}
                    {detail.observacoes_ia && (
                      <div>
                        <h5 className="font-semibold text-sm text-foreground mb-1">{t('gapAnalysis.adherenceUi.result.aiObservations')}</h5>
                        <p className="text-sm text-muted-foreground">{detail.observacoes_ia}</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}

      {/* Análise Completa */}
      {assessment.analise_detalhada && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">{t('gapAnalysis.adherenceUi.result.fullAnalysisTitle')}</h3>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
            {assessment.analise_detalhada}
          </div>
        </Card>
      )}
    </div>
  );
}
