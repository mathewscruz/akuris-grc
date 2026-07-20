/**
 * RequirementsTableToolbar — chips contextuais + toggle de visão.
 * Sincroniza filtros via searchParams para que GenericRequirementsTable
 * reaja sem precisar de prop drilling.
 */
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface RequirementsToolbarCounts {
  total: number;
  semEvidencia: number;
  criticos: number;
  parciais: number;
}

interface Props {
  counts: RequirementsToolbarCounts;
}

type ChipKey = 'all' | 'sem_evidencia' | 'criticos' | 'parciais';

const CHIPS: Array<{
  key: ChipKey;
  label: string;
  field: keyof RequirementsToolbarCounts;
  /** Filtros a serem aplicados aos searchParams. */
  apply: (sp: URLSearchParams) => void;
}> = [
  { key: 'all', label: 'Todos', field: 'total', apply: (sp) => { sp.delete('status'); sp.delete('prio'); } },
  { key: 'sem_evidencia', label: 'Sem evidência', field: 'semEvidencia', apply: (sp) => { sp.set('status', 'nao_avaliado'); sp.delete('prio'); } },
  { key: 'criticos', label: 'Críticos', field: 'criticos', apply: (sp) => { sp.set('status', 'nao_conforme'); sp.set('prio', '1'); } },
  { key: 'parciais', label: 'Parciais', field: 'parciais', apply: (sp) => { sp.set('status', 'parcial'); sp.delete('prio'); } },
];

function detectActive(sp: URLSearchParams): ChipKey {
  const status = sp.get('status');
  const prio = sp.get('prio');
  if (status === 'nao_conforme' && prio === '1') return 'criticos';
  if (status === 'nao_avaliado') return 'sem_evidencia';
  if (status === 'parcial') return 'parciais';
  return 'all';
}

export function RequirementsTableToolbar({ counts }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = detectActive(searchParams);

  const handleChip = (chip: typeof CHIPS[number]) => {
    const sp = new URLSearchParams(searchParams);
    chip.apply(sp);
    setSearchParams(sp, { replace: true });
  };

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {CHIPS.map((chip) => {
          const isActive = active === chip.key;
          const count = counts[chip.field];
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => handleChip(chip)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors',
                isActive
                  ? 'border-foreground bg-foreground text-background font-medium'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/40'
              )}
            >
              <span>{chip.label}</span>
              <span
                className={cn(
                  'tabular-nums text-[10px] font-mono',
                  isActive ? 'text-background/70' : 'text-muted-foreground'
                )}
              >
                · {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1 text-xs font-medium"
        >
          <Rows3 className="h-3 w-3" strokeWidth={1.5} />
          Tabela
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground/60 cursor-not-allowed"
            >
              <LayoutGrid className="h-3 w-3" strokeWidth={1.5} />
              Quadro
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-xs">Visualização em quadro chega na próxima onda.</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
