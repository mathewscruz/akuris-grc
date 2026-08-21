/**
 * SegmentedBar — a composição de um conjunto numa barra só.
 *
 * Onde havia N barras de progresso empilhadas para mostrar a repartição de um
 * mesmo total — riscos por severidade, requisitos por estado — passa a haver
 * uma barra e uma legenda. Três razões, todas medidas no painel que estava no
 * ar:
 *
 *  1. **N barras não somam.** Quatro barras a 9%, 64%, 27% e 100% do próprio
 *     trilho não deixam ver que as três primeiras são partes do mesmo bolo e a
 *     quarta é outro bolo. Numa barra segmentada a soma é a própria forma.
 *
 *  2. **A legenda é o filtro.** Cada linha leva ao subconjunto que representa.
 *     Antes o número aparecia como texto morto ("1 críticos · 7 altos") e para
 *     ver quais eram era preciso ir ao módulo e filtrar à mão.
 *
 *  3. **A cor fica onde significa.** Só a severidade tem escala semântica; o
 *     resto do conjunto vai a cinzento. É o mesmo corte que o `Chip` faz.
 *
 * A barra é decorativa para quem lê com leitor de ecrã: o `aria-label` resume
 * o conjunto e a legenda por baixo carrega os números em texto.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Segmento {
  /** Chave estável — não é mostrada. */
  id: string;
  /** Rótulo da legenda. */
  label: string;
  valor: number;
  /**
   * Classe de fundo da faixa. Use os tokens (`bg-severity-*`, `bg-primary`,
   * `bg-muted-foreground/30`); nunca uma cor de catálogo do Tailwind.
   */
  cor: string;
  /** Quando definido, a linha da legenda vira o filtro para este subconjunto. */
  onClick?: () => void;
}

interface Props {
  segmentos: Segmento[];
  /**
   * Resumo para leitor de ecrã ("11 riscos: 1 crítico, 7 altos, 3 restantes").
   * A barra em si é `aria-hidden`.
   */
  resumo: string;
  /** Esconde a legenda — para quando ela já existe noutro sítio. */
  semLegenda?: boolean;
  className?: string;
}

export function SegmentedBar({ segmentos, resumo, semLegenda, className }: Props) {
  const total = segmentos.reduce((s, seg) => s + seg.valor, 0);

  return (
    <div className={cn('space-y-2.5', className)}>
      {/*
        Sem total não há proporção — desenhar um trilho vazio diria "zero de
        tudo", que é diferente de "nada registado". Quem chama trata do vazio.
      */}
      <div className="flex h-2 gap-0.5" role="img" aria-label={resumo}>
        {total === 0 ? (
          <span className="flex-1 rounded-sm bg-muted" />
        ) : (
          segmentos
            .filter((s) => s.valor > 0)
            .map((s) => (
              <span
                key={s.id}
                className={cn('rounded-sm', s.cor)}
                style={{ width: `${(s.valor / total) * 100}%` }}
              />
            ))
        )}
      </div>

      {!semLegenda && (
        <ul className="space-y-1">
          {segmentos.map((s) => {
            const conteudo = (
              <>
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.cor)} />
                <span className="min-w-0 truncate">{s.label}</span>
                <span className="ml-auto font-medium tabular-nums text-foreground">{s.valor}</span>
              </>
            );
            return (
              <li key={s.id}>
                {s.onClick ? (
                  <button
                    type="button"
                    onClick={s.onClick}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-ui hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {conteudo}
                  </button>
                ) : (
                  <span className="flex w-full items-center gap-2 px-1 py-0.5 text-xs text-muted-foreground">
                    {conteudo}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
