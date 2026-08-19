import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconWarning, IconTrendUp, IconTrendDown, IconMinus, IconAward } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale } from '@/lib/date-utils';

interface ScoreData {
  score_total: number;
  classificacao: string;
  score_breakdown: Record<string, number>;
  observacoes_ia?: string;
  created_at: string;
}

interface ScoreVisualizationProps {
  scoreData: ScoreData;
  assessmentData?: {
    fornecedor_nome: string;
    template: { nome: string; categoria: string };
  };
}

export function ScoreVisualization({ scoreData, assessmentData }: ScoreVisualizationProps) {
  const { t } = useLanguage();

  const classificationLabels: Record<string, string> = {
    excelente: t('dueDiligence.scoreVisualization.classificationExcellent'),
    bom: t('dueDiligence.scoreVisualization.classificationGood'),
    regular: t('dueDiligence.scoreVisualization.classificationRegular'),
    ruim: t('dueDiligence.scoreVisualization.classificationBad'),
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'excelente': return 'text-success';
      case 'bom': return 'text-info';
      case 'regular': return 'text-warning';
      case 'ruim': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'excelente': return { variant: 'default' as const, icon: IconAward };
      case 'bom': return { variant: 'secondary' as const, icon: IconTrendUp };
      case 'regular': return { variant: 'outline' as const, icon: IconMinus };
      case 'ruim': return { variant: 'destructive' as const, icon: IconWarning };
      default: return { variant: 'outline' as const, icon: IconMinus };
    }
  };

  const getScoreColor = (score: number) => {
    // Escala de percentagem, como o valor gravado.
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-info';
    if (score >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  const classificationBadge = getClassificationBadge(scoreData.classificacao);
  const ClassificationIcon = classificationBadge.icon;

  const breakdownEntries = Object.entries(scoreData.score_breakdown || {});

  return (
    <div className="space-y-6">
      {/* Header com informações principais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {assessmentData ? t('dueDiligence.scoreVisualization.titleWithSupplier', { fornecedor: assessmentData.fornecedor_nome }) : t('dueDiligence.scoreVisualization.titleFallback')}
              </CardTitle>
              {assessmentData && (
                <p className="text-sm text-muted-foreground">
                  {t('dueDiligence.scoreVisualization.templateCategoryLine', { template: assessmentData.template.nome, categoria: assessmentData.template.categoria })}
                </p>
              )}
            </div>
            <Badge variant={classificationBadge.variant} className="flex items-center gap-1">
              <ClassificationIcon className="h-3 w-3" />
              {classificationLabels[scoreData.classificacao] ?? scoreData.classificacao}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Score principal */}
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <div className={`text-4xl font-bold ${getClassificationColor(scoreData.classificacao)}`}>
                {scoreData.score_total.toFixed(1)}%
              </div>
              <div className="text-lg text-muted-foreground">
                {t('dueDiligence.scoreVisualization.compliancePercentage')}
              </div>
            </div>
            
            <div className="w-full max-w-sm mx-auto">
              <Progress 
                value={scoreData.score_total} 
                className="h-3"
                style={{
                  '--progress-background': getScoreColor(scoreData.score_total / 10)
                } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Data da avaliação */}
          <div className="text-center text-sm text-muted-foreground">
            {t('dueDiligence.scoreVisualization.evaluatedAt', {
              data: new Date(scoreData.created_at).toLocaleDateString(intlLocale(), {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            })}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown por categoria */}
      {breakdownEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dueDiligence.scoreVisualization.breakdownTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdownEntries.map(([categoria, score]) => (
                <div key={categoria} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium capitalize">{categoria}</span>
                    <span className={`font-semibold ${getClassificationColor(
                      score >= 80 ? 'excelente' : score >= 60 ? 'bom' : score >= 40 ? 'regular' : 'ruim'
                    )}`}>
                      {score.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={score} 
                    className="h-2"
                    style={{
                      '--progress-background': getScoreColor(score / 10)
                    } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observações da IA */}
      {scoreData.observacoes_ia && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <IconAward className="h-4 w-4" />
              {t('dueDiligence.scoreVisualization.aiAnalysisTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {scoreData.observacoes_ia}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recomendações baseadas na classificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dueDiligence.scoreVisualization.recommendationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {scoreData.classificacao === 'excelente' && (
              <p className="text-success">
                {t('dueDiligence.scoreVisualization.recommendationExcellent')}
              </p>
            )}
            {scoreData.classificacao === 'bom' && (
              <p className="text-info">
                {t('dueDiligence.scoreVisualization.recommendationGood')}
              </p>
            )}
            {scoreData.classificacao === 'regular' && (
              <p className="text-warning">
                {t('dueDiligence.scoreVisualization.recommendationRegular')}
              </p>
            )}
            {scoreData.classificacao === 'ruim' && (
              <p className="text-destructive">
                {t('dueDiligence.scoreVisualization.recommendationBad')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}