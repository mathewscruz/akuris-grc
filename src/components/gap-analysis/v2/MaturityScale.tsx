/**
 * MaturityScale — barra horizontal de 5 níveis CMMI-like.
 * 1 Inicial · 2 Gerenciado · 3 Definido · 4 Medido · 5 Otimizado
 * Cores via tokens semânticos. Nível atual derivado de score 0-100.
 */
import { cn } from '@/lib/utils';

interface MaturityScaleProps {
  /** Score 0-100. */
  score: number;
  className?: string;
  /** Mostra labels embaixo de cada barra. */
  showLabels?: boolean;
}

const LEVELS = [
  { id: 1, label: 'Inicial', min: 0, color: 'bg-destructive' },
  { id: 2, label: 'Gerenciado', min: 20, color: 'bg-destructive/70' },
  { id: 3, label: 'Definido', min: 40, color: 'bg-warning' },
  { id: 4, label: 'Medido', min: 60, color: 'bg-primary' },
  { id: 5, label: 'Otimizado', min: 80, color: 'bg-success' },
];

export function getMaturityLevel(score: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (score >= l.min) current = l;
  return current;
}

export function MaturityScale({ score, className, showLabels = true }: MaturityScaleProps) {
  const current = getMaturityLevel(score);

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
                    'text-[10px] font-mono tabular-nums',
                    reached ? 'text-foreground/80' : 'text-muted-foreground/60'
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
