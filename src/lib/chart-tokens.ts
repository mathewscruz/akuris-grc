/**
 * Akuris Chart Tokens — Envio 9 (linguagem visual e cor).
 * --------------------------------------------------------------------------
 * O roxo da marca ficou reservado a AÇÃO e NAVEGAÇÃO ATIVA (botão primário,
 * item ativo do menu, separador ativo, foco). Por isso os gráficos usam uma
 * paleta neutra e sóbria (cinzentos e azuis dessaturados), e a cor com
 * significado (vermelho/laranja/âmbar/verde) fica exclusiva da severidade.
 *
 * Nunca escrever cores à mão nos gráficos: consumir sempre estas constantes.
 */

/** Séries genéricas, por ordem de uso. */
export const CHART_SERIES = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
] as const;

/** Cor da série n (cicla a paleta). */
export const chartSeries = (index: number): string =>
  CHART_SERIES[((index % CHART_SERIES.length) + CHART_SERIES.length) % CHART_SERIES.length];

/**
 * Tendência — a curva que ocupa um painel inteiro.
 *
 * A única série com saturação. Usa-se no `TrendAreaChart` e em mais lado
 * nenhum — se aparecer noutro gráfico, deixa de haver hierarquia entre "o
 * número principal" e os restantes.
 */
export const CHART_TREND = 'hsl(var(--chart-trend))';
export const CHART_TREND_GUIDE = 'hsl(var(--chart-trend-guide))';

export const CHART_GRID = 'hsl(var(--chart-grid))';
export const CHART_AXIS = 'hsl(var(--chart-axis))';
export const CHART_TOOLTIP_BG = 'hsl(var(--popover))';
export const CHART_TOOLTIP_BORDER = 'hsl(var(--border))';

/**
 * Opacidade das áreas preenchidas. No tema escuro é maior, senão as áreas
 * desapareciam sobre o navy.
 */
export const CHART_AREA_OPACITY = 'var(--chart-area-opacity)';

/** Escala de severidade — o único sítio onde o gráfico ganha cor semântica. */
export const CHART_SEVERITY = {
  critical: 'hsl(var(--severity-critical))',
  high: 'hsl(var(--severity-high))',
  medium: 'hsl(var(--severity-medium))',
  low: 'hsl(var(--severity-low))',
  none: 'hsl(var(--severity-none))',
} as const;

export type ChartSeverityKey = keyof typeof CHART_SEVERITY;

/** Estilo padrão do tooltip Recharts (superfície elevada + aresta subtil). */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: '8px',
  fontSize: '12px',
  color: 'hsl(var(--popover-foreground))',
} as const;

/**
 * Corpo de letra dos gráficos, na mesma escala do resto.
 *
 * Os rótulos de eixo estavam escritos como números — 10, 11, 12 e 13 px
 * espalhados por oito gráficos. Número em `fontSize` vira pixel fixo no SVG,
 * portanto era o único texto do produto que NÃO acompanhava a resolução: num
 * monitor de 1920 todo o resto crescia e o eixo do gráfico ficava para trás.
 *
 * Em `rem` o SVG resolve contra a raiz, tal como o CSS, e os gráficos passam
 * a seguir o `clamp()` de `index.css` como tudo o mais.
 */
export const CHART_FONT = {
  /** Eixos e legendas — equivale a `text-micro`. */
  axis: '0.6875rem',
  /** Valores dentro do gráfico — equivale a `text-xs`. */
  label: '0.75rem',
} as const;
