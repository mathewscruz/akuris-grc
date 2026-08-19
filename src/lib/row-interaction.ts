import type { KeyboardEvent, MouseEvent } from 'react';

/**
 * Regra única do clique (Envio 11 · T2).
 *
 * Se um cartão ou uma linha de tabela representa um registo com título, ABRE ao
 * clicar. O menu de três pontos fica exclusivamente para ações secundárias.
 *
 * Zonas interativas dentro da linha (botões, links, checkboxes, chips
 * clicáveis, menus) param a propagação em vez de reduzir a área clicável.
 */

/** Seletor das zonas que nunca devem disparar a abertura do registo. */
export const INTERACTIVE_SELECTOR =
  'button,a,input,select,textarea,label,[role="menuitem"],[role="checkbox"],[role="switch"],[role="button"],[data-no-row-click]';

/** True quando o evento nasceu numa zona interativa (não deve abrir o registo). */
export const isInteractiveTarget = (
  target: EventTarget | null,
  boundary?: EventTarget | null,
): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  const hit = el.closest(INTERACTIVE_SELECTOR);
  if (!hit) return false;
  // A própria linha/cartão tem role="button": não pode contar como zona interativa.
  if (boundary && (hit === boundary || hit.contains(boundary as Node))) return false;
  return true;
};

export interface RowOpenProps {
  tabIndex: 0;
  className: string;
  onClick: (e: MouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  'data-row-open': '';
}

const FOCUS_RING =
  'cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Props a espalhar numa linha de tabela ou num cartão que abre um registo.
 * Clique, Enter e barra de espaço abrem; o foco fica visível para teclado.
 *
 * NÃO leva `role="button"`: a linha/cartão contém sempre controlos próprios
 * (o botão do nome, o menu de três pontos) e um `button` não pode conter
 * descendentes focáveis. Com o role, o leitor de ecrã anunciava o registo duas
 * vezes — uma pela linha, outra pelo botão do nome — e o HTML ficava inválido.
 * Sem ele, a linha mantém a semântica nativa e continua focável e acionável.
 *
 * @param onOpen   ação de abertura (drawer, diálogo ou navegação)
 * @param label    reservado; ignorado desde a remoção do role="button"
 * @param hoverClass realce ao passar o rato (varia entre tabela e cartão)
 */
export const rowOpenProps = (
  onOpen: () => void,
  label?: string,
  hoverClass = 'hover:bg-accent',
): RowOpenProps => ({
  tabIndex: 0,
  'data-row-open': '',
  className: `${FOCUS_RING} ${hoverClass}`,
  onClick: (e: MouseEvent) => {
    if (isInteractiveTarget(e.target, e.currentTarget)) return;
    onOpen();
  },
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (isInteractiveTarget(e.target, e.currentTarget)) return;
    e.preventDefault();
    onOpen();
  },
});

/** Realce de cartão (usa sombra/aresta em vez de fundo). */
export const CARD_HOVER =
  'hover:border-primary/40 hover:bg-accent dark:hover:border-primary/50';
