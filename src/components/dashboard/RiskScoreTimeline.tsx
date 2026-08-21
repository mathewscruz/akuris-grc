import { useEffect, useMemo, useState } from 'react';
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
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAppLocale } from '@/lib/i18n-locale';
import { chartSeries, CHART_GRID, CHART_AXIS, CHART_AREA_OPACITY, CHART_TOOLTIP_STYLE, CHART_FONT } from '@/lib/chart-tokens';
import { IconTrendUp, IconTrendDown, IconMinus, IconChartLine } from '@/components/icons';
import { useMatrizConfigEmpresa } from '@/hooks/useMatrizConfigEmpresa';
import { apetiteScoreDaConfig } from '@/components/riscos/matriz-config';
import {
  avaliacoesPorRisco,
  avaliacaoVigente,
  jaExistiaEm,
  type AvaliacaoNoTempo,
} from '@/lib/risco-vigente';

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface PointData {
  date: string;
  /** Riscos acima do apetite (menor = melhor). null quando não havia riscos avaliados. */
  score: number | null;
  total: number;
  criticos: number;
  altos: number;
}

/**
 * A meta de riscos acima do apetite é zero — não há outro número defensável.
 *
 * O que estava aqui era um índice 0–100: a média das severidades ponderada
 * (crítico 4, alto 3, médio 2, baixo 1), normalizada pelo pior caso, com meta
 * fixa em 20. Sendo uma média, cadastrar riscos BAIXOS melhorava o número — o
 * painel premiava aumentar a carteira sem tratar nada. E `bucketOf`
 * classificava por `nivel.includes('alt')`, a quarta leitura de rótulo do
 * produto, cega a qualquer faixa renomeada.
 *
 * Passa a ser a mesma contagem da aba Visão geral: riscos cujo score excede o
 * apetite da matriz vigente.
 */
const GOAL_VALUE = 0;

export function RiskScoreTimeline() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<TimeRange>('monthly');
  const { data: matriz } = useMatrizConfigEmpresa();
  const apetite = apetiteScoreDaConfig(matriz);

  const { data: base, isLoading } = useQuery({
    queryKey: ['riscos-timeline', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return { riscos: [], historico: [] };
      const { data: riscos, error } = await supabase
        .from('riscos')
        .select('id, score_inicial, severidade_inicial, created_at')
        .eq('empresa_id', profile.empresa_id);
      if (error) throw error;

      /*
        O histórico é o que faz a curva poder DESCER.

        Sem ele, a série aplicava a severidade de hoje a todos os meses desde a
        criação do risco: tratar um risco de Crítico para Baixo não movia o
        gráfico nenhum — só cadastrar riscos novos movia. Ver `risco-vigente.ts`.
      */
      const ids = (riscos || []).map((r) => r.id);
      let historico: AvaliacaoNoTempo[] = [];
      if (ids.length > 0) {
        const { data: hist, error: histErr } = await supabase
          .from('riscos_historico_avaliacoes')
          .select('risco_id, created_at, score, severidade, tipo')
          .in('risco_id', ids)
          .order('created_at', { ascending: true });
        if (histErr) throw histErr;
        historico = (hist || []) as AvaliacaoNoTempo[];
      }
      return { riscos: riscos || [], historico };
    },
    enabled: !!profile?.empresa_id,
    staleTime: 5 * 60 * 1000,
  });

  const riscos = base?.riscos;
  const historico = base?.historico;

  /**
   * Só os períodos que a empresa tem histórico para preencher.
   *
   * Eram sempre quatro. Numa empresa com quatro meses de vida, "Ano" desenhava
   * cinco pontos anuais com quatro vazios, e "Dia" sete dias em que nada
   * aconteceu — dois gráficos em branco a um clique de distância do painel
   * principal, oferecidos como se tivessem conteúdo. Um selector que leva a
   * um ecrã vazio ensina a não clicar em selectores.
   */
  const idadeEmDias = useMemo(() => {
    if (!riscos || riscos.length === 0) return 0;
    const maisAntigo = Math.min(...riscos.map((r) => new Date(r.created_at).getTime()));
    return Math.floor((Date.now() - maisAntigo) / 86400000);
  }, [riscos]);

  const periods = useMemo(() => {
    const todos: { value: TimeRange; label: string; minDias: number }[] = [
      { value: 'daily', label: t('dashWidgets.timeline.day'), minDias: 7 },
      { value: 'weekly', label: t('dashWidgets.timeline.week'), minDias: 21 },
      { value: 'monthly', label: t('dashWidgets.timeline.month'), minDias: 0 },
      { value: 'yearly', label: t('dashWidgets.timeline.year'), minDias: 365 },
    ];
    // O mês fica sempre: é o padrão e tem de haver para onde voltar.
    return todos.filter((p) => p.value === 'monthly' || idadeEmDias >= p.minDias);
  }, [idadeEmDias, t]);

  // Se o período escolhido deixar de estar disponível, volta ao mês.
  useEffect(() => {
    if (!periods.some((p) => p.value === period)) setPeriod('monthly');
  }, [periods, period]);

  const intlLocale = getAppLocale() === 'en' ? 'en-US' : 'pt-BR';

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
        buckets.push({ end: d, label: d.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' }) });
      }
    } else if (period === 'weekly') {
      for (let i = 3; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        d.setHours(23, 59, 59, 999);
        buckets.push({ end: d, label: t('dashWidgets.timeline.weekShort', { n: 4 - i }) });
      }
    } else if (period === 'monthly') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        buckets.push({ end: d, label: d.toLocaleDateString(intlLocale, { month: 'short' }) });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59);
        buckets.push({ end: d, label: d.getFullYear().toString() });
      }
    }

    /*
      A severidade de cada risco é a que VIGORAVA no fim daquele período — a
      última reavaliação registada até lá, ou o nível inicial se ainda não
      tinha sido reavaliado. Antes usava-se `nivel_risco_residual` de hoje para
      todos os meses passados, e por isso a linha nunca podia cair.
    */
    const porRisco = avaliacoesPorRisco(historico ?? []);

    const points: PointData[] = buckets.map(({ end, label }) => {
      let acima = 0;
      let criticos = 0;
      let altos = 0;
      let existentes = 0;
      for (const r of riscos) {
        if (!jaExistiaEm(r.created_at, end)) continue;
        const vigente = avaliacaoVigente(porRisco.get(r.id), end);
        const score = vigente?.score ?? r.score_inicial;
        const sev = vigente?.severidade ?? r.severidade_inicial;
        if (score === null || score === undefined) continue; // ainda por avaliar
        existentes += 1;
        if (apetite !== null && score > apetite) acima += 1;
        if (sev === 'critico') criticos += 1;
        if (sev === 'alto') altos += 1;
      }
      return {
        date: label,
        score: existentes === 0 ? null : acima,
        total: existentes,
        criticos,
        altos,
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
  }, [riscos, historico, period, intlLocale, t, apetite]);

  /**
   * Escala em contagem: começa sempre no zero, porque zero é a meta e a
   * distância até lá é a leitura do gráfico. Marcas inteiras — meio risco
   * acima do apetite não existe.
   */
  const escalaY = useMemo(() => {
    const valores = displayData.map((p) => p.score).filter((v): v is number => v !== null);
    const maior = Math.max(1, ...valores);
    const passo = Math.max(1, Math.ceil(maior / 4));
    const alto = passo * 4;
    const marcas: number[] = [];
    for (let v = 0; v <= alto; v += passo) marcas.push(v);
    return { dominio: [0, alto] as [number, number], marcas };
  }, [displayData]);

  if (isLoading) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden">
        <CornerAccent />
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.riskEvolution')}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[260px] flex flex-col items-center justify-center gap-2">
          <AkurisPulse size={56} />
          <p className="text-xs text-muted-foreground">{t('dashWidgets.timeline.loading')}</p>
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
          <p className="text-micro text-muted-foreground">
            {t('dashWidgets.timeline.subtitle')}
          </p>
          {latestScore !== null && (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-bold text-foreground tabular-nums">{latestScore}</span>
              <span className="text-xs text-muted-foreground">
                {t('dashWidgets.timeline.aboveAppetite')}
              </span>
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
                  {delta.dir === 'down' && <IconTrendDown className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'up' && <IconTrendUp className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.dir === 'flat' && <IconMinus className="h-3 w-3" strokeWidth={1.5} />}
                  {delta.value > 0 ? '+' : ''}
                  {delta.value.toFixed(0)}
                  <span className="text-muted-foreground font-normal">{t('dashWidgets.timeline.vsPrevious')}</span>
                </span>
              )}
              {totalAtual > 0 && (
                <span className="text-micro text-muted-foreground">{t('dashWidgets.timeline.risksCount', { count: totalAtual })}</span>
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
            <IconChartLine className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-center space-y-1 max-w-[280px]">
              <p className="text-sm font-medium text-foreground">{t('dashWidgets.timeline.emptyTitle')}</p>
              <p className="text-xs text-muted-foreground">
                {t('dashWidgets.timeline.emptyDescription')}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskExposureFill" x1="0" y1="0" x2="0" y2="1">
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
                {/*
                  O eixo acompanha os dados, não o intervalo teórico.

                  Estava fixo em 0–100 com marcas de 25 em 25. Com a exposição
                  entre 50 e 75 — que é o caso comum — metade da área do
                  gráfico ficava vazia e a variação real espremia-se em dois
                  centímetros. A meta continua sempre visível, senão deixava de
                  se poder ver a distância até ela.
                */}
                <YAxis
                  domain={escalaY.dominio}
                  ticks={escalaY.marcas}
                  tick={{ fill: CHART_AXIS, fontSize: CHART_FONT.axis }}
                  tickFormatter={(v) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <ReferenceLine
                  y={GOAL_VALUE}
                  stroke={CHART_AXIS}
                  strokeDasharray="4 4"
                  label={{
                    value: t('dashWidgets.timeline.goalZero'),
                    /*
                      `position: 'right'` punha o rótulo FORA da área de
                      desenho: "Meta ≤ 20" saía cortado no "M" contra a borda
                      direita do cartão. Dentro, alinhado à direita, cabe.
                    */
                    position: 'insideTopRight',
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
                  formatter={(value: number | null, _name, item: any) => {
                    if (value === null || value === undefined)
                      return [t('dashWidgets.timeline.noData'), t('dashWidgets.timeline.exposure')];
                    const p = item?.payload as PointData | undefined;
                    const extra = p
                      ? t('dashWidgets.timeline.tooltipExtra', { crit: p.criticos, high: p.altos })
                      : '';
                    return [`${value}${extra}`, t('dashWidgets.timeline.aboveAppetiteLabel')];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={chartSeries(0)}
                  strokeWidth={2.5}
                  fill="url(#riskExposureFill)"
                  fillOpacity={CHART_AREA_OPACITY}
                  connectNulls={false}
                  dot={{ fill: chartSeries(0), r: 3 }}
                  activeDot={{
                    r: 6,
                    fill: chartSeries(0),
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
