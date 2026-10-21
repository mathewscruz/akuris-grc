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
import { formatDateOnly } from '@/lib/date-utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { isMarco, estaAtrasada } from '@/lib/projeto-acompanhamento';
import { statusKindDe, type StatusKind } from './StatusPill';
import { partirTitulo, mapaFilhos, CodeChip, UserAvatar } from './projeto-visual';
import { IconChecklist } from '@/components/icons';

const KIND_BAR: Record<StatusKind, string> = {
  rest: 'bg-muted-foreground/40', active: 'bg-state-active', done: 'bg-state-done', late: 'bg-destructive',
};
const KIND_CHIP: Record<StatusKind, string> = {
  rest: 'bg-muted text-muted-foreground', active: 'bg-state-active-surface text-state-active',
  done: 'bg-state-done-surface text-state-done', late: 'bg-destructive/10 text-destructive',
};

type Ctx = { filhos: Map<string, ProjetoTarefa[]>; porId: Map<string, ProjetoTarefa>; usuarios: { user_id: string; nome: string | null; foto_url?: string | null }[] };
const KanbanCtx = React.createContext<Ctx>({ filhos: new Map(), porId: new Map(), usuarios: [] });

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

  const { data: usuarios = [] } = useUsuariosEmpresa();
  const filhos = React.useMemo(() => mapaFilhos(tarefas), [tarefas]);
  const porId = React.useMemo(() => new Map(tarefas.map((x) => [x.id, x])), [tarefas]);
  const fases = React.useMemo(() => tarefas.filter((x) => !x.parent_task_id && filhos.has(x.id)), [tarefas, filhos]);
  const [fase, setFase] = React.useState('todas');
  const faseRaiz = React.useCallback((x: ProjetoTarefa) => { let c = x; let n = 0; while (c.parent_task_id && porId.has(c.parent_task_id) && n++ < 8) c = porId.get(c.parent_task_id)!; return c.id; }, [porId]);
  // O quadro mostra o trabalho a fazer: fases e domínios (agrupadores) ficam como filtro.
  const visiveis = React.useMemo(() => tarefas.filter((x) => !filhos.has(x.id) && (fase === 'todas' || faseRaiz(x) === fase)), [tarefas, filhos, fase, faseRaiz]);
  const ctx = React.useMemo(() => ({ filhos, porId, usuarios }), [filhos, porId, usuarios]);

  const tarefasPorColuna = React.useMemo(() => {
    const m: Record<string, ProjetoTarefa[]> = {};
    colunas.forEach((c) => (m[c.id] = []));
    visiveis.forEach((t) => {
      if (t.coluna_id && m[t.coluna_id]) m[t.coluna_id].push(t);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.ordem - b.ordem));
    return m;
  }, [colunas, visiveis]);

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
    <KanbanCtx.Provider value={ctx}>
    {fases.length > 0 && (
      <div className="mb-3 flex items-center gap-2">
        <Select value={fase} onValueChange={setFase}>
          <SelectTrigger className="h-9 w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t('p3Projetos.kanban.todasFases')}</SelectItem>
            {fases.map((f) => { const p = partirTitulo(f.titulo); return <SelectItem key={f.id} value={f.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.nome}</SelectItem>; })}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{t('p3Projetos.kanban.soAtividades')}</span>
      </div>
    )}
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
    </KanbanCtx.Provider>
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
    <div ref={setNodeRef} className={`relative flex-1 min-w-[17rem] max-w-[26rem] overflow-hidden rounded-lg border border-border bg-muted/30 p-3 pt-4 transition-ui ${highlight ? 'border-primary ring-2 ring-primary bg-primary/5' : ''}`}>
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${KIND_BAR[statusKindDe(coluna)]}`} />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${KIND_CHIP[statusKindDe(coluna)]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${KIND_BAR[statusKindDe(coluna)]}`} />{coluna.nome}
          </span>
          <span className="rounded-full bg-background px-2 text-xs font-semibold tabular-nums text-muted-foreground">{tarefas.length}</span>
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
  const { filhos, porId, usuarios } = React.useContext(KanbanCtx);
  const atrasada = estaAtrasada(tarefa);
  const { codigo, nome } = partirTitulo(tarefa.titulo);
  const pai = tarefa.parent_task_id ? porId.get(tarefa.parent_task_id) : undefined;
  const avo = pai?.parent_task_id ? porId.get(pai.parent_task_id) : undefined;
  const contexto = [avo, pai].filter(Boolean).map((x) => partirTitulo(x!.titulo).codigo ?? partirTitulo(x!.titulo).nome).join(' › ');
  const resp = usuarios.find((u) => u.user_id === tarefa.responsavel_id);
  const subs = filhos.get(tarefa.id) ?? [];
  const pct = Math.max(0, Math.min(100, tarefa.concluida_em ? 100 : tarefa.progresso_pct ?? 0));
  const fim = tarefa.data_fim ?? tarefa.prazo;
  return (
    <Card data-dragging={dragging || undefined} className={`akuris-kanban-card p-3 space-y-2.5 cursor-pointer hover:border-primary/40 ${dragging ? 'shadow-elegant' : ''}`}>
      {contexto && <p className="truncate text-[11px] text-muted-foreground">{contexto}</p>}
      <div className="flex items-start gap-2">
        {codigo && <CodeChip codigo={codigo} nivel="atividade" className="mt-0.5" />}
        {isMarco(tarefa) && <span className="mt-0.5 text-[hsl(var(--fw-gold))]" title={t('p3Projetos.lista.milestone')}>◆</span>}
        <p className="text-sm font-medium leading-snug line-clamp-2">{nome}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className={pct >= 100 ? 'h-full bg-success' : 'h-full bg-primary'} style={{ width: `${pct}%` }} /></div>
        <span className="text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <StatusBadge tone={prioridadeTone[tarefa.prioridade]}>{getPrioridadeLabel(t, tarefa.prioridade)}</StatusBadge>
        {fim && (
          <span className={`inline-flex items-center gap-1 tabular-nums ${atrasada ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
            <IconCalendar className="h-3 w-3" />{formatDateOnly(fim)}
          </span>
        )}
        {subs.length > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground"><IconChecklist className="h-3 w-3" />{subs.filter((x) => x.concluida_em).length}/{subs.length}</span>
        )}
        <span className="ml-auto">
          {resp ? <UserAvatar nome={resp.nome ?? '?'} foto={resp.foto_url} size={22} />
            : tarefa.responsavel_id ? <IconPerson className="h-4 w-4 text-muted-foreground" /> : null}
        </span>
      </div>
    </Card>
  );
}
