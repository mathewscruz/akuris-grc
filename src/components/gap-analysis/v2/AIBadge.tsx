/**
 * AIBadge — chip "IA" usado em rótulos de sugestão e ordenação assistida.
 * Tom primário (roxo Akuris).
 */
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIBadgeProps {
  children?: React.ReactNode;
  className?: string;
}

export function AIBadge({ children = 'IA', className }: AIBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-primary/25 bg-primary/10',
        'px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider text-primary',
        className
      )}
    >
      <Sparkles className="h-2.5 w-2.5" strokeWidth={1.5} />
      {children}
    </span>
  );
}
