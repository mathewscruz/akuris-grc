/**
 * RiscosTabs — controla as três áreas operacionais (Riscos · Matriz · Aceite)
 * via `?view=`. Sem uma vista explícita, a carteira de Riscos é sempre a
 * entrada principal — uma preferência antiga não pode devolver a pessoa à
 * Matriz depois desta mudança de hierarquia.
 *
 * A antiga visão geral foi removida por duplicar indicadores que já vivem no
 * Dashboard, na Matriz e nos filtros rápidos da Tabela. Links e preferências
 * antigos com `overview` são normalizados para `table`.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { RiscosIcon, IconGrid, IconShieldCheck } from '@/components/icons';

export type RiscosView = 'matrix' | 'table' | 'aceite';
const STORAGE_KEY = 'akuris.riscos.view';
const VALID: RiscosView[] = ['matrix', 'table', 'aceite'];

export function resolveRiscosView(requested: string | null, _stored: string | null): RiscosView {
  if (requested) return VALID.includes(requested as RiscosView) ? requested as RiscosView : 'table';
  return 'table';
}

interface Props {
  riskCount?: number;
  acceptedCount?: number;
  matrixCount?: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  matrix: React.ReactNode;
  table: React.ReactNode;
  aceite: React.ReactNode;
}

export function RiscosTabs({ matrix, table, aceite, riskCount, acceptedCount, matrixCount, searchValue, onSearchChange }: Props) {
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
      <TabsList moduleTitle={t('sidebar.riskManagement')} moduleIcon={<RiscosIcon className="h-4 w-4" />}>
        <TabsTrigger
          value="table" count={riskCount}
          className="text-xs"
        >
          <RiscosIcon />
          {t('riscosDetalhe.tabs.table')}
        </TabsTrigger>
        <TabsTrigger
          value="matrix" count={matrixCount}
          className="text-xs"
        >
          <IconGrid />
          {t('riscosDetalhe.tabs.matrix')}
        </TabsTrigger>
        <TabsTrigger
          value="aceite"
          count={acceptedCount}
          className="text-xs"
        >
          <IconShieldCheck />
          {t('riscosDetalhe.tabs.aceite')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="table">{table}</TabsContent>
      <TabsContent value="matrix">{matrix}</TabsContent>
      <TabsContent value="aceite">{aceite}</TabsContent>
    </Tabs>
  );
}
