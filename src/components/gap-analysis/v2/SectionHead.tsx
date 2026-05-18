/**
 * SectionHead — cabeçalho editorial de seção: title + count + rule horizontal + slot direita.
 * Substitui CardHeader em listas longas para evitar empilhamento de cards.
 */
import { cn } from '@/lib/utils';

interface SectionHeadProps {
  title: string;
  count?: number | string;
  right?: React.ReactNode;
  className?: string;
}

export function SectionHead({ title, count, right, className }: SectionHeadProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-3', className)}>
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
        {title}
      </span>
      {count !== undefined && (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {typeof count === 'number' ? String(count).padStart(2, '0') : count}
        </span>
      )}
      <div className="h-px flex-1 bg-border/60" />
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
