/**
 * SectionHeatmap — grade compacta de seções/categorias com aderência %.
 * Cada célula clicável filtra a tabela de requisitos.
 * Substitui CategoryBarChart em densidade alta — mostra mais info em menos espaço.
 */
import { cn } from '@/lib/utils';
import { SectionHead } from './SectionHead';

export interface HeatCell {
  id: string;
  label: string;
  total: number;
  conforme: number;
  parcial: number;
  nao_conforme: number;
  nao_aplicavel: number;
  nao_avaliado: number;
}

interface SectionHeatmapProps {
  cells: HeatCell[];
  activeId?: string;
  onCellClick?: (id: string) => void;
  title?: string;
}

function getScore(c: HeatCell): { score: number; coverage: number } {
  const applicable = c.total - c.nao_aplicavel;
  if (applicable <= 0) return { score: 0, coverage: 0 };
  const score = Math.round(((c.conforme * 100 + c.parcial * 50) / applicable));
  const evaluated = c.conforme + c.parcial + c.nao_conforme + c.nao_aplicavel;
  const coverage = c.total > 0 ? Math.round((evaluated / c.total) * 100) : 0;
  return { score, coverage };
}

function getToneBg(score: number, coverage: number): string {
  if (coverage === 0) return 'bg-muted/50 hover:bg-muted';
  if (score >= 80) return 'bg-success/15 hover:bg-success/25 border-success/30';
  if (score >= 60) return 'bg-primary/10 hover:bg-primary/20 border-primary/30';
  if (score >= 40) return 'bg-warning/15 hover:bg-warning/25 border-warning/30';
  return 'bg-destructive/15 hover:bg-destructive/25 border-destructive/30';
}

function getToneText(score: number, coverage: number): string {
  if (coverage === 0) return 'text-muted-foreground';
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

export function SectionHeatmap({
  cells,
  activeId,
  onCellClick,
  title = 'ADERÊNCIA POR CATEGORIA',
}: SectionHeatmapProps) {
  if (!cells.length) return null;

  return (
    <section>
      <SectionHead
        title={title}
        count={cells.length}
        right={
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Clique para filtrar
          </span>
        }
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {cells.map((c) => {
          const { score, coverage } = getScore(c);
          const isActive = activeId === c.id;
          const toneBg = getToneBg(score, coverage);
          const toneText = getToneText(score, coverage);

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCellClick?.(c.id)}
              className={cn(
                'group relative text-left rounded-lg border transition-all duration-200 p-3 min-h-[88px] flex flex-col justify-between',
                toneBg,
                isActive ? 'ring-2 ring-primary border-primary' : 'border-border'
              )}
              title={c.label}
            >
              <div className="text-[10px] font-medium text-foreground/80 line-clamp-2 leading-tight">
                {c.label}
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className={cn('font-mono text-xl font-semibold tabular-nums leading-none', toneText)}>
                  {coverage === 0 ? '—' : `${score}`}
                </span>
                <span className="text-[9px] font-mono tabular-nums text-muted-foreground">
                  {c.total}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
