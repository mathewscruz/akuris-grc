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
import { ScoreType } from '@/lib/framework-configs';
import { TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ScoreEvolutionChartProps {
  frameworkId: string;
  scoreType?: ScoreType;
}

export const ScoreEvolutionChart = ({ frameworkId, scoreType = 'scale_0_5' }: ScoreEvolutionChartProps) => {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<ScoreHistoryPeriod>('monthly');
  const { history, loading } = useScoreHistory(frameworkId, period);

  const periods: { value: ScoreHistoryPeriod; label: string }[] = [
    { value: 'daily', label: 'Dia' },
    { value: 'weekly', label: 'Semana' },
    { value: 'monthly', label: 'Mês' },
    { value: 'yearly', label: 'Ano' },
  ];

  const isPercentage = scoreType === 'percentage';
  const domain: [number, number] = isPercentage ? [0, 100] : [0, 5];
  const ticks = isPercentage ? [0, 25, 50, 75, 100] : [0, 1, 2, 3, 4, 5];
  const goalValue = isPercentage ? 80 : 4;

  const formatValue = (value: number) =>
    isPercentage ? `${value.toFixed(0)}%` : value.toFixed(2);

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
          { ...single, date: 'Início' },
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
                  {delta.dir === 'up' && <TrendingUp className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'down' && <TrendingDown className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'flat' && <Minus className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.value > 0 ? '+' : ''}{delta.value.toFixed(1)}{isPercentage ? '%' : ''}
                  <span className="text-muted-foreground font-normal">vs. anterior</span>
                </span>
              )}
              {!delta && history.length === 1 && (
                <span className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  primeiro registro
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
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
              <LineChartIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="text-center space-y-1 max-w-[280px]">
              <p className="text-sm font-medium text-foreground">{t('residuos.score.semHistorico')}</p>
              <p className="text-xs text-muted-foreground">
                Avalie alguns requisitos para começar a registrar a evolução do seu score nesse período.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={displayData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreEvolutionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.6}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  domain={domain}
                  ticks={ticks}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(v) => (isPercentage ? `${v}%` : v.toString())}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <ReferenceLine
                  y={goalValue}
                  stroke="hsl(var(--success))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{
                    value: 'Meta',
                    position: 'right',
                    fill: 'hsl(var(--success))',
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
                  }}
                  labelStyle={{
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                    marginBottom: 4,
                  }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))', fontSize: 13 }}
                  formatter={(value: number) => [formatValue(value), 'Score']}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#scoreEvolutionFill)"
                  dot={
                    history.length === 1
                      ? { fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2, r: 5 }
                      : { fill: 'hsl(var(--primary))', r: 3 }
                  }
                  activeDot={{
                    r: 6,
                    fill: 'hsl(var(--primary))',
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {history.length === 1 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-muted/80 backdrop-blur-sm border border-border text-[11px] text-muted-foreground pointer-events-none">
                Registre mais avaliações para visualizar a tendência
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
