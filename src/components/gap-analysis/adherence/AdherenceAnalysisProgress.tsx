import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
interface ProgressStep {
  id: string;
  label: string;
  description: string;
  percentage: number;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface AdherenceAnalysisProgressProps {
  currentProgress: number;
  currentStep: string;
  isError?: boolean;
  errorMessage?: string;
}

export function AdherenceAnalysisProgress({ 
  currentProgress, 
  currentStep,
  isError = false,
  errorMessage
}: AdherenceAnalysisProgressProps) {
  const { t } = useLanguage();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer para mostrar tempo decorrido
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Definir as etapas do processo
  const steps: ProgressStep[] = [
    {
      id: 'extracting',
      label: t('gapAnalysis.adherenceUi.progress.steps.extracting.label'),
      description: t('gapAnalysis.adherenceUi.progress.steps.extracting.description'),
      percentage: 15,
      status: currentProgress >= 15 ? 'completed' : currentProgress > 0 ? 'active' : 'pending'
    },
    {
      id: 'uploading',
      label: t('gapAnalysis.adherenceUi.progress.steps.uploading.label'),
      description: t('gapAnalysis.adherenceUi.progress.steps.uploading.description'),
      percentage: 25,
      status: currentProgress >= 25 ? 'completed' : currentProgress > 15 ? 'active' : 'pending'
    },
    {
      id: 'preparing',
      label: t('gapAnalysis.adherenceUi.progress.steps.preparing.label'),
      description: t('gapAnalysis.adherenceUi.progress.steps.preparing.description'),
      percentage: 35,
      status: currentProgress >= 35 ? 'completed' : currentProgress > 25 ? 'active' : 'pending'
    },
    {
      id: 'identifying',
      label: t('gapAnalysis.adherenceUi.progress.steps.identifying.label'),
      description: t('gapAnalysis.adherenceUi.progress.steps.identifying.description'),
      percentage: 60,
      status: currentProgress >= 60 ? 'completed' : currentProgress > 35 ? 'active' : 'pending'
    },
    {
      id: 'analyzing',
      label: t('gapAnalysis.adherenceUi.progress.steps.analyzing.label'),
      description: t('gapAnalysis.adherenceUi.progress.steps.analyzing.description'),
      percentage: 90,
      status: currentProgress >= 90 ? 'completed' : currentProgress > 60 ? 'active' : 'pending'
    },
    {
      id: 'finalizing',
      label: t('gapAnalysis.adherenceUi.progress.steps.finalizing.label'),
      description: t('gapAnalysis.adherenceUi.progress.steps.finalizing.description'),
      percentage: 100,
      status: currentProgress >= 100 ? 'completed' : currentProgress > 90 ? 'active' : 'pending'
    }
  ];

  // Se houver erro, marcar etapa atual como erro
  if (isError && currentStep) {
    const errorStepIndex = steps.findIndex(s => s.id === currentStep);
    if (errorStepIndex !== -1) {
      steps[errorStepIndex].status = 'error';
    }
  }

  // Formatar tempo decorrido
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Estimar tempo restante (aproximado)
  const estimateRemainingTime = () => {
    if (currentProgress >= 100) return '0s';
    if (currentProgress < 10) return '~2m';
    
    const avgTimePerPercent = elapsedTime / currentProgress;
    const remainingPercent = 100 - currentProgress;
    const remainingSeconds = Math.round(avgTimePerPercent * remainingPercent);
    
    if (remainingSeconds < 60) return `~${remainingSeconds}s`;
    return `~${Math.round(remainingSeconds / 60)}m`;
  };

  return (
    <div className="space-y-6 py-4">
      {/* Título e status */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          {isError ? t('gapAnalysis.adherenceUi.progress.errorTitle') : currentProgress >= 100 ? t('gapAnalysis.adherenceUi.progress.completedTitle') : t('gapAnalysis.adherenceUi.progress.analyzingTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isError 
            ? errorMessage || t('gapAnalysis.adherenceUi.progress.errorDefault') 
            : currentProgress >= 100 
              ? t('gapAnalysis.adherenceUi.progress.completedDescription') 
              : t('gapAnalysis.adherenceUi.progress.waitDescription')}
        </p>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-2">
        <Progress value={currentProgress} className="h-3" />
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-primary">
            {Math.round(currentProgress)}%
          </span>
          {!isError && currentProgress < 100 && (
            <span className="text-muted-foreground">
              {t('gapAnalysis.adherenceUi.progress.elapsedRemaining', { elapsed: formatTime(elapsedTime), remaining: estimateRemainingTime() })}
            </span>
          )}
        </div>
      </div>

      {/* Lista de etapas */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg transition-all",
              step.status === 'active' && "bg-primary/5 border border-primary/20",
              step.status === 'completed' && "opacity-60",
              step.status === 'error' && "bg-destructive/5 border border-destructive/20"
            )}
          >
            {/* Ícone de status */}
            <div className="flex-shrink-0 mt-0.5">
              {step.status === 'completed' && (
                <CheckCircle2 className="h-5 w-5 text-green-600" strokeWidth={1.5}/>
              )}
              {step.status === 'active' && (
                <AkurisPulse size={20} className="text-primary" />
              )}
              {step.status === 'pending' && (
                <Circle className="h-5 w-5 text-muted-foreground" strokeWidth={1.5}/>
              )}
              {step.status === 'error' && (
                <AlertCircle className="h-5 w-5 text-destructive" strokeWidth={1.5}/>
              )}
            </div>

            {/* Conteúdo da etapa */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                step.status === 'active' && "text-primary",
                step.status === 'error' && "text-destructive"
              )}>
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step.description}
              </p>
            </div>

            {/* Percentual da etapa */}
            <div className="flex-shrink-0 text-xs font-medium text-muted-foreground">
              {step.percentage}%
            </div>
          </div>
        ))}
      </div>

      {/* Mensagem de conclusão */}
      {currentProgress >= 100 && !isError && (
        <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" strokeWidth={1.5}/>
          <p className="text-sm font-medium text-green-900 dark:text-green-100">
            {t('gapAnalysis.adherenceUi.progress.successTitle')}
          </p>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            {t('gapAnalysis.adherenceUi.progress.successDescription')}
          </p>
        </div>
      )}
    </div>
  );
}
