/**
 * KpiTiny — KPI compacto para rows densas (Documentos 4-col, SoA 7-col).
 * Eyebrow uppercase + valor herói tabular + foot opcional.
 * Aceita accent tone para listra superior.
 */
import { cn } from '@/lib/utils';
import { AnimatedMetricValue } from '@/components/ui/stat-strip';

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
        'relative overflow-hidden rounded-lg border border-border bg-card pl-4 pr-3.5 py-3',
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]',
        ACCENT[tone],
        className
      )}
    >
      <div className="text-xs text-muted-foreground">
        {eyebrow}
      </div>
      <div className={cn('mt-1 flex items-baseline gap-1', VALUE_COLOR[tone])}>
        <span className="text-2xl font-bold tabular-nums leading-none tracking-tight font-sans">
          {typeof value === 'number' || typeof value === 'string'
            ? <AnimatedMetricValue value={value} />
            : value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {foot && (
        <div className="mt-1.5 text-micro text-muted-foreground">{foot}</div>
      )}
    </div>
  );
}
