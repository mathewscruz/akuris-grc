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
import { TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon } from 'lucide-react';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface PointData {
  date: string;
  /** Índice de exposição 0-100 (menor = melhor). null quando o período não tem riscos cadastrados ainda. */
  score: number | null;
  total: number;
  criticos: number;
  altos: number;
}

const SEVERITY_WEIGHT = { critico: 4, alto: 3, medio: 2, baixo: 1 } as const;
/** Meta máxima recomendada de exposição (quanto menor, melhor). */
const GOAL_VALUE = 20;

const bucketOf = (nivel?: string | null): keyof typeof SEVERITY_WEIGHT | null => {
  if (!nivel) return null;
  const v = nivel.toLowerCase();
  if (v.includes('crit')) return 'critico';
  if (v.includes('alt')) return 'alto';
  if (v.includes('med') || v.includes('méd') || v.includes('moder')) return 'medio';
  if (v.includes('baix')) return 'baixo';
  return null;
};

/**
 * Índice de exposição 0–100 (MENOR = MELHOR).
 * 0% = sem riscos / sem exposição. 100% = totalmente vulnerável.
 * Quando o período não tem nenhum risco classificado, retorna null (base zero — não plota).
 */
const computeExposure = (counts: Record<keyof typeof SEVERITY_WEIGHT, number>): number | null => {
  const total = counts.critico + counts.alto + counts.medio + counts.baixo;
  if (total === 0) return null;
  const peso =
    counts.critico * SEVERITY_WEIGHT.critico +
    counts.alto * SEVERITY_WEIGHT.alto +
    counts.medio * SEVERITY_WEIGHT.medio +
    counts.baixo * SEVERITY_WEIGHT.baixo;
  // peso máximo seria total*4 (todos críticos) → normalizar para 0–100.
  const exposure = (peso / (total * 4)) * 100;
  return Math.round(Math.min(100, Math.max(0, exposure)));
};

export function RiskScoreTimeline() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<TimeRange>('monthly');

  const { data: riscos, isLoading } = useQuery({
    queryKey: ['riscos-timeline', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('riscos')
        .select('id, nivel_risco_residual, nivel_risco_inicial, created_at')
        .eq('empresa_id', profile.empresa_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 5 * 60 * 1000,
  });

  const periods: { value: TimeRange; label: string }[] = [
    { value: 'daily', label: 'Dia' },
    { value: 'weekly', label: 'Semana' },
    { value: 'monthly', label: 'Mês' },
    { value: 'yearly', label: 'Ano' },
  ];

  const { displayData, latestScore, delta, totalAtual } = useMemo(() => {
    const empty = {
      displayData: [] as PointData[],
      latestScore: null as number | null,
      delta: null as null | { value: number; dir: 'up' | 'down' | 'flat' },
      totalAtual: 0,
    };
    if (!riscos || riscos.length === 0) return empty;

    const now = new Date();
    const buckets: { end: Date; label: string }[] = [];

    if (period === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(23, 59, 59, 999);
        buckets.push({ end: d, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) });
      }
    } else if (period === 'weekly') {
      for (let i = 3; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        d.setHours(23, 59, 59, 999);
        buckets.push({ end: d, label: `Sem ${4 - i}` });
      }
    } else if (period === 'monthly') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        buckets.push({ end: d, label: d.toLocaleDateString('pt-BR', { month: 'short' }) });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59);
        buckets.push({ end: d, label: d.getFullYear().toString() });
      }
    }

    const points: PointData[] = buckets.map(({ end, label }) => {
      const slice = riscos.filter((r) => new Date(r.created_at) <= end);
      const counts = { critico: 0, alto: 0, medio: 0, baixo: 0 };
      for (const r of slice) {
        const b = bucketOf(r.nivel_risco_residual || r.nivel_risco_inicial);
        if (b) counts[b] += 1;
      }
      return {
        date: label,
        score: computeExposure(counts),
        total: slice.length,
        criticos: counts.critico,
        altos: counts.alto,
      };
    });

    // Filtra pontos sem dados para computar last/delta — mas mantém os null no chart (gap visual).
    const valid = points.filter((p) => p.score !== null) as (PointData & { score: number })[];
    if (valid.length === 0) return empty;

    const last = valid[valid.length - 1];
    const prev = valid[valid.length - 2];
    const diff = prev ? last.score - prev.score : 0;
    return {
      displayData: points,
      latestScore: last.score,
      // Em exposição, queda (diff < 0) é BOM. Invertemos a direção visual.
      delta: !prev
        ? null
        : Math.abs(diff) < 0.5
        ? { value: 0, dir: 'flat' as const }
        : { value: diff, dir: diff < 0 ? ('down' as const) : ('up' as const) },
      totalAtual: last.total,
    };
  }, [riscos, period]);

  if (isLoading) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden">
        <CornerAccent />
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.riskEvolution')}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[260px] flex flex-col items-center justify-center gap-2">
          <AkurisPulse size={56} />
          <p className="text-xs text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
      <CornerAccent />
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base">{t('dashboard.riskEvolution')}</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Índice de exposição · quanto menor, melhor
          </p>
          {latestScore !== null && (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-bold text-foreground tabular-nums">{latestScore}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
              {delta && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    delta.dir === 'down'
                      ? 'text-success'
                      : delta.dir === 'up'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {delta.dir === 'down' && <TrendingDown className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'up' && <TrendingUp className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'flat' && <Minus className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.value > 0 ? '+' : ''}
                  {delta.value.toFixed(0)}
                  <span className="text-muted-foreground font-normal">vs. anterior</span>
                </span>
              )}
              {totalAtual > 0 && (
                <span className="text-[11px] text-muted-foreground">· {totalAtual} riscos</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-0.5 rounded-md border border-border p-0.5 bg-muted/30 shrink-0">
          {periods.map((p) => (
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
      <CardContent className="pt-3 flex-1 flex flex-col min-h-0">
        {displayData.length === 0 || latestScore === null ? (
          <div className="flex flex-col items-center justify-center h-[260px] gap-3 rounded-lg border border-dashed border-border bg-muted/20">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
              <LineChartIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="text-center space-y-1 max-w-[280px]">
              <p className="text-sm font-medium text-foreground">Sem histórico ainda</p>
              <p className="text-xs text-muted-foreground">
                Cadastre alguns riscos para começar a registrar a evolução da exposição neste período.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskExposureFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
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
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(v) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <ReferenceLine
                  y={GOAL_VALUE}
                  stroke="hsl(var(--success))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `Meta ≤ ${GOAL_VALUE}`,
                    position: 'right',
                    fill: 'hsl(var(--success))',
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--destructive))', strokeWidth: 1, strokeDasharray: '3 3' }}
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
                  formatter={(value: number | null, _name, item: any) => {
                    if (value === null || value === undefined) return ['Sem dados', 'Exposição'];
                    const p = item?.payload as PointData | undefined;
                    const extra = p ? ` · ${p.criticos} crít · ${p.altos} altos` : '';
                    return [`${value}${extra}`, 'Índice de exposição'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2.5}
                  fill="url(#riskExposureFill)"
                  connectNulls={false}
                  dot={{ fill: 'hsl(var(--destructive))', r: 3 }}
                  activeDot={{
                    r: 6,
                    fill: 'hsl(var(--destructive))',
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
