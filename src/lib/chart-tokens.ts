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
