import { toast } from 'sonner';

/**
 * Executa uma exclusão/arquivo só depois do prazo do aviso, permitindo "Desfazer".
 * Enquanto o aviso está aberto, `onHide` deve esconder o item da tela; `onRestore` o devolve.
 * Retorna uma promessa resolvida com `true` se executou e `false` se foi desfeita.
 */
export function undoableAction({
  message,
  undoLabel,
  durationMs = 5000,
  onHide,
  onRestore,
  onCommit,
}: {
  message: string;
  undoLabel: string;
  durationMs?: number;
  onHide?: () => void;
  onRestore?: () => void;
  onCommit: () => Promise<unknown> | unknown;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    onHide?.();
    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      try {
        await onCommit();
        resolve(true);
      } catch (e) {
        onRestore?.();
        throw e;
      }
    }, durationMs);
    toast(message, {
      duration: durationMs,
      action: {
        label: undoLabel,
        onClick: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          onRestore?.();
          resolve(false);
        },
      },
    });
  });
}
