/**
 * KpiTiny — KPI compacto para rows densas (Documentos 4-col, SoA 7-col).
 * Eyebrow uppercase + valor herói tabular + foot opcional.
 * Aceita accent tone para listra superior.
 */
import { cn } from '@/lib/utils';

export type KpiTone = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' | 'info';

interface KpiTinyProps {
  eyebrow: string;
  value: React.ReactNode;
  unit?: string;
  foot?: React.ReactNode;
  tone?: KpiTone;
  className?: string;
}

const ACCENT: Record<KpiTone, string> = {
  neutral: 'before:bg-border',
  primary: 'before:bg-primary',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  destructive: 'before:bg-destructive',
  info: 'before:bg-info',
};

const VALUE_COLOR: Record<KpiTone, string> = {
  neutral: 'text-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
};

export function KpiTiny({
  eyebrow,
  value,
  unit,
  foot,
  tone = 'neutral',
  className,
}: KpiTinyProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-card px-3.5 py-3',
        'before:absolute before:left-0 before:top-0 before:h-0.5 before:w-full',
        ACCENT[tone],
        className
      )}
    >
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </div>
      <div className={cn('mt-1 flex items-baseline gap-1', VALUE_COLOR[tone])}>
        <span className="text-2xl font-semibold tabular-nums leading-none tracking-tight">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {foot && (
        <div className="mt-1.5 text-[11px] text-muted-foreground">{foot}</div>
      )}
    </div>
  );
}
