/**
 * RiscosTabs — controla as três áreas operacionais (Matriz · Tabela · Aceite)
 * via `?view=` e lembra a última escolha em localStorage.
 *
 * A antiga visão geral foi removida por duplicar indicadores que já vivem no
 * Dashboard, na Matriz e nos filtros rápidos da Tabela. Links e preferências
 * antigos com `overview` são normalizados para `table`.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';

export type RiscosView = 'matrix' | 'table' | 'aceite';
const STORAGE_KEY = 'akuris.riscos.view';
const VALID: RiscosView[] = ['matrix', 'table', 'aceite'];

export function resolveRiscosView(requested: string | null, stored: string | null): RiscosView {
  if (requested) return VALID.includes(requested as RiscosView) ? requested as RiscosView : 'table';
  return VALID.includes(stored as RiscosView) ? stored as RiscosView : 'table';
}

interface Props {
  matrix: React.ReactNode;
  table: React.ReactNode;
  aceite: React.ReactNode;
}

export function RiscosTabs({ matrix, table, aceite }: Props) {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  // Um parâmetro explícito inválido (incluindo o legado `overview`) deve cair
  // sempre na Tabela; sem parâmetro, respeitamos a última área válida.
  const activeView = resolveRiscosView(requestedView, stored);

  useEffect(() => {
    if (requestedView !== activeView) {
      const sp = new URLSearchParams(searchParams);
      sp.set('view', activeView);
      setSearchParams(sp, { replace: true });
    }
    if (stored !== activeView) localStorage.setItem(STORAGE_KEY, activeView);
  }, [activeView, requestedView, searchParams, setSearchParams, stored]);

  const onChange = (v: string) => {
    const view = v as RiscosView;
    localStorage.setItem(STORAGE_KEY, view);
    const sp = new URLSearchParams(searchParams);
    sp.set('view', view);
    setSearchParams(sp, { replace: true });
  };

  return (
    <Tabs value={activeView} onValueChange={onChange} className="w-full">
      <TabsList>
        <TabsTrigger
          value="matrix"
          className="text-xs"
        >
          {t('riscosDetalhe.tabs.matrix')}
        </TabsTrigger>
        <TabsTrigger
          value="table"
          className="text-xs"
        >
          {t('riscosDetalhe.tabs.table')}
        </TabsTrigger>
        <TabsTrigger
          value="aceite"
          className="text-xs"
        >
          {t('riscosDetalhe.tabs.aceite')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="matrix">{matrix}</TabsContent>
      <TabsContent value="table">{table}</TabsContent>
      <TabsContent value="aceite">{aceite}</TabsContent>
    </Tabs>
  );
}
