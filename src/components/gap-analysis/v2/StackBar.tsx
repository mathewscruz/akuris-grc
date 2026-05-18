/**
 * StackBar — barra empilhada de status de conformidade.
 * Usa tokens semânticos (success/warning/destructive/muted).
 * Reutilizado em frameworks ativos, hero de maturidade e tabelas.
 */
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type StackSegmentKind = 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel' | 'nao_avaliado';

export interface StackSegment {
  kind: StackSegmentKind;
  count: number;
  label?: string;
}

interface StackBarProps {
  segments: StackSegment[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

const SEG_COLOR: Record<StackSegmentKind, string> = {
  conforme: 'bg-success',
  parcial: 'bg-warning',
  nao_conforme: 'bg-destructive',
  nao_aplicavel: 'bg-info',
  nao_avaliado: 'bg-muted-foreground/40',
};

const SEG_LABEL: Record<StackSegmentKind, string> = {
  conforme: 'Conforme',
  parcial: 'Parcial',
  nao_conforme: 'Não Conforme',
  nao_aplicavel: 'N/A',
  nao_avaliado: 'Não Avaliado',
};

export function StackBar({ segments, height = 8, showLegend = false, className }: StackBarProps) {
  const total = segments.reduce((acc, s) => acc + s.count, 0) || 1;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="flex w-full overflow-hidden rounded-full bg-muted/50"
        style={{ height }}
      >
        {segments.map((s, i) => {
          if (s.count <= 0) return null;
          const pct = (s.count / total) * 100;
          return (
            <Tooltip key={`${s.kind}-${i}`}>
              <TooltipTrigger asChild>
                <div
                  className={cn('h-full transition-all duration-500', SEG_COLOR[s.kind])}
                  style={{ width: `${pct}%` }}
                  aria-label={`${SEG_LABEL[s.kind]}: ${s.count}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <span className="text-xs">
                  {s.label || SEG_LABEL[s.kind]}: <strong>{s.count}</strong> ({pct.toFixed(0)}%)
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          {segments.map((s, i) => (
            <span key={`${s.kind}-leg-${i}`} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-sm', SEG_COLOR[s.kind])} />
              <span>{s.label || SEG_LABEL[s.kind]}</span>
              <span className="font-semibold tabular-nums text-foreground">{s.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
