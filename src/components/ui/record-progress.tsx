import { cn } from '@/lib/utils';

/** Display only an explicit measurement; never infer progress from workflow status. */
export function RecordProgress({ value, label, className }: { value?: number | null; label: string; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  const percent = Math.max(0, Math.min(100, value));
  return (
    <span className={cn('flex min-w-24 items-center gap-2', className)}>
      <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-state-done transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </span>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
    </span>
  );
}