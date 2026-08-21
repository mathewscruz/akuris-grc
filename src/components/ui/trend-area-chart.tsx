/**
 * TrendAreaChart — a curva de tendência que ocupa um painel inteiro.
 *
 * Um tratamento próprio, distinto dos restantes gráficos do produto, para a
 * série que é o número principal de um ecrã:
 *
 *   · gradiente que fecha até à base, para a área ter peso;
 *   · sem grelha e sem eixo Y — a leitura é a FORMA da curva, e o valor exacto
 *     está no cabeçalho e no tooltip;
 *   · guia vertical tracejada e ponto cheio no dia sob o cursor;
 *   · tooltip escuro, com o número grande e a repartição por baixo.
 *
 * Os restantes gráficos continuam dessaturados de propósito: se tudo tiver
 * este peso, deixa de haver "o número principal".
 */
import { useMemo, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  CHART_AXIS,
  CHART_FONT,
  CHART_TREND,
  CHART_TREND_GUIDE,
} from '@/lib/chart-tokens';

export interface TrendPointLike {
  /** Rótulo do eixo X. Sai em maiúsculas, como na referência. */
  label: string;
  /** Valor da série. `null` deixa buraco na linha (período sem dados). */
  valor: number | null;
}

/** Uma linha da repartição, no rodapé do tooltip. */
export interface TrendBreakdown {
  label: string;
  valor: number;
  /** `destaque` usa a cor da curva; `neutro` fica cinzento. */
  tom?: 'destaque' | 'neutro';
}

interface Props {
  pontos: TrendPointLike[];
  /** Título curto por cima do número. */
  eyebrow: string;
  /** O número grande. */
  valor: ReactNode;
  /** Texto ao lado do número (denominador, unidade). */
  sufixo?: ReactNode;
  /** Variação face ao ponto anterior. Negativo é bom nesta métrica. */
  delta?: number | null;
  /** Menor é melhor? Inverte a cor do delta. */
  menorEMelhor?: boolean;
  /** Controlo de período, à direita do cabeçalho. */
  seletor?: ReactNode;
  /** Linha de referência horizontal (meta). */
  meta?: { valor: number; label: string } | null;
  /**
   * Repartição mostrada no tooltip, para o ponto sob o cursor.
   *
   * Sem acento no nome de propósito: o plugin SWC do Lovable injecta
   * `data-lov-*` em cada elemento JSX e rebenta a analisar um identificador
   * acentuado — "Unexpected token. Expected jsx identifier".
   */
  divisao?: (indice: number) => TrendBreakdown[];
  /** Legenda do número do topo do tooltip. */
  tooltipLabel: string;
  /**
   * Número do topo do tooltip, quando não é o valor da série.
   *
   * Na referência o topo é o TOTAL ("98 rules") e as linhas de baixo são a
   * repartição ("66 ready" / "32 need work"). Repetir a série no topo e outra
   * vez no primeiro bullet dava o mesmo número duas vezes seguidas.
   */
  tooltipValor?: (indice: number) => number;
  /**
   * Altura fixa da área do gráfico. Omitir faz o gráfico ESTICAR até ao fim
   * do contentor — que é o que um cartão de painel quer: a curva ocupava
   * 260px no meio de um cartão de 560 e deixava metade em branco.
   */
  altura?: number;
  /**
   * Bloco entre o cabeçalho e a curva — tipicamente a composição do conjunto
   * (`SegmentedBar`). A curva diz para onde vai; a composição diz do que é
   * feito o número de hoje.
   *
   * Sem acento no nome, como `divisao`: o plugin SWC do Lovable rebenta a
   * analisar um identificador acentuado em JSX.
   */
  resumo?: ReactNode;
  /** Rodapé do painel — o `PanelAction` com o próximo passo. */
  rodape?: ReactNode;
  className?: string;
}

/** Só rótulos de ponta e do meio, como na referência — não os 31 dias. */
function tiquesEsparsos(total: number): number {
  if (total <= 8) return 0;
  return Math.max(1, Math.round(total / 6) - 1);
}

export function TrendAreaChart({
  pontos,
  eyebrow,
  valor,
  sufixo,
  delta = null,
  menorEMelhor = true,
  seletor,
  meta = null,
  divisao,
  tooltipLabel,
  tooltipValor,
  altura,
  resumo,
  rodape,
  className,
}: Props) {
  const data = useMemo(
    () => pontos.map((p, i) => ({ ...p, __i: i, label: p.label.toUpperCase() })),
    [pontos],
  );

  const deltaBom = delta !== null && (menorEMelhor ? delta < 0 : delta > 0);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden',
        // Sem altura fixa, o painel é uma coluna que estica: o cabeçalho fica
        // no topo e o gráfico ocupa o resto.
        altura === undefined && 'flex flex-col',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 p-5 pb-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">{eyebrow}</div>
          <div className="text-xl font-semibold tabular-nums tracking-tight mt-1 flex items-baseline gap-2 flex-wrap">
            {valor}
            {sufixo && <span className="text-sm text-muted-foreground font-normal">{sufixo}</span>}
            {delta !== null && delta !== 0 && (
              <span
                className={cn(
                  'text-xs font-medium tabular-nums',
                  deltaBom ? 'text-success' : 'text-destructive',
                )}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
        </div>
        {seletor && <div className="shrink-0">{seletor}</div>}
      </div>

      {resumo && <div className="px-5 pb-1 pt-2">{resumo}</div>}

      <div
        style={altura !== undefined ? { height: altura } : undefined}
        /* A legenda da composição passou a horizontal e devolveu ~26px de
           altura. O piso da curva sobe com eles: num painel curto, 180px
           deixavam o gráfico como uma faixa fina no meio de espaço vazio. */
        className={cn('px-1 pb-1', altura === undefined && 'flex-1 min-h-[220px]')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 16, bottom: 4 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_TREND} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART_TREND} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Sem grelha e sem eixo Y: a leitura é a forma da curva. */}
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={tiquesEsparsos(data.length)}
              tick={{ fontSize: CHART_FONT.axis, fill: CHART_AXIS, letterSpacing: '0.06em' }}
              dy={8}
            />
            <YAxis hide domain={[0, 'auto']} allowDecimals={false} />

            {meta && (
              <ReferenceLine
                y={meta.valor}
                stroke={CHART_AXIS}
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: meta.label,
                  fontSize: CHART_FONT.axis,
                  fill: CHART_AXIS,
                  position: 'insideTopRight',
                }}
              />
            )}

            <RTooltip
              cursor={{ stroke: CHART_TREND_GUIDE, strokeWidth: 1, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { valor: number | null; __i: number };
                if (p.valor === null) return null;
                const linhas = divisao?.(p.__i) ?? [];
                const topo = tooltipValor ? tooltipValor(p.__i) : p.valor;
                return (
                  <div className="rounded-lg bg-foreground px-3.5 py-2.5 shadow-lg min-w-[9rem]">
                    <div className="text-lg font-semibold tabular-nums text-background leading-tight">
                      {topo}
                    </div>
                    <div className="text-micro text-background/60">{tooltipLabel}</div>
                    {linhas.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-background/15 space-y-1">
                        {linhas.map((l) => (
                          <div
                            key={l.label}
                            className="flex items-center gap-2 text-xs text-background/85"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  l.tom === 'neutro' ? 'hsl(var(--background) / 0.45)' : CHART_TREND,
                              }}
                            />
                            <span className="tabular-nums font-medium">{l.valor}</span>
                            <span className="text-background/65">{l.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="valor"
              fill="url(#trendFill)"
              stroke="none"
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={CHART_TREND}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              // Só o ponto sob o cursor ganha marca — com 31 dias, um ponto por
              // dia vira uma fila de contas em vez de uma curva.
              activeDot={{ r: 4.5, fill: CHART_TREND, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {rodape}
    </div>
  );
}
