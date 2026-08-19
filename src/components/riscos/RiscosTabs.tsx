/**
 * RiscosTabs — controla as 3 visões (Visão geral · Matriz · Tabela) via ?view= URL param.
 * Lembra última escolha em localStorage para próxima visita.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconGrid, IconShieldCheck, IconTable } from '@/components/icons';

export type RiscosView = 'overview' | 'matrix' | 'table' | 'aceite';
const STORAGE_KEY = 'akuris.riscos.view';
const VALID: RiscosView[] = ['overview', 'matrix', 'table', 'aceite'];

interface Props {
  overview: React.ReactNode;
  matrix: React.ReactNode;
  table: React.ReactNode;
  aceite: React.ReactNode;
}

export function RiscosTabs({ overview, matrix, table, aceite }: Props) {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlView = searchParams.get('view') as RiscosView | null;
  const stored = (typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as RiscosView | null) : null);
  const initial: RiscosView =
    urlView && VALID.includes(urlView) ? urlView : stored && VALID.includes(stored) ? stored : 'table';

  useEffect(() => {
    if (!urlView) {
      const sp = new URLSearchParams(searchParams);
      sp.set('view', initial);
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (v: string) => {
    const view = v as RiscosView;
    localStorage.setItem(STORAGE_KEY, view);
    const sp = new URLSearchParams(searchParams);
    sp.set('view', view);
    setSearchParams(sp, { replace: true });
  };

  return (
    <Tabs value={urlView || initial} onValueChange={onChange} className="w-full">
      <TabsList>
        <TabsTrigger
          value="overview"
          className="text-xs gap-1.5"
        >
          <IconGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t('riscosDetalhe.tabs.overview')}
        </TabsTrigger>
        <TabsTrigger
          value="matrix"
          className="text-xs gap-1.5"
        >
          <IconGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t('riscosDetalhe.tabs.matrix')}
        </TabsTrigger>
        <TabsTrigger
          value="table"
          className="text-xs gap-1.5"
        >
          <IconTable className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t('riscosDetalhe.tabs.table')}
        </TabsTrigger>
        <TabsTrigger
          value="aceite"
          className="text-xs gap-1.5"
        >
          <IconShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t('riscosDetalhe.tabs.aceite')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="matrix">{matrix}</TabsContent>
      <TabsContent value="table">{table}</TabsContent>
      <TabsContent value="aceite">{aceite}</TabsContent>
    </Tabs>
  );
}
