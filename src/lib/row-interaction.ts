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
export const isInteractiveTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest(INTERACTIVE_SELECTOR);
};

export interface RowOpenProps {
  role: 'button';
  tabIndex: 0;
  className: string;
  onClick: (e: MouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

const FOCUS_RING =
  'cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Props a espalhar numa linha de tabela ou num cartão que abre um registo.
 * Clique, Enter e barra de espaço abrem; o foco fica visível para teclado.
 *
 * @param onOpen   ação de abertura (drawer, diálogo ou navegação)
 * @param label    nome acessível do registo (aparece no leitor de ecrã)
 * @param hoverClass realce ao passar o rato (varia entre tabela e cartão)
 */
export const rowOpenProps = (
  onOpen: () => void,
  label?: string,
  hoverClass = 'hover:bg-muted/50',
): RowOpenProps & { 'aria-label'?: string } => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  className: `${FOCUS_RING} ${hoverClass}`,
  onClick: (e: MouseEvent) => {
    if (isInteractiveTarget(e.target)) return;
    onOpen();
  },
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (isInteractiveTarget(e.target)) return;
    e.preventDefault();
    onOpen();
  },
});

/** Realce de cartão (usa sombra/aresta em vez de fundo). */
export const CARD_HOVER =
  'hover:border-primary/40 hover:bg-muted/30 dark:hover:border-primary/50';
