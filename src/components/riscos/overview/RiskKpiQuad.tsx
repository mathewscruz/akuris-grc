/**
 * RiskKpiQuad — 4 KPIs editoriais clicáveis da Visão geral.
 * Padrão visual idêntico ao design de referência: eyebrow + dot, número herói, sublegenda, CTA inline.
 */
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'destructive' | 'warning' | 'amber' | 'success';

// 4 tons distintos: destructive (críticos), warning (altos), amber 60% (médios), success (baixos)
const TONE_DOT: Record<Tone, string> = {
  destructive: 'bg-destructive',
  warning: 'bg-warning',
  amber: 'bg-warning/60',
  success: 'bg-success',
};

export interface KpiItem {
  label: string;
  value: number;
  sub: string;
  cta: string;
  tone: Tone;
  onClick?: () => void;
}

interface Props {
  items: KpiItem[];
}

export function RiskKpiQuad({ items }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((k) => (
        <button
          key={k.label}
          type="button"
          onClick={k.onClick}
          className="group bg-card border border-border rounded-xl px-5 py-4 flex flex-col gap-2.5 text-left hover:border-foreground/20 transition-colors min-h-[156px]"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
              {k.label}
            </span>
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', TONE_DOT[k.tone])} />
          </div>
          <div className="text-[42px] font-semibold tracking-[-0.02em] tabular-nums leading-none text-foreground">
            {k.value}
          </div>
          <div className="text-xs text-muted-foreground">{k.sub}</div>
          <div className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-auto">
            {k.cta}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
          </div>
        </button>
      ))}
    </div>
  );
}
