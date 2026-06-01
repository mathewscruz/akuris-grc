import React, { useMemo } from 'react';
import type { ProjetoTarefa, ProjetoTarefaPrioridade } from '@/types/projetos';
import { EmptyState } from '@/components/ui/empty-state';

interface GanttChartProps {
  tarefas: ProjetoTarefa[];
  onSelectTarefa?: (t: ProjetoTarefa) => void;
}

const prioridadeColor: Record<ProjetoTarefaPrioridade, string> = {
  critica: 'hsl(var(--destructive))',
  alta: 'hsl(var(--warning, 38 92% 50%))',
  media: 'hsl(var(--primary))',
  baixa: 'hsl(var(--muted-foreground))',
};

const DAY_MS = 1000 * 60 * 60 * 24;

export const GanttChart: React.FC<GanttChartProps> = ({ tarefas, onSelectTarefa }) => {
  const dataset = useMemo(() => {
    const items = (tarefas ?? [])
      .filter(t => t.data_inicio || t.prazo)
      .map(t => {
        const inicio = t.data_inicio ? new Date(t.data_inicio) : (t.prazo ? new Date(t.prazo) : new Date());
        const fim = t.data_fim ? new Date(t.data_fim) : (t.prazo ? new Date(t.prazo) : new Date(inicio.getTime() + DAY_MS));
        return { t, inicio, fim: fim.getTime() < inicio.getTime() ? new Date(inicio.getTime() + DAY_MS) : fim };
      });
    if (items.length === 0) return null;
    const min = Math.min(...items.map(i => i.inicio.getTime()));
    const max = Math.max(...items.map(i => i.fim.getTime()));
    const totalDays = Math.max(1, Math.ceil((max - min) / DAY_MS));
    return { items, min, max, totalDays };
  }, [tarefas]);

  if (!dataset) {
    return <EmptyState title="Sem tarefas com datas" description="Defina datas de início/fim nas tarefas para visualizar no Gantt." />;
  }

  const { items, min, totalDays } = dataset;
  const rowH = 36;
  const colW = Math.max(28, Math.min(64, Math.floor(900 / totalDays)));
  const width = colW * totalDays + 240;
  const height = rowH * items.length + 48;

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto">
      <svg width={width} height={height} className="block">
        {/* header dias */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const date = new Date(min + i * DAY_MS);
          const isWeekend = [0, 6].includes(date.getDay());
          return (
            <g key={i}>
              <rect x={240 + i * colW} y={0} width={colW} height={height} fill={isWeekend ? 'hsl(var(--muted) / 0.4)' : 'transparent'} />
              <text x={240 + i * colW + 4} y={16} fontSize="10" fill="hsl(var(--muted-foreground))">
                {date.getDate()}/{date.getMonth() + 1}
              </text>
            </g>
          );
        })}
        {/* linhas */}
        {items.map((it, idx) => {
          const y = 32 + idx * rowH;
          const startCol = Math.floor((it.inicio.getTime() - min) / DAY_MS);
          const durDays = Math.max(1, Math.ceil((it.fim.getTime() - it.inicio.getTime()) / DAY_MS));
          const barX = 240 + startCol * colW;
          const barW = durDays * colW - 4;
          const cor = prioridadeColor[it.t.prioridade];
          const progresso = Math.max(0, Math.min(100, it.t.progresso_pct ?? 0));
          return (
            <g key={it.t.id} className="cursor-pointer" onClick={() => onSelectTarefa?.(it.t)}>
              <text x={8} y={y + 22} fontSize="12" fill="hsl(var(--foreground))" className="truncate">
                {it.t.titulo.length > 30 ? it.t.titulo.slice(0, 30) + '…' : it.t.titulo}
              </text>
              <rect x={barX} y={y + 8} width={barW} height={20} rx={4} fill={cor} fillOpacity={0.25} stroke={cor} />
              <rect x={barX} y={y + 8} width={(barW * progresso) / 100} height={20} rx={4} fill={cor} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
