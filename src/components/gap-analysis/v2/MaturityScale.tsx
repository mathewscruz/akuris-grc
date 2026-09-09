/**
 * Historical component name; displays adherence bands, not CMMI maturity.
 * A percentage of requirements cannot establish measured process capability.
 */
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface MaturityScaleProps {
  /** Score 0-100. */
  score: number;
  className?: string;
  /** Mostra labels embaixo de cada barra. */
  showLabels?: boolean;
}

function getLevels(t: (key: string) => string) {
  return [
    { id: 1, label: t('calculationMethod.initial'), min: 0, color: 'bg-destructive' },
    { id: 2, label: t('calculationMethod.low'), min: 20, color: 'bg-destructive/70' },
    { id: 3, label: t('calculationMethod.developing'), min: 40, color: 'bg-warning' },
    { id: 4, label: t('calculationMethod.intermediate'), min: 60, color: 'bg-primary' },
    { id: 5, label: t('calculationMethod.high'), min: 80, color: 'bg-success' },
  ];
}

export function getMaturityLevel(score: number, t: (key: string) => string) {
  const levels = getLevels(t);
  let current = levels[0];
  for (const l of levels) if (score >= l.min) current = l;
  return current;
}

export function MaturityScale({ score, className, showLabels = true }: MaturityScaleProps) {
  const { t } = useLanguage();
  const LEVELS = getLevels(t);
  const current = getMaturityLevel(score, t);

  return (
    <div className={cn('w-full', className)} title={t('calculationMethod.gap')}>
      <div className="grid grid-cols-5 gap-1">
        {LEVELS.map((l) => {
          const reached = l.id <= current.id;
          return (
            <div key={l.id} className="space-y-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-colors',
                  reached ? l.color : 'bg-muted'
                )}
              />
              {showLabels && (
                <div
                  className={cn(
                    'text-micro font-mono tabular-nums',
                    reached ? 'text-foreground/80' : 'text-muted-foreground'
                  )}
                >
                  {l.id} · {l.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
