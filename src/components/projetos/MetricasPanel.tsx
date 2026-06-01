import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import type { ProjetoTarefa, ProjetoColuna } from '@/types/projetos';

export function MetricasPanel({ tarefas, colunas }: { tarefas: ProjetoTarefa[]; colunas: ProjetoColuna[] }) {
  const m = React.useMemo(() => {
    const total = tarefas.length;
    const concluidas = tarefas.filter((t) => t.concluida_em);
    const abertas = total - concluidas.length;
    const atrasadas = tarefas.filter((t) => !t.concluida_em && t.prazo && new Date(t.prazo) < new Date()).length;
    const slaViolado = (tarefas as any[]).filter((t) => t.sla_status === 'violado').length;
    const slaRisco = (tarefas as any[]).filter((t) => t.sla_status === 'em_risco').length;

    // Velocity últimas 4 semanas
    const semanas: { label: string; concluidas: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const ini = new Date(); ini.setDate(ini.getDate() - (i + 1) * 7); ini.setHours(0, 0, 0, 0);
      const fim = new Date(ini); fim.setDate(fim.getDate() + 7);
      const c = concluidas.filter((t) => {
        const d = new Date(t.concluida_em!);
        return d >= ini && d < fim;
      }).length;
      semanas.push({ label: `S-${i}`, concluidas: c });
    }

    // Cycle time médio (em dias) usando created_at -> concluida_em
    const ciclos = concluidas
      .filter((t: any) => t.created_at && t.concluida_em)
      .map((t: any) => (new Date(t.concluida_em).getTime() - new Date(t.created_at).getTime()) / 86400000);
    const cycleMed = ciclos.length === 0 ? 0 : ciclos.reduce((s, n) => s + n, 0) / ciclos.length;

    // Distribuição por prioridade
    const porPrior = ['critica', 'alta', 'media', 'baixa'].map((p) => ({
      prior: p,
      qtd: tarefas.filter((t) => t.prioridade === p).length,
    }));

    // Distribuição por coluna
    const porColuna = colunas.map((c) => ({ nome: c.nome, qtd: tarefas.filter((t) => t.coluna_id === c.id).length }));

    // Tempo gasto vs estimado
    const estimado = tarefas.reduce((s: number, t: any) => s + (Number(t.estimativa_horas) || 0), 0);
    const gasto = tarefas.reduce((s: number, t: any) => s + (Number(t.tempo_gasto_horas) || 0), 0);

    return { total, abertas, concluidas: concluidas.length, atrasadas, slaViolado, slaRisco, semanas, cycleMed, porPrior, porColuna, estimado, gasto };
  }, [tarefas, colunas]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini icon={<TrendingUp />} label="Velocidade (sem.)" value={(m.semanas[3]?.concluidas ?? 0).toString()} hint={`média 4sem: ${(m.semanas.reduce((s, x) => s + x.concluidas, 0) / 4).toFixed(1)}/sem`} />
        <Mini icon={<Clock />} label="Cycle time médio" value={`${m.cycleMed.toFixed(1)}d`} hint="criação → conclusão" />
        <Mini icon={<AlertTriangle />} label="Atrasadas" value={m.atrasadas.toString()} hint={m.atrasadas > 0 ? 'Requer ação' : 'OK'} tone={m.atrasadas > 0 ? 'destructive' : 'success'} />
        <Mini icon={<CheckCircle2 />} label="Conclusão" value={m.total ? `${Math.round((m.concluidas / m.total) * 100)}%` : '—'} hint={`${m.concluidas} de ${m.total}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">Velocidade — últimas 4 semanas</div>
            <BarChart data={m.semanas.map((s) => ({ label: s.label, valor: s.concluidas }))} max={Math.max(1, ...m.semanas.map((s) => s.concluidas))} />
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">Por coluna</div>
            <BarChart data={m.porColuna.map((c) => ({ label: c.nome, valor: c.qtd }))} max={Math.max(1, ...m.porColuna.map((c) => c.qtd))} />
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">Por prioridade</div>
            <BarChart data={m.porPrior.map((p) => ({ label: p.prior, valor: p.qtd }))} max={Math.max(1, ...m.porPrior.map((p) => p.qtd))} />
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2"><Timer className="h-4 w-4 text-primary" /> Tempo & SLA</div>
            <Row label="Estimado total" value={`${m.estimado.toFixed(1)}h`} />
            <Row label="Gasto total" value={`${m.gasto.toFixed(1)}h`} />
            <Row label="Eficiência" value={m.estimado ? `${Math.round((m.gasto / m.estimado) * 100)}%` : '—'} hint={m.estimado && m.gasto > m.estimado ? 'Acima do orçado' : ''} />
            <Row label="SLA violado" value={String(m.slaViolado)} tone={m.slaViolado > 0 ? 'destructive' : 'success'} />
            <Row label="SLA em risco" value={String(m.slaRisco)} tone={m.slaRisco > 0 ? 'warning' : 'neutral'} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Mini({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: 'success' | 'destructive' | 'warning' | 'neutral' }) {
  return (
    <Card variant="elevated">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
          <span className="h-4 w-4 inline-flex items-center justify-center text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && (tone ? <StatusBadge tone={tone} size="sm">{hint}</StatusBadge> : <div className="text-xs text-muted-foreground">{hint}</div>)}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'success' | 'destructive' | 'warning' | 'neutral' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {hint && tone && <StatusBadge tone={tone} size="sm">{hint}</StatusBadge>}
        <span className="font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  );
}

function BarChart({ data, max }: { data: { label: string; valor: number }[]; max: number }) {
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <div className="w-20 truncate text-muted-foreground capitalize">{d.label}</div>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(d.valor / max) * 100}%` }} />
          </div>
          <div className="w-8 text-right tabular-nums font-medium">{d.valor}</div>
        </div>
      ))}
    </div>
  );
}
