/**
 * RiscosViewChips — barra de visões salvas.
 * Usa o padrão único de abas do Akuris: régua com linha de base e
 * indicador (underline) roxo na visão activa.
 */
import { cn } from '@/lib/utils';

export type SavedView = 'todos' | 'rascunhos' | 'acima_apetite' | 'sem_responsavel' | 'revisao_vencida' | 'meus_riscos';

interface ViewItem {
  id: SavedView;
  label: string;
  count: number;
}

interface Props {
  active: SavedView;
  onChange: (v: SavedView) => void;
  items: ViewItem[];
}

export function RiscosViewChips({ active, onChange, items }: Props) {
  return (
    <div
      role="tablist"
      className="flex w-full items-center gap-6 overflow-x-auto border-b border-border text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((v) => {
        const isActive = v.id === active;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(v.id)}
            className={cn(
              'group relative inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap',
              'border-b-2 border-transparent bg-transparent px-1 py-3 -mb-px text-sm font-medium leading-tight',
              'ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm',
              isActive
                ? 'border-primary text-primary font-semibold dark:text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {v.label}
            <span
              className={cn(
                'tabular-nums text-micro px-1.5 rounded-md',
                isActive ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {v.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
