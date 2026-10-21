import React from 'react';
import { AkurisBars, AkurisArea, AkurisDonut } from '@/components/charts/AkurisCharts';
import { StatStrip } from '@/components/ui/stat-strip';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { folhas, isMarco } from '@/lib/projeto-acompanhamento';
import { partirTitulo, CodeChip, UserAvatar } from './projeto-visual';
import { statusKindDe } from './StatusPill';
import { IconSuccess, IconWarning, IconTime, IconTrendUp, IconTimer } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { AnimatedMetricValue } from '@/components/ui/stat-strip';
import type { ProjetoTarefa, ProjetoColuna } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPrioridadeLabel } from './enum-labels';
import type { ProjetoTarefaPrioridade } from '@/types/projetos';
import { parseDataLocal, intlLocale } from '@/lib/date-utils';
import { indicadores, progressoPorFase } from '@/lib/projeto-acompanhamento';

export function MetricasPanel({ tarefas, colunas }: { tarefas: ProjetoTarefa[]; colunas: ProjetoColuna[] }) {
  const { t } = useLanguage();
  const m = React.useMemo(() => {
    const total = tarefas.length;
    const concluidas = tarefas.filter((t) => t.concluida_em);
    const abertas = total - concluidas.length;
    const atrasadas = tarefas.filter((t) => !t.concluida_em && t.prazo && parseDataLocal(t.prazo) < new Date()).length;
    const slaViolado = (tarefas as any[]).filter((t) => t.sla_status === 'violado').length;
    const slaRisco = (tarefas as any[]).filter((t) => t.sla_status === 'em_risco').length;

    // Velocity últimas 4 semanas
    const semanas: { label: string; concluidas: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ini = new Date(); ini.setDate(ini.getDate() - (i + 1) * 7); ini.setHours(0, 0, 0, 0);
      const fim = new Date(ini); fim.setDate(fim.getDate() + 7);
      const c = concluidas.filter((t) => {
        const d = new Date(t.concluida_em ?? 0);
        return d >= ini && d < fim;
      }).length;
      semanas.push({ label: ini.toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit' }), concluidas: c });
    }

    // Cycle time médio (em dias) usando created_at -> concluida_em
    const ciclos = concluidas
      .filter((t: any) => t.created_at && t.concluida_em)
      .map((t: any) => (new Date(t.concluida_em).getTime() - new Date(t.created_at).getTime()) / 86400000);
    const cycleMed = ciclos.length === 0 ? 0 : ciclos.reduce((s, n) => s + n, 0) / ciclos.length;

    // Distribuição por prioridade
    const porPrior = (['critica', 'alta', 'media', 'baixa'] as ProjetoTarefaPrioridade[]).map((p) => ({
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

  const ind = React.useMemo(() => indicadores(tarefas), [tarefas]);
  const fases = React.useMemo(() => progressoPorFase(tarefas), [tarefas]);
  const { data: usuarios = [] } = useUsuariosEmpresa();
  const atividades = React.useMemo(() => folhas(tarefas), [tarefas]);
  const porStatus = React.useMemo(() => {
    const cor = { rest: 'hsl(var(--muted-foreground) / 0.45)', active: 'hsl(var(--state-active))', done: 'hsl(var(--state-done))', late: 'hsl(var(--destructive))' } as const;
    return colunas.map((c) => ({ label: c.nome, value: atividades.filter((x) => x.coluna_id === c.id).length, color: cor[statusKindDe(c)] })).filter((d) => d.value > 0);
  }, [colunas, atividades]);
  const carga = React.useMemo(() => {
    const m = new Map<string, { id: string; nome: string; foto: string | null; total: number; feitas: number }>();
    atividades.forEach((x) => {
      if (!x.responsavel_id) return;
      const u = usuarios.find((y) => y.user_id === x.responsavel_id);
      const cur = m.get(x.responsavel_id) ?? { id: x.responsavel_id, nome: u?.nome ?? '—', foto: (u as any)?.foto_url ?? null, total: 0, feitas: 0 };
      cur.total++; if (x.concluida_em) cur.feitas++;
      m.set(x.responsavel_id, cur);
    });
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [atividades, usuarios]);
  const maxCarga = Math.max(1, ...carga.map((c) => c.total));
  const marcos = React.useMemo(() => tarefas.filter((x) => isMarco(x) && !x.concluida_em && (x.data_fim ?? x.prazo))
    .sort((a, b) => (a.data_fim ?? a.prazo)!.localeCompare((b.data_fim ?? b.prazo)!)).slice(0, 5), [tarefas]);
  const marco = ind.proximoMarco;
  const marcoData = marco ? parseDataLocal((marco.data_fim ?? marco.prazo)!).toLocaleDateString(intlLocale()) : null;

  return (
    <div className="space-y-4">
      <StatStrip items={[
        { key: 'progresso', label: t('p3Projetos.painel.progressoGeral'), value: `${Math.round(ind.progresso * 100)}%`, icon: IconTrendUp as any, hint: t('p3Projetos.painel.planejadoHoje', { value: Math.round(ind.planejado * 100) }) } as any,
        { key: 'concluidas', label: t('p3Projetos.painel.concluidas'), value: ind.concluidas, icon: IconSuccess as any, tone: 'success', hint: t('p3Projetos.painel.deTotal', { total: ind.total }) } as any,
        { key: 'atrasadas', label: t('p3Projetos.painel.atrasadas'), value: ind.atrasadas, icon: IconWarning as any, tone: 'destructive', hint: t('p3Projetos.painel.atrasadasHint') } as any,
        { key: 'marco', label: t('p3Projetos.painel.proximoMarco'), value: marcoData ?? '—', hint: marco ? partirTitulo(marco.titulo).nome : t('p3Projetos.painel.semMarco') } as any,
      ]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {fases.length > 0 && (
          <Card variant="elevated" className="lg:col-span-2">
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-semibold">{t('p3Projetos.painel.porFase')}</div>
              {fases.map((f) => { const p = partirTitulo(f.titulo); return (
                <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_160px_44px] items-center gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">{p.codigo && <CodeChip codigo={p.codigo} nivel="fase" />}<span className="truncate">{p.nome}</span></span>
                  <div className="h-2 rounded-full bg-primary/10 overflow-hidden"><div className={`h-full transition-all ${f.progresso >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${f.progresso}%` }} /></div>
                  <span className="text-right text-xs font-semibold tabular-nums">{f.progresso}%</span>
                </div>
              ); })}
            </CardContent>
          </Card>
        )}
        <Card variant="elevated">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-semibold">{t('p3Projetos.painel.proximosMarcos')}</div>
            {marcos.length === 0 ? <p className="text-xs text-muted-foreground">{t('p3Projetos.painel.semMarco')}</p> : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                {marcos.map((mk) => { const p = partirTitulo(mk.titulo); const d = mk.data_fim ?? mk.prazo; return (
                  <li key={mk.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-[hsl(var(--fw-gold))] ring-2 ring-card" />
                    <p className="text-xs font-semibold tabular-nums text-muted-foreground">{d ? parseDataLocal(d).toLocaleDateString(intlLocale()) : '—'}</p>
                    <p className="text-sm leading-snug">{p.codigo && <span className="mr-1 text-primary tabular-nums">{p.codigo}</span>}{p.nome}</p>
                  </li>
                ); })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">{t('p3Projetos.painel.porStatus')}</div>
            <AkurisDonut data={porStatus} centerLabel={t('p3Projetos.painel.atividades')} size={160} />
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-semibold">{t('p3Projetos.painel.cargaResponsavel')}</div>
            {carga.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : carga.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_56px] items-center gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2"><UserAvatar nome={c.nome} foto={c.foto} size={24} /><span className="truncate">{c.nome}</span></span>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-state-done" style={{ width: `${(c.feitas / maxCarga) * 100}%` }} />
                  <div className="h-full bg-primary" style={{ width: `${((c.total - c.feitas) / maxCarga) * 100}%` }} />
                </div>
                <span className="text-right text-xs tabular-nums text-muted-foreground">{c.feitas}/{c.total}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini icon={<IconTrendUp />} label={t('projetos.metricas.velocity')} value={(m.semanas[7]?.concluidas ?? 0).toString()} hint={t('projetos.metricas.avg4Weeks', { value: (m.semanas.slice(4).reduce((s, x) => s + x.concluidas, 0) / 4).toFixed(1) })} />
        <Mini icon={<IconTime />} label={t('projetos.metricas.cycleTime')} value={`${m.cycleMed.toFixed(1)}d`} hint={t('projetos.metricas.cycleTimeHint')} />
        <Mini icon={<IconWarning />} label={t('projetos.metricas.overdue')} value={m.atrasadas.toString()} hint={m.atrasadas > 0 ? t('projetos.metricas.requiresAction') : t('projetos.metricas.ok')} tone={m.atrasadas > 0 ? 'destructive' : 'success'} />
        <Mini icon={<IconSuccess />} label={t('projetos.metricas.completion')} value={m.total ? `${Math.round((m.concluidas / m.total) * 100)}%` : '—'} hint={t('projetos.metricas.completionHint', { done: m.concluidas, total: m.total })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">{t('projetos.metricas.velocityChart')}</div>
            <AkurisArea data={m.semanas.map((s) => ({ label: s.label, value: s.concluidas }))} />
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">{t('projetos.metricas.byPriority')}</div>
            <AkurisBars data={m.porPrior.map((p) => ({ label: getPrioridadeLabel(t, p.prior), value: p.qtd }))} />
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2"><IconTimer className="h-4 w-4 text-primary" /> {t('projetos.metricas.timeAndSla')}</div>
            <Row label={t('projetos.metricas.estimatedTotal')} value={`${m.estimado.toFixed(1)}h`} />
            <Row label={t('projetos.metricas.spentTotal')} value={`${m.gasto.toFixed(1)}h`} />
            <Row label={t('projetos.metricas.efficiency')} value={m.estimado ? `${Math.round((m.gasto / m.estimado) * 100)}%` : '—'} hint={m.estimado && m.gasto > m.estimado ? t('projetos.metricas.aboveBudget') : ''} />
            <Row label={t('projetos.metricas.slaViolated')} value={String(m.slaViolado)} tone={m.slaViolado > 0 ? 'destructive' : 'success'} />
            <Row label={t('projetos.metricas.slaAtRisk')} value={String(m.slaRisco)} tone={m.slaRisco > 0 ? 'warning' : 'neutral'} />
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
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span className="h-4 w-4 inline-flex items-center justify-center text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums"><AnimatedMetricValue value={value} /></div>
        {hint && (tone ? <StatusBadge tone={tone}>{hint}</StatusBadge> : <div className="text-xs text-muted-foreground">{hint}</div>)}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'success' | 'destructive' | 'warning' | 'neutral' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {hint && tone && <StatusBadge tone={tone}>{hint}</StatusBadge>}
        <span className="font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  );
}

