/**
 * RiskTrendChart — evolução do score médio da carteira, mês a mês.
 *
 * A curva mostra o SCORE, que é o que se move; o apetite entra como número de
 * contexto e no tooltip. Foram precisas duas voltas para chegar aqui:
 *
 * O gráfico original somava os P×I de toda a carteira e comparava o resultado
 * com o limite de apetite, que é um limiar POR RISCO: lia-se "131 / apetite
 * 16", a linha de referência ficava colada ao eixo e a curva subia sempre que
 * se cadastrava um risco novo.
 *
 * Ao trocar a série para a CONTAGEM de riscos acima do apetite, o número
 * passou a estar certo — e o gráfico deixou de dizer o que quer que fosse:
 * com um risco acima do limite, a curva é uma linha horizontal em 1.
 *
 * O score médio move-se a cada reavaliação e desce quando a carteira melhora,
 * porque cada ponto usa a avaliação VIGENTE naquele mês. Tem a fraqueza de
 * qualquer média — cadastrar riscos baixos baixa-a —, e é por isso que o
 * número que dispara o alerta continua a ser "acima do apetite", que vive no
 * cartão de KPI, no banner e no tooltip deste gráfico.
 */
import { useMemo, useState } from 'react';
import type { TrendPoint } from '@/hooks/useRiskScoreTrend';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendAreaChart, type TrendBreakdown } from '@/components/ui/trend-area-chart';
import { PeriodoSelect, type OpcaoPeriodo } from '@/components/ui/periodo-select';

interface Props {
  /** 12 pontos mensais (mais antigo → atual) vindos de useRiskScoreTrend. */
  points: TrendPoint[];
}

type Range = '3M' | '6M' | '12M';

const RANGE_MONTHS: Record<Range, number> = { '3M': 3, '6M': 6, '12M': 12 };

export function RiskTrendChart({ points }: Props) {
  const { t } = useLanguage();
  const [range, setRange] = useState<Range>('6M');

  const janela = useMemo(() => (points || []).slice(-RANGE_MONTHS[range]), [points, range]);

  const atual = janela.length ? janela[janela.length - 1] : null;
  const anterior = janela.length > 1 ? janela[janela.length - 2] : null;
  const delta =
    atual?.scoreMedio != null && anterior?.scoreMedio != null
      ? Math.round((atual.scoreMedio - anterior.scoreMedio) * 10) / 10
      : null;

  const pontos = janela.map((p) => ({ label: p.label, valor: p.scoreMedio }));

  // No tooltip, o topo é o total de riscos e as linhas de baixo a repartição —
  // repetir a série no topo e outra vez no primeiro marcador dava o mesmo
  // número duas vezes seguidas.
  const totalDoPonto = (i: number) => janela[i]?.total ?? 0;

  const divisaoDoPonto = (i: number): TrendBreakdown[] => {
    const p = janela[i];
    if (!p) return [];
    return [
      {
        label: t('riscosVisoes.overview.riskTrendChart.tooltipAcima'),
        valor: p.acimaApetite,
        tom: 'destaque',
      },
      {
        label: t('riscosVisoes.overview.riskTrendChart.tooltipDentro'),
        valor: Math.max(p.total - p.acimaApetite, 0),
        tom: 'neutro',
      },
    ];
  };

  const opcoesPeriodo: OpcaoPeriodo<Range>[] = [
    { value: '3M', label: t('riscosVisoes.overview.riskTrendChart.range3M') },
    { value: '6M', label: t('riscosVisoes.overview.riskTrendChart.range6M') },
    { value: '12M', label: t('riscosVisoes.overview.riskTrendChart.range12M') },
  ];

  // Sem parâmetro de tipo no JSX: `<PeriodoSelect<Range> …>` é TSX válido e o
  // `tsc` aceita-o, mas o SWC do plugin do Lovable falha a analisá-lo com
  // "Expected jsx identifier" — e reporta o erro no componente EXTERIOR, o que
  // manda quem procura para o sítio errado. O tipo vem de `opcoesPeriodo`.
  const seletorPeriodo = (
    <PeriodoSelect valor={range} onChange={(v: Range) => setRange(v)} opcoes={opcoesPeriodo} />
  );

  return (
    <TrendAreaChart
      eyebrow={t('riscosVisoes.overview.riskTrendChart.titulo')}
      valor={atual?.scoreMedio ?? '—'}
      sufixo={t('riscosVisoes.overview.riskTrendChart.sufixoScore', {
        acima: atual?.acimaApetite ?? 0,
      })}
      delta={delta}
      pontos={pontos}
      tooltipLabel={t('riscosVisoes.overview.riskTrendChart.tooltipTotal')}
      tooltipValor={totalDoPonto}
      divisao={divisaoDoPonto}
      altura={200}
      seletor={seletorPeriodo}
    />
  );
}
