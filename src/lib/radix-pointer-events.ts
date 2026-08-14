/**
 * Correção global do "primeiro clique engolido" após fechar overlays Radix.
 *
 * O Radix aplica `pointer-events: none` no <body> enquanto um modal está
 * aberto e remove-o ao fechar. Quando há overlays empilhados (dialog dentro de
 * dialog, alert-dialog sobre sheet, popover dentro de dialog) a limpeza pode
 * perder-se e o body fica bloqueado — o clique seguinte é ignorado.
 *
 * Este hook, montado em todos os wrappers de Dialog/AlertDialog/Sheet/Popover,
 * verifica ao desmontar se ainda existe algum overlay aberto e, se não existir,
 * liberta o body.
 */
import { useEffect } from 'react';

const SELETOR_OVERLAY_ABERTO = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[data-radix-popper-content-wrapper]',
  '[data-state="open"][data-radix-menu-content]',
].join(', ');

/** Liberta `pointer-events` do body quando nenhum overlay Radix continua aberto. */
export function releaseBodyPointerEvents(): void {
  if (typeof document === 'undefined') return;
  window.setTimeout(() => {
    const aindaAberto = document.querySelector(SELETOR_OVERLAY_ABERTO);
    if (!aindaAberto && document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = '';
    }
  }, 0);
}

/** Versão hook: limpa ao desmontar o conteúdo do overlay. */
export function useReleaseBodyPointerEvents(): void {
  useEffect(() => releaseBodyPointerEvents, []);
}
