/**
 * RequirementDrawerProvider — contexto global para abrir o RequirementDrawer
 * a partir de qualquer ponto da app (PriorityQueue, CommandPalette, etc).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { RequirementDrawer } from './RequirementDrawer';

interface DrawerState {
  requirementId: string | null;
  empresaId: string | null;
  onSaved?: () => void;
  onOpenFullDialog?: (requirementId: string) => void;
}

interface ContextValue {
  openRequirement: (params: {
    requirementId: string;
    empresaId: string;
    onSaved?: () => void;
    onOpenFullDialog?: (requirementId: string) => void;
  }) => void;
  closeRequirement: () => void;
}

const RequirementDrawerContext = createContext<ContextValue | null>(null);

export function useRequirementDrawer() {
  const ctx = useContext(RequirementDrawerContext);
  if (!ctx) throw new Error('useRequirementDrawer must be used inside RequirementDrawerProvider');
  return ctx;
}

export function RequirementDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState>({
    requirementId: null, empresaId: null,
  });
  const [open, setOpen] = useState(false);

  const openRequirement = useCallback<ContextValue['openRequirement']>((params) => {
    setState({
      requirementId: params.requirementId,
      empresaId: params.empresaId,
      onSaved: params.onSaved,
      onOpenFullDialog: params.onOpenFullDialog,
    });
    setOpen(true);
  }, []);

  const closeRequirement = useCallback(() => setOpen(false), []);

  const value = useMemo<ContextValue>(() => ({ openRequirement, closeRequirement }),
    [openRequirement, closeRequirement]);

  return (
    <RequirementDrawerContext.Provider value={value}>
      {children}
      <RequirementDrawer
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) state.onSaved?.(); }}
        requirementId={state.requirementId}
        empresaId={state.empresaId || ''}
        onSaved={state.onSaved}
        onOpenFullDialog={state.onOpenFullDialog}
      />
    </RequirementDrawerContext.Provider>
  );
}
