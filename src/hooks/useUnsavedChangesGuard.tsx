import { useCallback, useEffect, useState } from 'react';
import { tGlobal } from '@/lib/i18n-global';

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  enabled?: boolean;
  message?: string;
}

/**
 * Guards against accidental closure when there are unsaved changes.
 * - Intercepts browser unload (refresh/close tab)
 * - Provides confirmCloseIfDirty() helper for dialogs/navigation
 */
export function useUnsavedChangesGuard({
  isDirty,
  enabled = true,
  message = tGlobal('sweepCore.unsavedChanges'),
}: UseUnsavedChangesGuardOptions) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, enabled, message]);

  /**
   * Wrap a close/navigation action: if dirty, opens confirm; otherwise runs immediately.
   */
  const confirmCloseIfDirty = useCallback(
    (action: () => void) => {
      if (!enabled || !isDirty) {
        action();
        return;
      }
      setPendingAction(() => action);
      setShowConfirm(true);
    },
    [isDirty, enabled]
  );

  const confirmDiscard = useCallback(() => {
    pendingAction?.();
    setPendingAction(null);
    setShowConfirm(false);
  }, [pendingAction]);

  const cancelDiscard = useCallback(() => {
    setPendingAction(null);
    setShowConfirm(false);
  }, []);

  return { showConfirm, confirmCloseIfDirty, confirmDiscard, cancelDiscard };
}
