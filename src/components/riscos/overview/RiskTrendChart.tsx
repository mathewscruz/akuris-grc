/**
 * RiskTrendChart — evolução do score consolidado nos últimos N meses.
 * Recharts ComposedChart: gradiente de área + linha + ReferenceLine (apetite).
 */
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip as RTooltip,
  CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

interface Risco {
  created_at: string;
  nivel_risco_residual?: string | null;
  nivel_risco_inicial: string;
  probabilidade_inicial?: string;
  impacto_inicial?: string;
  probabilidade_residual?: string;
  impacto_residual?: string;
}

interface Props {
  riscos: Risco[];
  apetite?: number | null;
}

type Range = '3M' | '6M' | '12M';

const RANGE_MONTHS: Record<Range, number> = { '3M': 3, '6M': 6, '12M': 12 };

const MONTH_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function piScore(prob?: string, imp?: string): number {
  const p = Number(prob) || 0;
  const i = Number(imp) || 0;
  return p * i;
}

export function RiskTrendChart({ riscos, apetite }: Props) {
  const [range, setRange] = useState<Range>('6M');

  const data = useMemo(() => {
    const months = RANGE_MONTHS[range];
    const now = new Date();
    const buckets: { key: string; label: string; total: number; count: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: MONTH_PT[d.getMonth()],
        total: 0,
        count: 0,
      });
    }
    const idxByKey = new Map(buckets.map((b, i) => [b.key, i]));
    riscos.forEach((r) => {
      const created = new Date(r.created_at);
      // soma cumulativamente para todos os meses ≥ created
      for (const b of buckets) {
        const [y, m] = b.key.split('-').map(Number);
        const bDate = new Date(y, m, 1);
        if (bDate >= new Date(created.getFullYear(), created.getMonth(), 1)) {
          const score = piScore(
            r.probabilidade_residual || r.probabilidade_inicial,
            r.impacto_residual || r.impacto_inicial,
          );
          b.total += score;
          b.count += 1;
        }
      }
    });
    return buckets.map((b) => ({
      label: b.label,
      score: b.total, // score consolidado = soma dos scores ativos no mês
    }));
  }, [riscos, range]);

  const currentScore = data.length ? data[data.length - 1].score : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
            Evolução do score consolidado
          </div>
          <div className="text-xl font-semibold tabular-nums tracking-tight mt-1">
            {currentScore}
            {apetite ? (
              <span className="text-sm text-muted-foreground font-normal"> / apetite {apetite}</span>
            ) : null}
          </div>
        </div>
        <div className="inline-flex p-0.5 bg-muted/60 rounded-md text-[11px]">
          {(['3M', '6M', '12M'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'px-2.5 py-1 rounded font-medium transition-colors',
                range === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="riskTrendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis hide />
            {apetite ? (
              <ReferenceLine
                y={apetite}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: 'apetite',
                  fontSize: 10,
                  fill: 'hsl(var(--primary))',
                  position: 'right',
                }}
              />
            ) : null}
            <RTooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(v: number) => [v, 'Score']}
            />
            <Area
              type="monotone"
              dataKey="score"
              fill="url(#riskTrendGrad)"
              stroke="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--card))', stroke: 'hsl(var(--destructive))', strokeWidth: 1.6 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
