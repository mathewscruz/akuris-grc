import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
} from 'recharts';
import { useScoreHistory, ScoreHistoryPeriod } from '@/hooks/useScoreHistory';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { TrendAreaChart } from '@/components/ui/trend-area-chart';
import { PeriodoSelect, type OpcaoPeriodo } from '@/components/ui/periodo-select';
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

  const opcoesPeriodo: OpcaoPeriodo<string>[] = periods.map((p) => ({
    value: String(p.value),
    label: p.label,
  }));

  // Sem parâmetro de tipo no JSX — ver a nota em `PeriodoSelect`.
  const seletorPeriodo = (
    <PeriodoSelect
      valor={String(period)}
      onChange={(v: string) => setPeriod(v as typeof period)}
      opcoes={opcoesPeriodo}
    />
  );

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('residuos.score.evolucao')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[260px] gap-3 rounded-lg border border-dashed border-border bg-muted/20">
            <IconChartLine className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-center space-y-1 max-w-[280px]">
              <p className="text-sm font-medium text-foreground">{t('residuos.score.semHistorico')}</p>
              <p className="text-xs text-muted-foreground">
                {t('sweepRiscos.gap.scoreChart.avalieRequisitos')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TrendAreaChart
      eyebrow={t('residuos.score.evolucao')}
      valor={latestScore !== null ? formatValue(latestScore) : '—'}
      delta={delta ? Math.round(delta.value * 10) / 10 : null}
      // Aqui, ao contrário do risco, SUBIR é bom: mais conformidade.
      menorEMelhor={false}
      pontos={displayData.map((d) => ({ label: d.date, valor: d.score }))}
      tooltipLabel={t('residuos.score.evolucao')}
      altura={260}
      seletor={seletorPeriodo}
    />
  );
}
