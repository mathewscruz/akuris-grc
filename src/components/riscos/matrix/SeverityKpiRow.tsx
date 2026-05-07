/**
 * SeverityKpiRow — 4 cards Críticos/Altos/Médios/Baixos com tendência vs mês anterior.
 */
import { cn } from '@/lib/utils';

type SevKey = 'critico' | 'alto' | 'medio' | 'baixo';

const SEV_BORDER: Record<SevKey, string> = {
  critico: 'border-l-destructive',
  alto: 'border-l-warning',
  medio: 'border-l-warning/60',
  baixo: 'border-l-success',
};

const SEV_LABEL: Record<SevKey, string> = {
  critico: 'Críticos',
  alto: 'Altos',
  medio: 'Médios',
  baixo: 'Baixos',
};

interface ItemTrend {
  delta: number | null; // riscos a mais/menos vs 30d (null = sem dado)
}

interface Props {
  counts: Record<SevKey, number>;
  trends?: Partial<Record<SevKey, ItemTrend>>;
}

function trendLabel(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return 'sem dados';
  if (delta === 0) return '= mês';
  return delta > 0 ? `+${delta} mês` : `${delta} mês`;
}

export function SeverityKpiRow({ counts, trends }: Props) {
  const items: SevKey[] = ['critico', 'alto', 'medio', 'baixo'];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {items.map((sev) => (
        <div
          key={sev}
          className={cn(
            'flex items-center justify-between bg-card border border-border border-l-2 rounded-lg px-4 py-3.5',
            SEV_BORDER[sev],
          )}
        >
          <div>
            <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
              {SEV_LABEL[sev]}
            </div>
            <div className="text-3xl font-semibold tabular-nums leading-none mt-1.5">
              {counts[sev] ?? 0}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>vs mês ant.</div>
            <div className="text-foreground/80 font-medium mt-0.5">{trendLabel(trends?.[sev]?.delta)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
