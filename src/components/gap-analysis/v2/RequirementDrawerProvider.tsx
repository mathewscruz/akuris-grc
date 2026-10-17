/**
 * RequirementDrawerProvider — contexto global para abrir o RequirementDrawer
 * a partir de qualquer ponto da app (PriorityQueue, CommandPalette, etc).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RequirementDrawer } from './RequirementDrawer';

interface DrawerState {
  requirementId: string | null;
  empresaId: string | null;
  onSaved?: () => void;
  sequence?: string[];
}

interface ContextValue {
  openRequirement: (params: {
    requirementId: string;
    empresaId: string;
    onSaved?: () => void;
    /** Ordem dos requisitos visíveis, para anterior/próximo. */
    sequence?: string[];
  }) => void;
  closeRequirement: () => void;
}

const RequirementDrawerContext = createContext<ContextValue | null>(null);

export function useRequirementDrawer() {
  const ctx = useContext(RequirementDrawerContext);
  if (!ctx) throw new Error('useRequirementDrawer must be used inside RequirementDrawerProvider');
  return ctx;
}

/** Versão tolerante: devolve null fora do provider. */
export function useOptionalRequirementDrawer() {
  return useContext(RequirementDrawerContext);
}

export function RequirementDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState>({
    requirementId: null, empresaId: null,
  });
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();
  const { frameworkId } = useParams();
  const openRequirement = useCallback<ContextValue['openRequirement']>((params) => {
    // Dentro de um framework, a revisão é uma página cheia com rota própria.
    if (frameworkId) {
      navigate(`/gap-analysis/framework/${frameworkId}/requisito/${params.requirementId}`, { state: { sequence: params.sequence } });
      return;
    }
    setState({
      requirementId: params.requirementId,
      empresaId: params.empresaId,
      onSaved: params.onSaved,
      sequence: params.sequence,
    });
    setOpen(true);
  }, [frameworkId, navigate]);

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
        sequence={state.sequence}
        onNavigate={(id) => setState((s) => ({ ...s, requirementId: id }))}
      />
    </RequirementDrawerContext.Provider>
  );
}
