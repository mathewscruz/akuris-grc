/**
 * MaturityScale — barra horizontal de 5 níveis CMMI-like.
 * 1 Inicial · 2 Gerenciado · 3 Definido · 4 Medido · 5 Otimizado
 * Cores via tokens semânticos. Nível atual derivado de score 0-100.
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
    { id: 1, label: t('sweepRiscos.gap.maturity.inicial'), min: 0, color: 'bg-destructive' },
    { id: 2, label: t('sweepRiscos.gap.maturity.gerenciado'), min: 20, color: 'bg-destructive/70' },
    { id: 3, label: t('sweepRiscos.gap.maturity.definido'), min: 40, color: 'bg-warning' },
    { id: 4, label: t('sweepRiscos.gap.maturity.medido'), min: 60, color: 'bg-primary' },
    { id: 5, label: t('sweepRiscos.gap.maturity.otimizado'), min: 80, color: 'bg-success' },
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
    <div className={cn('w-full', className)}>
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
