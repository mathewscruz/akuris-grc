import { useEffect, useState } from 'react';
import { IconSuccess, IconInfo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

interface AdherenceAnalysisProgressProps {
  currentProgress: number;
  currentStep: string;
  isError?: boolean;
  errorMessage?: string;
  detail?: string;
  documentName?: string;
  normaName?: string;
}

/** Índice (0..3) da etapa visível a partir da etapa técnica. */
function etapaVisivel(step: string, progress: number, detail?: string, understanding?: string): number {
  if (progress >= 100 || step === 'finalizing') return 3;
  if (step === 'analyzing') return detail && understanding && detail === understanding ? 1 : 2;
  if (step === 'identifying') return progress >= 35 ? 1 : 0;
  return 0;
}

export function AdherenceAnalysisProgress({
  currentProgress, currentStep, isError = false, errorMessage, detail, documentName, normaName,
}: AdherenceAnalysisProgressProps) {
  const { t } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  const done = currentProgress >= 100 && !isError;

  useEffect(() => {
    if (done || isError) return;
    const i = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(i);
  }, [done, isError]);

  const k = (s: string) => t(`gapAnalysis.adherenceUi.verdict.ui.${s}`);
  const ativo = etapaVisivel(currentStep, currentProgress, detail, t('gapAnalysis.adherenceUi.scope.understanding'));
  const etapas = ['stepRead', 'stepTheme', 'stepEval', 'stepReport'].map((id, i) => {
    let status: StepStatus = i < ativo || done ? 'completed' : i === ativo ? 'active' : 'pending';
    if (isError && i === ativo) status = 'error';
    return { id, status };
  });

  const fmt = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  const restante = () => {
    if (currentProgress < 10) return '~2m';
    const r = Math.round((elapsed / currentProgress) * (100 - currentProgress));
    return r < 60 ? `~${r}s` : `~${Math.round(r / 60)}m`;
  };

  // Contagens "0 de 1" não informam nada: mostra a frase simples.
  const detalhe = detail && /\b0\s+(de|of)\s+1\b/.test(detail) ? k('evaluatingPlain') : detail;

  const pct = Math.max(0, Math.min(100, Math.round(currentProgress)));
  const R = 52, C = 2 * Math.PI * R;

  return (
    <div className="space-y-6 py-2">
      {/* Anel de progresso */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} className="fill-none stroke-muted" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={R} strokeWidth="8" strokeLinecap="round"
              className={cn('fill-none transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none',
                isError ? 'stroke-destructive' : done ? 'stroke-success' : 'stroke-primary')}
              strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {done ? (
              <IconSuccess className="h-10 w-10 text-success animate-in zoom-in-50 duration-500" strokeWidth={1.5} />
            ) : isError ? (
              <IconInfo className="h-10 w-10 text-destructive" strokeWidth={1.5} />
            ) : (
              <span className="text-3xl font-bold tabular-nums text-foreground">{pct}%</span>
            )}
          </div>
        </div>
        {(normaName || documentName) && (
          <div className="space-y-0.5">
            {normaName && <p className="text-sm font-semibold text-foreground">{normaName}</p>}
            {documentName && <p className="max-w-[340px] truncate text-xs text-muted-foreground">{documentName}</p>}
          </div>
        )}
        {isError && <p className="text-sm text-destructive">{errorMessage || t('gapAnalysis.adherenceUi.progress.errorDefault')}</p>}
        {done && (
          <p className="text-sm font-medium text-success animate-in fade-in duration-500">{t('gapAnalysis.adherenceUi.progress.successTitle')}</p>
        )}
        {!done && !isError && (
          <div className="flex gap-4 text-xs text-muted-foreground tabular-nums">
            <span>{k('elapsed')}: <span className="text-foreground">{fmt(elapsed)}</span></span>
            <span>{k('remaining')}: <span className="text-foreground">{restante()}</span></span>
          </div>
        )}
      </div>

      {/* Etapas */}
      <ol className="relative space-y-1">
        {etapas.map((e, i) => (
          <li
            key={e.id}
            className={cn(
              'relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-500 animate-in fade-in slide-in-from-bottom-1',
              e.status === 'active' && 'bg-primary/5 ring-1 ring-primary/20',
              e.status === 'pending' && 'opacity-50',
              e.status === 'error' && 'bg-destructive/5 ring-1 ring-destructive/20',
            )}
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
          >
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
              {e.status === 'completed' && <IconSuccess className="h-5 w-5 text-success animate-in zoom-in-50 duration-300" strokeWidth={1.5} />}
              {e.status === 'active' && <AkurisPulse size={18} />}
              {e.status === 'pending' && <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
              {e.status === 'error' && <IconInfo className="h-5 w-5 text-destructive" strokeWidth={1.5} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', e.status === 'active' ? 'text-foreground' : 'text-muted-foreground', e.status === 'error' && 'text-destructive')}>
                {k(e.id)}
              </p>
              {e.status === 'active' && detalhe ? (
                <p key={detalhe} className="mt-0.5 text-xs text-muted-foreground animate-in fade-in slide-in-from-left-1 duration-300">{detalhe}</p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">{k(`${e.id}_d`)}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {!done && !isError && (
        <p className="text-center text-xs text-muted-foreground">{k('canClose')}</p>
      )}
    </div>
  );
}
