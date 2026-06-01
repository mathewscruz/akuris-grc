import React from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus, Calendar, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjetoColuna, ProjetoTarefa, ProjetoTarefaPrioridade } from '@/types/projetos';
import { useMoveTarefa } from '@/hooks/useProjetoTarefas';

const prioridadeTone: Record<ProjetoTarefaPrioridade, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  critica: 'destructive',
  alta: 'warning',
  media: 'info',
  baixa: 'neutral',
};

interface Props {
  projetoId: string;
  colunas: ProjetoColuna[];
  tarefas: ProjetoTarefa[];
  onAddTarefa: (colunaId: string) => void;
  onEditTarefa: (tarefa: ProjetoTarefa) => void;
}

export function KanbanBoard({ projetoId, colunas, tarefas, onAddTarefa, onEditTarefa }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const move = useMoveTarefa(projetoId);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const tarefasPorColuna = React.useMemo(() => {
    const m: Record<string, ProjetoTarefa[]> = {};
    colunas.forEach((c) => (m[c.id] = []));
    tarefas.forEach((t) => {
      if (t.coluna_id && m[t.coluna_id]) m[t.coluna_id].push(t);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.ordem - b.ordem));
    return m;
  }, [colunas, tarefas]);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const tarefaId = e.active.id as string;
    const colunaDestino = e.over?.id as string | undefined;
    if (!colunaDestino) return;
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa || tarefa.coluna_id === colunaDestino) return;
    const novosNaColuna = tarefasPorColuna[colunaDestino] ?? [];
    const novaOrdem = novosNaColuna.length;
    move.mutate({ tarefaId, colunaId: colunaDestino, ordem: novaOrdem });
  };

  const activeTarefa = tarefas.find((t) => t.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {colunas.map((col) => (
          <ColumnDroppable
            key={col.id}
            coluna={col}
            tarefas={tarefasPorColuna[col.id] ?? []}
            onAdd={() => onAddTarefa(col.id)}
            onEdit={onEditTarefa}
          />
        ))}
      </div>
      <DragOverlay>{activeTarefa ? <TaskCard tarefa={activeTarefa} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function ColumnDroppable({ coluna, tarefas, onAdd, onEdit }: { coluna: ProjetoColuna; tarefas: ProjetoTarefa[]; onAdd: () => void; onEdit: (t: ProjetoTarefa) => void; }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  return (
    <div ref={setNodeRef} className={`flex-shrink-0 w-72 rounded-lg border border-border bg-muted/30 p-3 transition-colors ${isOver ? 'border-primary bg-primary/5' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: coluna.cor ?? '#64748b' }} />
          <h3 className="text-sm font-semibold">{coluna.nome}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">({tarefas.length})</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {tarefas.map((t) => (
          <DraggableTask key={t.id} tarefa={t} onClick={() => onEdit(t)} />
        ))}
      </div>
    </div>
  );
}

function DraggableTask({ tarefa, onClick }: { tarefa: ProjetoTarefa; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: tarefa.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={isDragging ? 'opacity-30' : ''} onClick={onClick}>
      <TaskCard tarefa={tarefa} />
    </div>
  );
}

function TaskCard({ tarefa, dragging }: { tarefa: ProjetoTarefa; dragging?: boolean }) {
  const atrasada = tarefa.prazo && !tarefa.concluida_em && new Date(tarefa.prazo) < new Date();
  return (
    <Card className={`p-3 cursor-pointer hover:border-primary/40 transition-colors ${dragging ? 'shadow-elegant rotate-2' : ''}`}>
      <p className="text-sm font-medium mb-2 line-clamp-2">{tarefa.titulo}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge tone={prioridadeTone[tarefa.prioridade]} size="sm">
          {tarefa.prioridade}
        </StatusBadge>
        {tarefa.prazo && (
          <Badge variant={atrasada ? 'destructive' : 'outline'} size="sm" icon={<Calendar className="h-2.5 w-2.5" />}>
            {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}
          </Badge>
        )}
        {tarefa.responsavel_id && (
          <Badge variant="soft" size="sm" icon={<UserIcon className="h-2.5 w-2.5" />}>
            atribuída
          </Badge>
        )}
      </div>
    </Card>
  );
}
