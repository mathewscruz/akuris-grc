import React from 'react';
import { Button } from '@/components/ui/button';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Pencil, Trash2, Play, CheckCircle2, Flag } from 'lucide-react';
import { useSprints, useUpsertSprint, useDeleteSprint, type ProjetoSprint } from '@/hooks/useProjetoExtras';
import type { ProjetoTarefa } from '@/types/projetos';

interface Props {
  projetoId: string;
  tarefas: ProjetoTarefa[];
  onSelectTarefa: (t: ProjetoTarefa) => void;
}

export function SprintsPanel({ projetoId, tarefas, onSelectTarefa }: Props) {
  const { data: sprints = [], isLoading } = useSprints(projetoId);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjetoSprint | null>(null);
  const [sprintAtiva, setSprintAtiva] = React.useState<string>('todas');

  const ativa = sprints.find((s) => s.id === sprintAtiva);
  const tarefasSprint = sprintAtiva === 'todas'
    ? tarefas.filter((t) => t.sprint_id != null)
    : tarefas.filter((t) => t.sprint_id === sprintAtiva);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={sprintAtiva} onValueChange={setSprintAtiva}>
          <SelectTrigger className="h-9 w-[260px]"><SelectValue placeholder="Selecione uma sprint" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as sprints</SelectItem>
            {sprints.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome} {s.ativa ? '· ativa' : s.concluida ? '· concluída' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nova sprint
        </Button>
        {ativa && (
          <Button size="sm" variant="outline" onClick={() => { setEditing(ativa); setOpen(true); }}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        )}
      </div>

      {isLoading ? null : sprints.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<Flag className="h-8 w-8" />}
          title="Nenhuma sprint criada"
          description="Crie iterações para organizar entregas no estilo ágil leve (1 a 4 semanas)."
          action={{ label: 'Criar primeira sprint', onClick: () => { setEditing(null); setOpen(true); } }}
        />
      ) : (
        <>
          {ativa && <SprintCabecalho sprint={ativa} tarefas={tarefasSprint} />}
          <Burndown sprint={ativa} tarefas={tarefasSprint} />
          <ListaTarefasSprint tarefas={tarefasSprint} onSelect={onSelectTarefa} />
        </>
      )}

      <SprintDialog open={open} onOpenChange={setOpen} projetoId={projetoId} sprint={editing} />
    </div>
  );
}

function SprintCabecalho({ sprint, tarefas }: { sprint: ProjetoSprint; tarefas: ProjetoTarefa[] }) {
  const conc = tarefas.filter((t) => t.concluida_em).length;
  const pct = tarefas.length === 0 ? 0 : Math.round((conc / tarefas.length) * 100);
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Sprint</div>
          <h3 className="text-lg font-semibold">{sprint.nome}</h3>
          {sprint.objetivo && <p className="text-sm text-muted-foreground">{sprint.objetivo}</p>}
        </div>
        <div className="flex gap-2 items-center">
          {sprint.ativa && <StatusBadge tone="success" size="sm">Ativa</StatusBadge>}
          {sprint.concluida && <StatusBadge tone="info" size="sm">Concluída</StatusBadge>}
          <span className="text-xs text-muted-foreground">
            {new Date(sprint.data_inicio).toLocaleDateString('pt-BR')} → {new Date(sprint.data_fim).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{conc}/{tarefas.length} · {pct}%</span>
      </div>
    </div>
  );
}

function Burndown({ sprint, tarefas }: { sprint?: ProjetoSprint; tarefas: ProjetoTarefa[] }) {
  if (!sprint || tarefas.length === 0) return null;

  const total = tarefas.length;
  const start = new Date(sprint.data_inicio).getTime();
  const end = new Date(sprint.data_fim).getTime();
  const dias = Math.max(1, Math.round((end - start) / 86400000) + 1);

  // série ideal: linha linear de total -> 0
  const idealPts: { x: number; y: number }[] = [];
  for (let i = 0; i <= dias; i++) idealPts.push({ x: i, y: total * (1 - i / dias) });

  // série real: a cada dia, qtd não concluída
  const realPts: { x: number; y: number }[] = [];
  for (let i = 0; i <= dias; i++) {
    const cutoff = start + i * 86400000;
    const restantes = tarefas.filter((t) => !t.concluida_em || new Date(t.concluida_em).getTime() > cutoff).length;
    realPts.push({ x: i, y: restantes });
  }

  const W = 600, H = 180, PAD = 28;
  const sx = (x: number) => PAD + (x / dias) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - (y / Math.max(1, total)) * (H - 2 * PAD);
  const toPath = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Burndown</div>
        <div className="text-xs text-muted-foreground flex gap-3">
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-muted-foreground" />Ideal</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-primary" />Real</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Burndown da sprint">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="hsl(var(--border))" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="hsl(var(--border))" />
        <path d={toPath(idealPts)} fill="none" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
        <path d={toPath(realPts)} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        <text x={PAD} y={PAD - 6} fontSize="10" fill="hsl(var(--muted-foreground))">{total}</text>
        <text x={PAD} y={H - PAD + 14} fontSize="10" fill="hsl(var(--muted-foreground))">0</text>
        <text x={W - PAD} y={H - PAD + 14} fontSize="10" textAnchor="end" fill="hsl(var(--muted-foreground))">{dias}d</text>
      </svg>
    </div>
  );
}

function ListaTarefasSprint({ tarefas, onSelect }: { tarefas: ProjetoTarefa[]; onSelect: (t: ProjetoTarefa) => void }) {
  if (tarefas.length === 0) {
    return <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma tarefa nesta sprint. Use a edição da tarefa para atribuí-la à sprint.</p>;
  }
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      {tarefas.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="w-full text-left px-3 py-2 hover:bg-muted/40 flex items-center gap-2"
        >
          {t.concluida_em
            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            : <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />}
          <span className={`flex-1 text-sm ${t.concluida_em ? 'line-through text-muted-foreground' : ''}`}>{t.titulo}</span>
          <span className="text-xs text-muted-foreground">{t.prioridade}</span>
        </button>
      ))}
    </div>
  );
}

function SprintDialog({ open, onOpenChange, projetoId, sprint }: { open: boolean; onOpenChange: (v: boolean) => void; projetoId: string; sprint: ProjetoSprint | null }) {
  const upsert = useUpsertSprint(projetoId);
  const del = useDeleteSprint(projetoId);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [form, setForm] = React.useState({ nome: '', objetivo: '', data_inicio: '', data_fim: '', ativa: false, concluida: false });
  React.useEffect(() => {
    if (open) {
      setForm({
        nome: sprint?.nome ?? '',
        objetivo: sprint?.objetivo ?? '',
        data_inicio: sprint?.data_inicio ?? new Date().toISOString().slice(0, 10),
        data_fim: sprint?.data_fim ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        ativa: sprint?.ativa ?? !sprint,
        concluida: sprint?.concluida ?? false,
      });
    }
  }, [open, sprint]);

  const submit = async () => {
    if (!form.nome.trim()) return;
    await upsert.mutateAsync({ id: sprint?.id, ...form });
    onOpenChange(false);
  };

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Flag}
      title={sprint ? 'Editar sprint' : 'Nova sprint'}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          {sprint && (
            <Button variant="destructive" size="sm" className="mr-auto" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={upsert.isPending}>Salvar</Button>
        </div>
      }
    >
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Objetivo</Label><Textarea rows={2} value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
            <div><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} /> Ativa</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.concluida} onChange={(e) => setForm({ ...form, concluida: e.target.checked })} /> Concluída</label>
          </div>
        </div>
    </DialogShell>

    <ConfirmDialog
      open={deleteConfirm}
      onOpenChange={setDeleteConfirm}
      title="Excluir Sprint"
      description="Tem certeza que deseja remover esta sprint? Esta ação não pode ser desfeita."
      confirmText="Excluir"
      cancelText="Cancelar"
      variant="destructive"
      onConfirm={async () => { if (sprint) { await del.mutateAsync(sprint.id); setDeleteConfirm(false); onOpenChange(false); } }}
      loading={del.isPending}
    />
    </>
  );
}
