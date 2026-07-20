/**
 * RiscosViewChips — barra de visões salvas (chips horizontais com badge de contagem).
 * Padrão visual idêntico ao design Riscos-2: linha de chips + sublinha 2px na visão ativa.
 */
import { cn } from '@/lib/utils';

export type SavedView = 'todos' | 'acima_apetite' | 'sem_responsavel' | 'revisao_vencida' | 'meus_riscos';

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
    <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted/60 p-1">
      {items.map((v) => {
        const isActive = v.id === active;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-all',
              isActive
                ? 'bg-card text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground/90 font-medium',
            )}
          >
            {v.label}
            <span
              className={cn(
                'tabular-nums text-[10.5px] px-1.5 rounded-full',
                isActive ? 'bg-muted text-foreground/80' : 'bg-muted/70 text-muted-foreground/80',
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
