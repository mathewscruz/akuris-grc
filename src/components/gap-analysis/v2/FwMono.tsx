/**
 * FwMono — selo monocromático do framework com duas linhas mono (ex: "ISO/IEC" + "27001").
 * Usado em listas, headers e command palette. Não substitui FrameworkBadge oficial,
 * é um formato compacto para densidades altas.
 */
import { cn } from '@/lib/utils';

interface FwMonoProps {
  /** Linha superior, ex: "ISO/IEC", "NIST", "AICPA". */
  l1: string;
  /** Linha inferior, ex: "27001", "CSF", "SOC2". */
  l2: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  sm: { box: 'h-8 w-8', l1: 'text-[7px]', l2: 'text-[10px]' },
  md: { box: 'h-10 w-10', l1: 'text-[8px]', l2: 'text-[11px]' },
  lg: { box: 'h-12 w-12', l1: 'text-[9px]', l2: 'text-[13px]' },
};

export function FwMono({ l1, l2, size = 'md', className }: FwMonoProps) {
  const s = SIZE[size];
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-border bg-muted/40',
        'shrink-0 font-mono leading-none tracking-tight',
        s.box,
        className
      )}
      aria-label={`${l1} ${l2}`}
    >
      <span className={cn('font-medium text-muted-foreground', s.l1)}>{l1}</span>
      <span className={cn('font-semibold text-foreground', s.l2)}>{l2}</span>
    </div>
  );
}
