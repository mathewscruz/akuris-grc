/**
 * RiscosTabs — controla as 3 visões (Visão geral · Matriz · Tabela) via ?view= URL param.
 * Lembra última escolha em localStorage para próxima visita.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LayoutGrid, Grid3x3, Table as TableIcon } from 'lucide-react';

export type RiscosView = 'overview' | 'matrix' | 'table';
const STORAGE_KEY = 'akuris.riscos.view';
const VALID: RiscosView[] = ['overview', 'matrix', 'table'];

interface Props {
  overview: React.ReactNode;
  matrix: React.ReactNode;
  table: React.ReactNode;
}

export function RiscosTabs({ overview, matrix, table }: Props) {
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
      <TabsList className="h-auto bg-transparent p-0 gap-1 rounded-none border-b border-border w-full justify-start">
        <TabsTrigger
          value="overview"
          className="text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
        >
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
          Visão geral
        </TabsTrigger>
        <TabsTrigger
          value="matrix"
          className="text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
        >
          <Grid3x3 className="h-3.5 w-3.5" strokeWidth={1.5} />
          Matriz
        </TabsTrigger>
        <TabsTrigger
          value="table"
          className="text-xs gap-1.5 px-3 py-2.5 -mb-px rounded-none border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold text-muted-foreground hover:text-foreground/85 transition-colors"
        >
          <TableIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
          Tabela
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-5">{overview}</TabsContent>
      <TabsContent value="matrix" className="mt-5">{matrix}</TabsContent>
      <TabsContent value="table" className="mt-5">{table}</TabsContent>
    </Tabs>
  );
}
