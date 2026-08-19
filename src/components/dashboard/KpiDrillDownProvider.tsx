import * as React from 'react';
import { KpiDrillDownDrawer, type DrillDownKey } from './KpiDrillDownDrawer';

interface KpiDrillDownContextValue {
  open: (key: DrillDownKey) => void;
}

const KpiDrillDownContext = React.createContext<KpiDrillDownContextValue | null>(null);

/**
 * Provider único do drawer de drill-down. Deve envolver a árvore (Layout)
 * para que qualquer item de StatStrip com `drillDown` possa abri-lo via contexto,
 * sem prop-drilling.
 */
export const KpiDrillDownProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeKey, setActiveKey] = React.useState<DrillDownKey | null>(null);

  const value = React.useMemo<KpiDrillDownContextValue>(
    () => ({ open: (key) => setActiveKey(key) }),
    []
  );

  return (
    <KpiDrillDownContext.Provider value={value}>
      {children}
      <KpiDrillDownDrawer
        open={!!activeKey}
        onOpenChange={(o) => { if (!o) setActiveKey(null); }}
        kpiKey={activeKey}
      />
    </KpiDrillDownContext.Provider>
  );
};

/** Retorna o controller do drawer. Safe-no-op se não houver provider. */
export function useKpiDrillDown(): KpiDrillDownContextValue {
  const ctx = React.useContext(KpiDrillDownContext);
  return ctx ?? { open: () => {} };
}
