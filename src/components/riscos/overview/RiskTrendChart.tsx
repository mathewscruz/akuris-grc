/**
 * RiskTrendChart — quantos riscos estão acima do apetite, mês a mês.
 *
 * O título era "Evolução do score consolidado" e o número, a soma dos P×I da
 * carteira, aparecia como "131 / apetite 16" — um agregado comparado com um
 * limiar por risco. A linha de referência do apetite era estruturalmente
 * inatingível, e a curva subia sempre que se cadastrava um risco novo.
 *
 * Agora a série é uma contagem: zero é a meta, e a linha desce quando um risco
 * é tratado. O denominador (riscos avaliados) fica ao lado para dar escala.
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
import type { TrendPoint } from '@/hooks/useRiskScoreTrend';
import { useLanguage } from '@/contexts/LanguageContext';
import { chartSeries, CHART_GRID, CHART_AXIS, CHART_AREA_OPACITY, CHART_FONT } from '@/lib/chart-tokens';

interface Props {
  /** 12 pontos mensais (mais antigo → atual) vindos de useRiskScoreTrend. */
  points: TrendPoint[];
}

type Range = '3M' | '6M' | '12M';

const RANGE_MONTHS: Record<Range, number> = { '3M': 3, '6M': 6, '12M': 12 };

export function RiskTrendChart({ points }: Props) {
  const { t } = useLanguage();
  const [range, setRange] = useState<Range>('6M');

  const data = useMemo(() => {
    const months = RANGE_MONTHS[range];
    return (points || []).slice(-months);
  }, [points, range]);

  const atual = data.length ? data[data.length - 1] : null;
  const anterior = data.length > 1 ? data[data.length - 2] : null;
  const delta = atual && anterior ? atual.acimaApetite - anterior.acimaApetite : null;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">
            {t('riscosVisoes.overview.riskTrendChart.titulo')}
          </div>
          <div className="text-xl font-semibold tabular-nums tracking-tight mt-1">
            {atual?.acimaApetite ?? 0}
            <span className="text-sm text-muted-foreground font-normal">
              {' '}
              {t('riscosVisoes.overview.riskTrendChart.deTotal', { total: atual?.total ?? 0 })}
            </span>
            {delta !== null && delta !== 0 && (
              <span
                className={cn(
                  'ml-2 text-xs font-medium tabular-nums',
                  delta < 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
        </div>
        <div className="inline-flex p-0.5 bg-muted/60 rounded-md text-micro">
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
                <stop offset="0%" stopColor={chartSeries(0)} stopOpacity={1} />
                <stop offset="100%" stopColor={chartSeries(0)} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: CHART_FONT.axis, fill: CHART_AXIS }}
            />
            <YAxis hide domain={[0, 'auto']} allowDecimals={false} />
            {/* A meta é zero — a única referência que faz sentido numa contagem
                de excedentes. */}
            <ReferenceLine
              y={0}
              stroke={CHART_AXIS}
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{
                value: t('riscosVisoes.overview.riskTrendChart.meta'),
                fontSize: CHART_FONT.axis,
                fill: CHART_AXIS,
                position: 'right',
              }}
            />
            <RTooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: CHART_FONT.label,
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(v: number) => [v, t('riscosVisoes.overview.riskTrendChart.scoreTooltip')]}
            />
            <Area
              type="monotone"
              dataKey="acimaApetite"
              fill="url(#riskTrendGrad)"
              fillOpacity={CHART_AREA_OPACITY}
              stroke="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="acimaApetite"
              stroke={chartSeries(0)}
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--card))', stroke: chartSeries(0), strokeWidth: 1.6 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
