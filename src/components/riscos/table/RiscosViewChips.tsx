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
    <div className="flex items-center gap-1 border-b border-border overflow-x-auto -mb-px">
      {items.map((v) => {
        const isActive = v.id === active;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              'whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-xs transition-colors',
              isActive
                ? 'border-foreground text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground/85 font-medium',
            )}
          >
            {v.label}
            <span
              className={cn(
                'tabular-nums text-[10.5px] px-1.5 py-0.5 rounded-full',
                isActive ? 'bg-muted text-foreground/80' : 'text-muted-foreground/80',
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
