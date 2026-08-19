/**
 * PlanosAcaoKanban — quadro com arrastar e largar real (dnd-kit).
 * Colisão por ponteiro (pointerWithin) para que a coluna de destino seja
 * sempre a que está debaixo do cursor no momento de largar.
 */
import React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDateOnly } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconMore, IconExternal, IconDrag } from '@/components/icons';

export const PLANO_STATUS_EDITAVEIS = ['pendente', 'em_andamento', 'concluido', 'cancelado'] as const;

interface Cfg {
  statusConfig: Record<string, { label: string; tone: any; icon: any }>;
  prioridadeConfig: Record<string, { label: string; tone: any; mark: string }>;
  moduloLabels: Record<string, string>;
}

interface Props extends Cfg {
  colunas: string[];
  items: any[];
  onOpen: (item: any) => void;
  onStatusChange: (item: any, novoStatus: string) => void;
}

/** Ponteiro primeiro; só cai para interseção de rects se o cursor estiver fora de tudo. */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

export function PlanosAcaoKanban({
  colunas,
  items,
  onOpen,
  onStatusChange,
  statusConfig,
  prioridadeConfig,
  moduloLabels,
}: Props) {
  const { t } = useLanguage();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  const activeItem = items.find((i) => i.id === activeId) || null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    const item = items.find((i) => i.id === String(e.active.id));
    const destino = e.over ? String(e.over.id) : null;
    setActiveId(null);
    setOverId(null);
    if (!item || !destino) return;
    if (!(PLANO_STATUS_EDITAVEIS as readonly string[]).includes(destino)) return;
    if (item.status === destino) return;
    onStatusChange(item, destino);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={(e) => setOverId(e.over ? String(e.over.id) : null)}
      onDragCancel={() => { setActiveId(null); setOverId(null); }}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 select-none">
        {colunas.map((colStatus) => (
          <KanbanColumn
            key={colStatus}
            status={colStatus}
            cfg={statusConfig[colStatus]}
            items={items.filter((p: any) => p._displayStatus === colStatus)}
            highlight={overId === colStatus && activeId !== null}
            dragging={activeId !== null}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
            statusConfig={statusConfig}
            prioridadeConfig={prioridadeConfig}
            moduloLabels={moduloLabels}
            t={t}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <PlanoCard
            item={activeItem}
            overlay
            prioridadeConfig={prioridadeConfig}
            moduloLabels={moduloLabels}
            statusConfig={statusConfig}
            onOpen={() => {}}
            onStatusChange={() => {}}
            t={t}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  cfg,
  items,
  highlight,
  dragging,
  onOpen,
  onStatusChange,
  statusConfig,
  prioridadeConfig,
  moduloLabels,
  t,
}: Cfg & {
  status: string;
  cfg: { label: string; tone: any };
  items: any[];
  highlight: boolean;
  dragging: boolean;
  onOpen: (i: any) => void;
  onStatusChange: (i: any, s: string) => void;
  t: (k: string) => string;
}) {
  const droppable = (PLANO_STATUS_EDITAVEIS as readonly string[]).includes(status);
  const { setNodeRef } = useDroppable({ id: status, disabled: !droppable });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-2">
        <StatusBadge tone={cfg?.tone}>{cfg?.label}</StatusBadge>
        <span className="text-sm text-muted-foreground tabular-nums">({items.length})</span>
      </div>
      <div
        ref={setNodeRef}
        className={[
          'space-y-2 min-h-[200px] rounded-lg p-1.5 transition-ui',
          highlight ? 'ring-2 ring-primary bg-primary/5' : 'ring-1 ring-transparent',
          dragging && !droppable ? 'opacity-60' : '',
        ].join(' ')}
        aria-dropeffect={droppable ? 'move' : 'none'}
      >
        {items.map((item: any) => (
          <PlanoCard
            key={`${item.modulo_origem || 'plano'}-${item.id}`}
            item={item}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
            statusConfig={statusConfig}
            prioridadeConfig={prioridadeConfig}
            moduloLabels={moduloLabels}
            t={t}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-8 border-2 border-dashed rounded-lg">
            {dragging && droppable ? t('planosAcao.kanbanDropHere') : t('planosAcao.noItems')}
          </div>
        )}
      </div>
      {!droppable && dragging && (
        <p className="px-2 text-micro text-muted-foreground">{t('planosAcao.kanbanDerivedColumn')}</p>
      )}
    </div>
  );
}

function PlanoCard({
  item,
  overlay,
  onOpen,
  onStatusChange,
  statusConfig,
  prioridadeConfig,
  moduloLabels,
  t,
}: Cfg & {
  item: any;
  overlay?: boolean;
  onOpen: (i: any) => void;
  onStatusChange: (i: any, s: string) => void;
  t: (k: string) => string;
}) {
  const draggableEnabled = !overlay && !item._isExternal;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !draggableEnabled,
  });

  return (
    <div ref={overlay ? undefined : setNodeRef} className={isDragging ? 'opacity-30' : ''}>
      <Card
        data-focus-id={item.id}
        className={[
          'p-3 transition-shadow group',
          overlay ? 'shadow-elegant rotate-1 cursor-grabbing' : 'hover:shadow-sm',
        ].join(' ')}
      >
        <div className="flex items-start gap-1.5">
          {draggableEnabled && (
            <button
              type="button"
              className="mt-0.5 -ml-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
              aria-label={t('planosAcao.kanbanDragHandle')}
              {...attributes}
              {...listeners}
            >
              <IconDrag className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            className="flex-1 min-w-0 text-left"
            onClick={() => onOpen(item)}
          >
            <p className="font-medium text-sm">{item.titulo}</p>
          </button>
          {!overlay && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  <IconMore className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => onOpen(item)}>
                  <IconExternal className="h-4 w-4 mr-2" />
                  {t('planosAcao.actionOpenDetail')}
                </DropdownMenuItem>
                {!item._isExternal &&
                  PLANO_STATUS_EDITAVEIS.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => onStatusChange(item, s)}
                      className={item.status === s ? 'font-semibold' : ''}
                    >
                      {t('planosAcao.quickStatusPrefix')}: {statusConfig[s]?.label}
                      {item.status === s && <span className="ml-auto text-primary">✓</span>}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusBadge
            tone={prioridadeConfig[item.prioridade]?.tone || 'neutral'}
            mark={prioridadeConfig[item.prioridade]?.mark}
          >
            {prioridadeConfig[item.prioridade]?.label || item.prioridade}
          </StatusBadge>
          <Chip family="category">
            {moduloLabels[item.modulo_origem] || item.modulo_origem || 'Manual'}
          </Chip>
        </div>
        {item.prazo && (
          <p className={`text-xs mt-2 ${item._displayStatus === 'atrasado' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {t('planosAcao.deadlinePrefix')}: {formatDateOnly(item.prazo)}
          </p>
        )}
        {item.profiles?.nome && (
          <p className="text-xs text-muted-foreground mt-1">{item.profiles.nome}</p>
        )}
      </Card>
    </div>
  );
}
