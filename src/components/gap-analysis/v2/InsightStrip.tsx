/**
 * InsightStrip — card editorial de insight assistido pela IA.
 * Ribbon vertical colorida por tom + eyebrow + body + CTA.
 * Usado na página Avaliação (3 cards lado a lado).
 */
import { cn } from '@/lib/utils';
import { Sparkles, ArrowRight } from 'lucide-react';

export type InsightTone = 'warning' | 'success' | 'primary' | 'destructive' | 'info';

interface InsightStripProps {
  tone?: InsightTone;
  eyebrow: string;
  /** Texto principal — aceita string ou JSX para usar <strong>. */
  body: React.ReactNode;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

const RIBBON: Record<InsightTone, string> = {
  warning: 'bg-warning',
  success: 'bg-success',
  primary: 'bg-primary',
  destructive: 'bg-destructive',
  info: 'bg-info',
};

export function InsightStrip({
  tone = 'primary',
  eyebrow,
  body,
  ctaLabel,
  onCtaClick,
  className,
}: InsightStripProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-card pl-4 pr-5 py-4',
        'flex flex-col gap-2',
        className
      )}
    >
      <span className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r', RIBBON[tone])} aria-hidden />
      <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" strokeWidth={1.5} />
        {eyebrow}
      </div>
      <div className="text-sm leading-snug text-foreground/85">{body}</div>
      {ctaLabel && (
        <button
          type="button"
          onClick={onCtaClick}
          className="mt-1 inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
        >
          {ctaLabel}
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
