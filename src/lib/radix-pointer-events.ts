/**
 * Correção global do "primeiro clique engolido" após fechar overlays Radix.
 *
 * O Radix aplica `pointer-events: none` no <body> enquanto um modal está aberto
 * e remove-o ao fechar. Quando há overlays empilhados (dialog dentro de dialog,
 * alert-dialog sobre sheet, popover dentro de dialog) a limpeza pode perder-se
 * e o body fica bloqueado — o clique seguinte é ignorado.
 *
 * Em vez de remendar cada componente, instalamos um observador único: sempre
 * que o body ficar bloqueado sem nenhum overlay aberto no DOM, libertamos.
 */
import { useEffect } from 'react';

const SELETOR_OVERLAY_ABERTO = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[data-radix-popper-content-wrapper]',
  '[data-radix-menu-content][data-state="open"]',
].join(', ');

/** Liberta `pointer-events` do body quando nenhum overlay Radix continua aberto. */
export function releaseBodyPointerEvents(): void {
  if (typeof document === 'undefined') return;
  if (document.body.style.pointerEvents !== 'none') return;
  if (document.querySelector(SELETOR_OVERLAY_ABERTO)) return;
  document.body.style.pointerEvents = '';
}

/** Versão hook: verifica ao desmontar o conteúdo do overlay. */
export function useReleaseBodyPointerEvents(): void {
  useEffect(() => () => {
    window.setTimeout(releaseBodyPointerEvents, 0);
  }, []);
}

let instalado = false;

/**
 * Instala o observador global (chamado uma vez em `main.tsx`). Cobre todos os
 * Dialog/AlertDialog/Sheet/Popover/Dropdown da aplicação, incluindo overlays
 * empilhados que fecham em cascata.
 */
export function installGlobalPointerEventsGuard(): void {
  if (instalado || typeof document === 'undefined') return;
  instalado = true;

  const verificar = () => window.setTimeout(releaseBodyPointerEvents, 0);

  // Mudanças de estado dos overlays (montagem/desmontagem no portal) e do
  // próprio atributo style do body.
  const observer = new MutationObserver(verificar);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'data-state'],
  });

  // Rede de segurança: qualquer interação do utilizador destranca o body se
  // não houver overlay aberto.
  window.addEventListener('pointerdown', releaseBodyPointerEvents, true);
  window.addEventListener('keydown', releaseBodyPointerEvents, true);
}
