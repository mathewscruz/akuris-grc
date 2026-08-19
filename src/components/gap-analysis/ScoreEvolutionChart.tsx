import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useScoreHistory, ScoreHistoryPeriod } from '@/hooks/useScoreHistory';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { chartSeries, CHART_GRID, CHART_AXIS, CHART_AREA_OPACITY, CHART_TOOLTIP_STYLE, CHART_FONT } from '@/lib/chart-tokens';
import { IconTrendUp, IconTrendDown, IconMinus, IconChartLine } from '@/components/icons';

interface ScoreEvolutionChartProps {
  frameworkId: string;
}

export const ScoreEvolutionChart = ({ frameworkId }: ScoreEvolutionChartProps) => {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<ScoreHistoryPeriod>('monthly');
  const { history, loading } = useScoreHistory(frameworkId, period);

  const periods: { value: ScoreHistoryPeriod; label: string }[] = [
    { value: 'daily', label: t('sweepRiscos.gap.scoreChart.dia') },
    { value: 'weekly', label: t('sweepRiscos.gap.scoreChart.semana') },
    { value: 'monthly', label: t('sweepRiscos.gap.scoreChart.mes') },
    { value: 'yearly', label: t('sweepRiscos.gap.scoreChart.ano') },
  ];

  // O histórico é gravado em percentagem pelo gatilho do banco; era o eixo
  // deste gráfico que às vezes se desenhava de 0 a 5, para o NIST.
  const domain: [number, number] = [0, 100];
  const ticks = [0, 25, 50, 75, 100];
  const goalValue = 80;

  const formatValue = (value: number) => `${value.toFixed(0)}%`;

  // Delta + extensão dos dados para suportar 1-ponto sem ficar branco
  const { displayData, delta, latestScore } = useMemo(() => {
    if (history.length === 0) {
      return { displayData: [], delta: null as null | { value: number; dir: 'up' | 'down' | 'flat' }, latestScore: null as number | null };
    }
    const latest = history[history.length - 1].score;
    if (history.length === 1) {
      const single = history[0];
      return {
        displayData: [
          { ...single, date: t('sweepRiscos.gap.scoreChart.inicio') },
          { ...single },
        ],
        delta: null,
        latestScore: latest,
      };
    }
    const prev = history[history.length - 2].score;
    const diff = latest - prev;
    return {
      displayData: history,
      delta: Math.abs(diff) < 0.05
        ? { value: 0, dir: 'flat' as const }
        : { value: diff, dir: diff > 0 ? ('up' as const) : ('down' as const) },
      latestScore: latest,
    };
  }, [history]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('residuos.score.evolucao')}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[260px] flex flex-col items-center justify-center gap-2">
          <AkurisPulse size={56} />
          <p className="text-xs text-muted-foreground">{t('residuos.score.carregandoHistorico')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base">{t('residuos.score.evolucao')}</CardTitle>
          {latestScore !== null && (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-bold text-foreground">{formatValue(latestScore)}</span>
              {delta && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    delta.dir === 'up' ? 'text-success' :
                    delta.dir === 'down' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}
                >
                  {delta.dir === 'up' && <IconTrendUp className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'down' && <IconTrendDown className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'flat' && <IconMinus className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.value > 0 ? '+' : ''}{delta.value.toFixed(1)}%
                  <span className="text-muted-foreground font-normal">{t('cardsKpi.sweep.gap.vsAnterior')}</span>
                </span>
              )}
              {!delta && history.length === 1 && (
                <span className="inline-flex items-center text-micro px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {t('sweepRiscos.gap.scoreChart.primeiroRegistro')}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-0.5 rounded-md border border-border p-0.5 bg-muted/30 shrink-0">
          {periods.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                period === p.value
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[260px] gap-3 rounded-lg border border-dashed border-border bg-muted/20">
            <IconChartLine className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-center space-y-1 max-w-[280px]">
              <p className="text-sm font-medium text-foreground">{t('residuos.score.semHistorico')}</p>
              <p className="text-xs text-muted-foreground">
                {t('sweepRiscos.gap.scoreChart.avalieRequisitos')}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={displayData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreEvolutionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartSeries(0)} stopOpacity={1} />
                    <stop offset="100%" stopColor={chartSeries(0)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_GRID}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_AXIS, fontSize: CHART_FONT.axis }}
                  axisLine={{ stroke: CHART_GRID }}
                  tickLine={false}
                />
                <YAxis
                  domain={domain}
                  ticks={ticks}
                  tick={{ fill: CHART_AXIS, fontSize: CHART_FONT.axis }}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <ReferenceLine
                  y={goalValue}
                  stroke={CHART_AXIS}
                  strokeDasharray="4 4"
                  label={{
                    value: t('sweepRiscos.gap.scoreChart.meta'),
                    position: 'right',
                    fill: CHART_AXIS,
                    fontSize: CHART_FONT.axis,
                  }}
                />
                <Tooltip
                  cursor={{ stroke: chartSeries(0), strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: CHART_FONT.axis,
                    marginBottom: 4,
                  }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))', fontSize: CHART_FONT.label }}
                  formatter={(value: number) => [formatValue(value), t('sweepRiscos.gap.scoreChart.score')]}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={chartSeries(0)}
                  strokeWidth={2.5}
                  fill="url(#scoreEvolutionFill)"
                  fillOpacity={CHART_AREA_OPACITY}
                  dot={
                    history.length === 1
                      ? { fill: chartSeries(0), stroke: 'hsl(var(--background))', strokeWidth: 2, r: 5 }
                      : { fill: chartSeries(0), r: 3 }
                  }
                  activeDot={{
                    r: 6,
                    fill: chartSeries(0),
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {history.length === 1 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-muted/80 backdrop-blur-sm border border-border text-micro text-muted-foreground pointer-events-none">
                {t('sweepRiscos.gap.scoreChart.registreMais')}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
