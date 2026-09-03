import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  IconArrowRight,
  IconCheck,
  IconFileCheck,
  IconShieldCheck,
  IconTarget,
} from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type FrameworkJourneyAction =
  | 'scope'
  | 'diagnosis'
  | 'adaptation'
  | 'evidence'
  | 'review';

interface FrameworkJourneyNextActionProps {
  scopeDeclared: boolean;
  unevaluated: number;
  openGaps: number;
  missingEvidence: number | null;
  applicable?: number;
  evaluated?: number;
  compliant?: number;
  proven?: number | null;
  onDefineScope: () => void;
  onContinueDiagnosis: () => void;
  onOpenAdaptation: () => void;
  onOpenEvidence: () => void;
}

export function getFrameworkJourneyAction({
  scopeDeclared,
  unevaluated,
  openGaps,
  missingEvidence,
}: Pick<
  FrameworkJourneyNextActionProps,
  'scopeDeclared' | 'unevaluated' | 'openGaps' | 'missingEvidence'
>): FrameworkJourneyAction {
  if (!scopeDeclared) return 'scope';
  if (unevaluated > 0) return 'diagnosis';
  if (openGaps > 0) return 'adaptation';
  if (missingEvidence !== null && missingEvidence > 0) return 'evidence';
  return 'review';
}

export function FrameworkJourneyNextAction({
  scopeDeclared,
  unevaluated,
  openGaps,
  missingEvidence,
  applicable = 0,
  evaluated = 0,
  compliant = 0,
  proven = null,
  onDefineScope,
  onContinueDiagnosis,
  onOpenAdaptation,
  onOpenEvidence,
}: FrameworkJourneyNextActionProps) {
  const { t } = useLanguage();
  const action = getFrameworkJourneyAction({ scopeDeclared, unevaluated, openGaps, missingEvidence });

  const actionContent = {
    scope: {
      icon: IconShieldCheck,
      title: t('gapV2.journey.scopeTitle'),
      description: t('gapV2.journey.scopeDescription'),
      cta: t('gapV2.journey.scopeAction'),
      onClick: onDefineScope,
    },
    diagnosis: {
      icon: IconTarget,
      title: t('gapV2.journey.diagnosisTitle'),
      description: t('gapV2.journey.diagnosisDescription', { count: unevaluated }),
      cta: t('gapV2.journey.diagnosisAction'),
      onClick: onContinueDiagnosis,
    },
    adaptation: {
      icon: IconShieldCheck,
      title: t('gapV2.journey.adaptationTitle'),
      description: t('gapV2.journey.adaptationDescription', { count: openGaps }),
      cta: t('gapV2.journey.adaptationAction'),
      onClick: onOpenAdaptation,
    },
    evidence: {
      icon: IconFileCheck,
      title: t('gapV2.journey.evidenceTitle'),
      description: t('gapV2.journey.evidenceDescription', { count: missingEvidence ?? 0 }),
      cta: t('gapV2.journey.evidenceAction'),
      onClick: onOpenEvidence,
    },
    review: {
      icon: IconCheck,
      title: t('gapV2.journey.reviewTitle'),
      description: t('gapV2.journey.reviewDescription'),
      cta: t('gapV2.journey.reviewAction'),
      onClick: onOpenEvidence,
    },
  } satisfies Record<FrameworkJourneyAction, {
    icon: typeof IconTarget;
    title: string;
    description: string;
    cta: string;
    onClick: () => void;
  }>;

  const current = actionContent[action];
  const CurrentIcon = current.icon;
  const diagnosisDone = scopeDeclared && unevaluated === 0;
  const adaptationDone = diagnosisDone && openGaps === 0;
  const evidenceDone = adaptationDone && missingEvidence === 0;
  const currentStage = action === 'scope' || action === 'diagnosis'
    ? 'diagnosis'
    : action === 'adaptation'
      ? 'adaptation'
      : 'evidence';
  const stages = [
    { key: 'diagnosis', label: t('gapV2.journey.stageDiagnosis'), done: diagnosisDone, completed: evaluated, total: applicable },
    { key: 'adaptation', label: t('gapV2.journey.stageAdaptation'), done: adaptationDone, completed: compliant, total: applicable },
    { key: 'evidence', label: t('gapV2.journey.stageEvidence'), done: evidenceDone, completed: proven, total: compliant },
  ];

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-elegant">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {t('gapV2.journey.eyebrow')}
          </p>
          <div className="mt-2 flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CurrentIcon className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{current.description}</p>
            </div>
          </div>
        </div>
        <Button onClick={current.onClick} className="w-full sm:w-auto">
          {current.cta}
          <IconArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      <ol className="grid border-t border-border/70 bg-muted/20 sm:grid-cols-3">
        {stages.map((stage, index) => {
          const active = stage.key === currentStage && !stage.done;
          const hasProgress = stage.completed !== null && stage.total > 0;
          const completed = stage.completed ?? 0;
          const progress = hasProgress
            ? Math.max(0, Math.min(100, Math.round((completed / stage.total) * 100)))
            : 0;
          return (
            <li
              key={stage.key}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2.5 px-4 py-3 text-xs font-medium',
                index > 0 && 'border-t border-border/70 sm:border-l sm:border-t-0',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-micro tabular-nums',
                  stage.done && 'border-success bg-success text-success-foreground',
                  active && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {stage.done ? <IconCheck className="h-3 w-3" strokeWidth={2} /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span>{stage.label}</span>
                  <span className="font-mono text-micro tabular-nums text-muted-foreground">
                    {hasProgress
                      ? t('gapV2.journey.stageProgress', { done: completed, total: stage.total })
                      : '—'}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={stage.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className={cn('h-full rounded-full transition-[width]', stage.done ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
