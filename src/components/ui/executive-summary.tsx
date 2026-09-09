import type { CSSProperties, HTMLAttributes } from 'react';
import { AnimatedMetricValue } from './stat-strip';
import { useMotionAllowed } from '@/lib/motion-preferences';
import { cn } from '@/lib/utils';
import { operationalScoreColor } from '@/lib/operational-score-color';
import './executive-summary.css';

/** Presentation only: callers retain the source, scale and meaning of every metric. */
export function ExecutivePanel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('akuris-executive min-w-0 overflow-hidden rounded-lg border border-border bg-card', className)} {...props} />;
}

export function ScoreRing({ value, label, suffix = '/100', className, colorScale = 'brand' }: {
  value: number | null;
  label: string;
  suffix?: string;
  className?: string;
  /** Opt-in: operational health increases with the score; other metrics keep their palette. */
  colorScale?: 'brand' | 'operational';
}) {
  const motion = useMotionAllowed();
  const score = value !== null && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  return (
    <div className={cn('executive-ring relative h-32 w-32 shrink-0', colorScale === 'operational' ? 'executive-ring--operational' : 'text-primary', className)}
      style={colorScale === 'operational' ? { '--score-color': operationalScoreColor(score) } as CSSProperties : undefined}
      role="img" aria-label={`${label}: ${score === null ? '—' : `${score}${suffix}`}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="51" fill="none" className="stroke-muted" strokeWidth="5" />
        {score !== null && score > 0 && <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor"
          strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="100"
          strokeDashoffset={100 - score} data-score-arc
          className={motion ? 'executive-ring-enter' : undefined}
          style={{ '--score-offset': 100 - score } as CSSProperties} />}
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span data-score-value className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {score === null ? '—' : <AnimatedMetricValue value={score} />}
        </span>
        {score !== null && <span className="mt-1.5 text-xs tabular-nums text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function ExecutiveBar({ value, label, className }: { value: number | null; label: string; className?: string }) {
  const amount = value !== null && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  return <div role={amount === null ? "img" : "meter"} aria-label={amount === null ? `${label}: —` : label} aria-valuemin={amount === null ? undefined : 0} aria-valuemax={amount === null ? undefined : 100}
    aria-valuenow={amount ?? undefined}
    className={cn('h-1.5 overflow-hidden rounded-full bg-muted text-primary', className)}>
    {amount !== null && <div className="h-full rounded-full bg-current transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${amount}%` }} />}
  </div>;
}
