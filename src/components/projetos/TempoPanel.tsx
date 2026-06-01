import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Play, Pause, Plus, Trash2, Timer } from 'lucide-react';
import { useTempoEntradas, useAddTempo, useDeleteTempo } from '@/hooks/useProjetoExtras';
import { useAuth } from '@/components/AuthProvider';

const STORAGE_KEY = 'akuris.tarefa.timer';

export function TempoPanel({ tarefaId, estimativa, gasto }: { tarefaId: string; estimativa?: number | null; gasto?: number | null }) {
  const { data: entradas = [] } = useTempoEntradas(tarefaId);
  const add = useAddTempo(tarefaId);
  const del = useDeleteTempo(tarefaId);
  const { user } = useAuth();

  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [descTimer, setDescTimer] = React.useState('');
  const [novoH, setNovoH] = React.useState('');
  const [novoDesc, setNovoDesc] = React.useState('');

  // hidrata timer do localStorage por tarefa
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}.${tarefaId}`);
      if (raw) {
        const { startedAt: s } = JSON.parse(raw);
        if (typeof s === 'number') setStartedAt(s);
      }
    } catch {}
  }, [tarefaId]);

  React.useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const start = () => {
    const now = Date.now();
    setStartedAt(now);
    localStorage.setItem(`${STORAGE_KEY}.${tarefaId}`, JSON.stringify({ startedAt: now }));
  };

  const stopAndSave = async () => {
    if (!startedAt) return;
    const horas = Math.max(0.01, (Date.now() - startedAt) / 3600000);
    await add.mutateAsync({ horas: Math.round(horas * 100) / 100, descricao: descTimer || undefined });
    setStartedAt(null);
    setElapsed(0);
    setDescTimer('');
    localStorage.removeItem(`${STORAGE_KEY}.${tarefaId}`);
  };

  const addManual = async () => {
    const h = parseFloat(novoH);
    if (!h || h <= 0) return;
    await add.mutateAsync({ horas: h, descricao: novoDesc || undefined });
    setNovoH(''); setNovoDesc('');
  };

  const totalUser = entradas.filter((e) => e.user_id === user?.id).reduce((s, e) => s + Number(e.horas), 0);
  const fmtTimer = (ms: number) => {
    const tot = Math.floor(ms / 1000);
    const h = Math.floor(tot / 3600).toString().padStart(2, '0');
    const m = Math.floor((tot % 3600) / 60).toString().padStart(2, '0');
    const s = (tot % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <span className="text-sm font-semibold">Cronômetro</span>
          </div>
          {startedAt && <StatusBadge tone="info" size="sm">{fmtTimer(elapsed)}</StatusBadge>}
        </div>
        <div className="flex gap-2 items-start">
          <Input
            placeholder="O que você está fazendo? (opcional)"
            value={descTimer}
            onChange={(e) => setDescTimer(e.target.value)}
            className="h-9"
            disabled={!!startedAt && false}
          />
          {startedAt ? (
            <Button size="sm" variant="destructive" onClick={stopAndSave} disabled={add.isPending}>
              <Pause className="h-4 w-4" /> Parar e salvar
            </Button>
          ) : (
            <Button size="sm" onClick={start}>
              <Play className="h-4 w-4" /> Iniciar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Estimativa" value={estimativa ? `${estimativa}h` : '—'} />
        <Stat label="Gasto total" value={gasto ? `${Number(gasto).toFixed(1)}h` : '0h'} />
        <Stat label="Você lançou" value={`${totalUser.toFixed(1)}h`} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">Lançar tempo manual</div>
        <div className="flex gap-2">
          <div className="w-24">
            <Label className="text-xs">Horas</Label>
            <Input type="number" step="0.25" min="0.01" value={novoH} onChange={(e) => setNovoH(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Descrição</Label>
            <Input value={novoDesc} onChange={(e) => setNovoDesc(e.target.value)} placeholder="Atividade realizada" />
          </div>
          <div className="self-end">
            <Button size="sm" onClick={addManual} disabled={add.isPending}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</div>
        {entradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Nenhum tempo registrado.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {entradas.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm group">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{Number(e.horas).toFixed(2)}h <span className="text-muted-foreground font-normal">· {new Date(e.data).toLocaleDateString('pt-BR')}</span></div>
                  {e.descricao && <div className="text-xs text-muted-foreground truncate">{e.descricao}</div>}
                </div>
                {e.user_id === user?.id && (
                  <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => del.mutate(e.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
