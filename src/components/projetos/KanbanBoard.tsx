import React from 'react';
import { IconAdd, IconCalendar, IconPerson } from '@/components/icons';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor, pointerWithin, rectIntersection, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProjetoColuna, ProjetoTarefa, ProjetoTarefaPrioridade } from '@/types/projetos';
import { useMoveTarefa, useUpsertTarefa } from '@/hooks/useProjetoTarefas';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPrioridadeLabel } from './enum-labels';
import { formatDateOnly, parseDataLocal } from '@/lib/date-utils';

/**
 * Colisão por ponteiro: a coluna de destino é a que está debaixo do cursor.
 * Sem isto o dnd-kit usa o rect do cartão arrastado e cai uma coluna a mais
 * no sentido do movimento.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

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
  const { t } = useLanguage();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const move = useMoveTarefa(projetoId);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

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
    setOverId(null);
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
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragOver={(e) => setOverId(e.over ? String(e.over.id) : null)}
      onDragCancel={() => { setActiveId(null); setOverId(null); }}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {colunas.map((col) => (
          <ColumnDroppable
            key={col.id}
            projetoId={projetoId}
            coluna={col}
            tarefas={tarefasPorColuna[col.id] ?? []}
            onAdd={() => onAddTarefa(col.id)}
            onEdit={onEditTarefa}
            highlight={overId === col.id && activeId !== null}
            t={t}
          />
        ))}
      </div>
      <DragOverlay>{activeTarefa ? <TaskCard tarefa={activeTarefa} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function ColumnDroppable({ projetoId, coluna, tarefas, onAdd, onEdit, highlight, t }: { projetoId: string; coluna: ProjetoColuna; tarefas: ProjetoTarefa[]; onAdd: () => void; onEdit: (t: ProjetoTarefa) => void; highlight?: boolean; t: (key: string, params?: Record<string, string | number>) => string; }) {
  const { setNodeRef } = useDroppable({ id: coluna.id });
  const [quickValue, setQuickValue] = React.useState('');
  const [quickOpen, setQuickOpen] = React.useState(false);
  const upsert = useUpsertTarefa();

  const submitQuick = async () => {
    const titulo = quickValue.trim();
    if (titulo.length < 2) return;
    await upsert.mutateAsync({
      projeto_id: projetoId,
      coluna_id: coluna.id,
      titulo,
      prioridade: 'media',
    });
    setQuickValue('');
  };

  return (
    /*
      As colunas esticam para ocupar o quadro.

      Eram `w-72` fixos com `flex-shrink-0`: num monitor largo, quatro colunas
      de 288px deixavam mais de metade do quadro vazio a direita, e as tarefas
      espremidas numa coluna estreita ao lado de todo esse espaco por usar.

      `flex-1` com piso e tecto: com poucas colunas crescem ate 26rem -- passar
      disso torna o cartao de tarefa uma linha larga e dificil de ler -- e com
      muitas param nos 17rem e o `overflow-x-auto` do pai trata do resto.
    */
    <div ref={setNodeRef} className={`flex-1 min-w-[17rem] max-w-[26rem] rounded-lg border border-border bg-muted/30 p-3 transition-ui ${highlight ? 'border-primary ring-2 ring-primary bg-primary/5' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: coluna.cor ?? '#64748b' }} />
          <h3 className="text-sm font-semibold">{coluna.nome}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">({tarefas.length})</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd} aria-label={t('projetos.kanban.addTaskDetailed')} title={t('projetos.kanban.addTaskDetailed')}>
          <IconAdd className="h-4 w-4" />
        </Button>
      </div>
      {/* O corpo cresce com o ecra: 100px deixava o quadro atarracado,
          com mais moldura do que conteudo. */}
      <div className="space-y-2 min-h-[min(48vh,420px)]">
        {tarefas.map((tt) => (
          <DraggableTask key={tt.id} tarefa={tt} onClick={() => onEdit(tt)} />
        ))}
      </div>

      {quickOpen ? (
        <div className="mt-2 space-y-2">
          <Input
            autoFocus
            value={quickValue}
            onChange={(e) => setQuickValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submitQuick(); }
              if (e.key === 'Escape') { setQuickOpen(false); setQuickValue(''); }
            }}
            placeholder={t('projetos.kanban.quickPlaceholder')}
            className="h-8 text-sm"
          />
          <div className="flex gap-1">
            <Button size="sm" className="flex-1 h-7" onClick={submitQuick} disabled={upsert.isPending}>{t('projetos.kanban.add')}</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setQuickOpen(false); setQuickValue(''); }}>{t('projetos.kanban.cancel')}</Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full h-7 justify-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setQuickOpen(true)}
        >
          <IconAdd className="h-3 w-3" /> {t('projetos.kanban.addTask')}
        </Button>
      )}
    </div>
  );
}

function DraggableTask({ tarefa, onClick }: { tarefa: ProjetoTarefa; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: tarefa.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-dragging={isDragging || undefined}
      className={`akuris-kanban-card ${isDragging ? 'opacity-30' : ''}`}
      onClick={onClick}
    >
      <TaskCard tarefa={tarefa} />
    </div>
  );
}

function TaskCard({ tarefa, dragging }: { tarefa: ProjetoTarefa; dragging?: boolean }) {
  const { t } = useLanguage();
  const atrasada = tarefa.prazo && !tarefa.concluida_em && parseDataLocal(tarefa.prazo) < new Date();
  return (
    <Card data-dragging={dragging || undefined} className={`akuris-kanban-card p-3 cursor-pointer hover:border-primary/40 ${dragging ? 'shadow-elegant' : ''}`}>
      <p className="text-sm font-medium mb-2 line-clamp-2">{tarefa.titulo}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge tone={prioridadeTone[tarefa.prioridade]}>
          {getPrioridadeLabel(t, tarefa.prioridade)}
        </StatusBadge>
        {tarefa.prazo && (
          <StatusBadge tone={atrasada ? 'destructive' : 'neutral'} variant={atrasada ? 'soft' : 'outline'} icon={<IconCalendar className="h-2.5 w-2.5" />}>
            {formatDateOnly(tarefa.prazo)}
          </StatusBadge>
        )}
        {tarefa.responsavel_id && (
          <StatusBadge tone="info" icon={<IconPerson className="h-2.5 w-2.5" />}>
            {t('projetos.kanban.assigned')}
          </StatusBadge>
        )}
      </div>
    </Card>
  );
}
