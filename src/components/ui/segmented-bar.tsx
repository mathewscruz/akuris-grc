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
 * A legenda fica NA HORIZONTAL, cada entrada debaixo da sua fatia. Empilhada,
 * ocupava três linhas e 66px de altura para dizer três números, e obrigava o
 * olho a saltar da cor na barra para a cor na lista. Debaixo da fatia, a
 * ligação entre o número e a cor não precisa de ser procurada.
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
  /** Quando definido, a entrada da legenda vira o filtro para este subconjunto. */
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

/**
 * Largura mínima de uma entrada da legenda.
 *
 * Sem ela, uma fatia de 1 em 100 daria uma coluna de 6px e o rótulo ficava
 * ilegível. Com `flex-basis` na proporção real e este mínimo, o alinhamento é
 * exacto enquanto houver espaço, e degrada para legível quando não houver.
 */
const LARGURA_MINIMA = '3.5rem';

export function SegmentedBar({ segmentos, resumo, semLegenda, className }: Props) {
  const total = segmentos.reduce((s, seg) => s + seg.valor, 0);
  const fatia = (valor: number) => (total === 0 ? 0 : (valor / total) * 100);

  return (
    <div className={cn('space-y-2', className)}>
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
                style={{ width: `${fatia(s.valor)}%` }}
              />
            ))
        )}
      </div>

      {!semLegenda && (
        /* O mesmo `gap` da barra: as colunas caem debaixo das fatias. */
        <ul className="flex gap-0.5">
          {segmentos.map((s) => {
            const conteudo = (
              <>
                <span className="flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.cor)} />
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {s.valor}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-micro text-muted-foreground">
                  {s.label}
                </span>
              </>
            );
            return (
              <li
                key={s.id}
                className="min-w-0"
                style={{ flex: `1 1 ${fatia(s.valor)}%`, minWidth: LARGURA_MINIMA }}
              >
                {s.onClick ? (
                  <button
                    type="button"
                    onClick={s.onClick}
                    title={s.label}
                    className="block w-full min-w-0 rounded-md py-0.5 pr-1 text-left transition-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {conteudo}
                  </button>
                ) : (
                  <span className="block w-full min-w-0 py-0.5 pr-1" title={s.label}>
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
