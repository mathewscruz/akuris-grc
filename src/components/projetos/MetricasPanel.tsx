import React from 'react';
import { AkurisBars, AkurisArea, AkurisDonut } from '@/components/charts/AkurisCharts';
import { StatStrip } from '@/components/ui/stat-strip';
import { useUsuariosEmpresa } from '@/hooks/useUsuariosEmpresa';
import { folhas, isMarco, estaAtrasada } from '@/lib/projeto-acompanhamento';
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
import { indicadores, progressoPorFase, burnupSemanal, previsaoTermino, atrasadasPorResponsavel, tempoMedioPorPrioridade, filtrarPorPeriodo, trajetoriaIdeal, recortarInicio, saudeProjeto, projecaoBurnup, prioridadeEmpilhada } from '@/lib/projeto-acompanhamento';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToolbarField } from '@/components/ui/module-toolbar';
import { CHART_SEVERITY } from '@/lib/chart-tokens';
import { MetricCard, BurnChart, WeeklyBars, StackedPriority, Gauge, type BurnPoint } from './metricas-graficos';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Chip } from '@/components/ui/chip';

export function MetricasPanel({ tarefas: todas, colunas, fimPrevisto, inicioProjeto }: { tarefas: ProjetoTarefa[]; colunas: ProjetoColuna[]; fimPrevisto?: string | null; inicioProjeto?: string | null }) {
  const { t } = useLanguage();
  const [periodo, setPeriodo] = React.useState('todos');
  const tarefas = React.useMemo(() => filtrarPorPeriodo(todas, periodo === 'todos' ? null : Number(periodo)), [todas, periodo]);
  const m = React.useMemo(() => {
    const atividades = folhas(tarefas);
    const total = atividades.length;
    const concluidas = atividades.filter((t) => t.concluida_em || (t.progresso_pct ?? 0) >= 100);
    const abertas = total - concluidas.length;
    const atrasadas = atividades.filter((t) => estaAtrasada(t)).length;
    const slaViolado = (tarefas as any[]).filter((t) => t.sla_status === 'violado').length;
    const slaRisco = (tarefas as any[]).filter((t) => t.sla_status === 'em_risco').length;

    // Velocity últimas 4 semanas
    const semanas: { label: string; concluidas: number; ini: Date; fim: Date }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ini = new Date(); ini.setDate(ini.getDate() - (i + 1) * 7); ini.setHours(0, 0, 0, 0);
      const fim = new Date(ini); fim.setDate(fim.getDate() + 7);
      const c = concluidas.filter((t) => {
        const d = new Date(t.concluida_em ?? 0);
        return d >= ini && d < fim;
      }).length;
      semanas.push({ label: ini.toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit' }), concluidas: c, ini: new Date(ini), fim: new Date(fim) });
    }

    // Cycle time médio (em dias) usando created_at -> concluida_em
    const ciclos = concluidas
      .filter((t: any) => t.created_at && t.concluida_em)
      .map((t: any) => (new Date(t.concluida_em).getTime() - new Date(t.created_at).getTime()) / 86400000);
    const cycleMed = ciclos.length === 0 ? 0 : ciclos.reduce((s, n) => s + n, 0) / ciclos.length;

    // Distribuição por prioridade
    const porPrior = (['critica', 'alta', 'media', 'baixa'] as ProjetoTarefaPrioridade[]).map((p) => ({
      prior: p,
      qtd: atividades.filter((t) => t.prioridade === p).length,
    }));

    // Distribuição por coluna
    const porColuna = colunas.map((c) => ({ nome: c.nome, qtd: atividades.filter((t) => t.coluna_id === c.id).length }));

    // Tempo gasto vs estimado
    const estimado = atividades.reduce((s: number, t: any) => s + (Number(t.estimativa_horas) || 0), 0);
    const gasto = atividades.reduce((s: number, t: any) => s + (Number(t.tempo_gasto_horas) || 0), 0);

    return { total, abertas, concluidas: concluidas.length, atrasadas, slaViolado, slaRisco, semanas, cycleMed, porPrior, porColuna, estimado, gasto };
  }, [tarefas, colunas]);

  const ind = React.useMemo(() => indicadores(tarefas), [tarefas]);
  const burnup = React.useMemo(() => burnupSemanal(todas), [todas]);
  const previsao = React.useMemo(() => previsaoTermino(todas), [todas]);
  const atrasoPessoa = React.useMemo(() => atrasadasPorResponsavel(tarefas), [tarefas]);
  const tempoPrior = React.useMemo(() => tempoMedioPorPrioridade(tarefas), [tarefas]);
  const mediaSemanal = m.semanas.length ? m.semanas.reduce((a, s) => a + s.concluidas, 0) / m.semanas.length : 0;
  const fimPrev = fimPrevisto ? parseDataLocal(fimPrevisto) : null;
  const previsaoAtrasa = !!(previsao.data && fimPrev && previsao.data > new Date(fimPrev.getTime() + 86399999));
  const fases = React.useMemo(() => progressoPorFase(tarefas), [tarefas]);
  const fmtDia = (d: Date) => d.toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit' });
  const [modoBurn, setModoBurn] = React.useState<'up' | 'down'>('up');
  const [semanaSel, setSemanaSel] = React.useState<number | null>(null);
  const [lista, setLista] = React.useState<{ titulo: string; itens: ProjetoTarefa[] } | null>(null);
  const inicio = React.useMemo(() => {
    if (inicioProjeto) return parseDataLocal(inicioProjeto);
    const criadas = todas.map((x: any) => x.created_at).filter(Boolean).map((d: string) => new Date(d).getTime());
    return criadas.length ? new Date(Math.min(...criadas)) : null;
  }, [inicioProjeto, todas]);
  const burnupDados = React.useMemo<BurnPoint[]>(() => {
    const pts = recortarInicio(burnup.pontos);
    const total = burnup.total;
    const ideal = trajetoriaIdeal(pts.map((p) => p.fim), total, inicio, fimPrev);
    const reais: BurnPoint[] = pts.map((p, i) => ({ label: fmtDia(p.fim), escopo: total, real: p.concluidas, ideal: ideal[i] }));
    const atual = pts[pts.length - 1]?.concluidas ?? 0;
    const fut = projecaoBurnup(atual, total, previsao.porSemana);
    const idealFut = trajetoriaIdeal(fut.map((f) => f.fim), total, inicio, fimPrev);
    if (fut.length && reais.length) reais[reais.length - 1].projecao = atual;
    const todosPts = [...reais, ...fut.map((f, i) => ({ label: fmtDia(f.fim), escopo: total, real: null, projecao: f.valor, ideal: idealFut[i] }))];
    if (modoBurn === 'up') return todosPts;
    const inv = (v: number | null | undefined) => (v == null ? v : Math.round((total - v) * 10) / 10);
    return todosPts.map((d) => ({ ...d, real: inv(d.real), ideal: inv(d.ideal), projecao: inv(d.projecao) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burnup, inicio, fimPrevisto, previsao.porSemana, modoBurn]);
  const hojeLabel = burnup.pontos.length ? fmtDia(burnup.pontos[burnup.pontos.length - 1].fim) : undefined;
  const real = ind.total ? ind.concluidas / ind.total : 0;
  const saude = React.useMemo(() => saudeProjeto(real, inicio, fimPrev, previsao.data), [real, inicio, fimPrevisto, previsao.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const empilhado = React.useMemo(() => prioridadeEmpilhada(tarefas), [tarefas]);
  const ultima = m.semanas[m.semanas.length - 1]?.concluidas ?? 0;
  const penultima = m.semanas[m.semanas.length - 2]?.concluidas ?? 0;
  const abrirSemana = (i: number) => {
    const s = m.semanas[i]; if (!s) return;
    setSemanaSel(i);
    setLista({ titulo: t('autoMet.listaSemana', { d: s.label }), itens: folhas(tarefas).filter((x) => x.concluida_em && new Date(x.concluida_em) >= s.ini && new Date(x.concluida_em) < s.fim) });
  };
  const abrirPrioridade = (p: string) => setLista({ titulo: t('autoMet.listaPrioridade', { p: getPrioridadeLabel(t, p as ProjetoTarefaPrioridade) }), itens: folhas(tarefas).filter((x) => x.prioridade === p) });
  const temIdeal = burnupDados.some((d) => d.ideal != null);
  const corPrior = { critica: CHART_SEVERITY.critical, alta: CHART_SEVERITY.high, media: CHART_SEVERITY.medium, baixa: CHART_SEVERITY.low } as const;
  const maxTempo = Math.max(0, ...Object.values(tempoPrior).map((v) => v ?? 0));
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
      <div className="flex justify-end">
        <ToolbarField label={t('autoMet.periodo')}>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">{t('relatoriosComp.dialog.period30')}</SelectItem>
              <SelectItem value="90">{t('relatoriosComp.dialog.period90')}</SelectItem>
              <SelectItem value="todos">{t('relatoriosComp.dialog.periodAll')}</SelectItem>
            </SelectContent>
          </Select>
        </ToolbarField>
      </div>
      <StatStrip module="projetos" items={[
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
                <span className="text-right text-xs tabular-nums text-muted-foreground">{c.feitas}/{c.total}{atrasoPessoa[c.id] ? <span className="ml-1 font-semibold text-destructive" title={t('autoMet.atrasadasPessoa')}>· {atrasoPessoa[c.id]}</span> : null}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {saude.saude !== 'sem_prazo' && (
        <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-border bg-card p-5 dark:shadow-none animate-fade-in motion-reduce:animate-none">
          <div className="flex items-center gap-3">
            <Chip tone={saude.saude === 'no_prazo' ? 'done' : saude.saude === 'em_risco' ? 'attention' : 'critical'}>{t(`autoMet.saude.${saude.saude}`)}</Chip>
            <p className="text-sm text-muted-foreground">{t('autoMet.saudeFrase', { r: Math.round(real * 100), e: Math.round((saude.esperado ?? 0) * 100) })}</p>
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="relative h-2.5 rounded-full bg-muted">
              <div className="h-full origin-left animate-scale-in rounded-full motion-reduce:animate-none" style={{ width: `${Math.round(real * 100)}%`, background: 'hsl(var(--chart-trend))' }} />
              <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground/60" style={{ left: `${Math.round((saude.esperado ?? 0) * 100)}%`, height: 18 }} title={t('autoMet.esperadoHoje')} />
            </div>
            <div className="mt-1.5 flex justify-between text-micro text-muted-foreground"><span>{inicio?.toLocaleDateString(intlLocale())}</span><span>{t('autoMet.esperadoHoje')}</span><span>{fimPrev?.toLocaleDateString(intlLocale())}</span></div>
          </div>
          {saude.folgaDias != null && (
            <div className="text-right">
              <p className={`text-2xl font-semibold tabular-nums ${saude.folgaDias < 0 ? 'text-destructive' : 'text-foreground'}`}>{saude.folgaDias > 0 ? '+' : ''}{saude.folgaDias}d</p>
              <p className="text-micro text-muted-foreground">{t(saude.folgaDias < 0 ? 'autoMet.atraso' : 'autoMet.folga')}</p>
            </div>
          )}
        </section>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini icon={<IconTrendUp />} label={t('projetos.metricas.velocity')} value={(m.semanas[7]?.concluidas ?? 0).toString()} hint={t('projetos.metricas.avg4Weeks', { value: (m.semanas.slice(4).reduce((s, x) => s + x.concluidas, 0) / 4).toFixed(1) })} />
        <Mini icon={<IconTime />} label={t('projetos.metricas.cycleTime')} value={`${m.cycleMed.toFixed(1)}d`} hint={t('projetos.metricas.cycleTimeHint')} />
        <Mini icon={<IconWarning />} label={t('projetos.metricas.overdue')} value={m.atrasadas.toString()} hint={m.atrasadas > 0 ? t('projetos.metricas.requiresAction') : t('projetos.metricas.ok')} tone={m.atrasadas > 0 ? 'destructive' : 'success'} />
        <Mini icon={<IconSuccess />} label={t('projetos.metricas.completion')} value={m.total ? `${Math.round((m.concluidas / m.total) * 100)}%` : '—'} hint={t('projetos.metricas.completionHint', { done: m.concluidas, total: m.total })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard className="lg:col-span-2" title={t(modoBurn === 'up' ? 'autoMet.burnup' : 'autoMet.burndown')} subtitle={t(modoBurn === 'up' ? 'autoMet.burnupSub' : 'autoMet.burndownSub')}
          action={
            <div role="radiogroup" className="inline-flex shrink-0 rounded-full border border-border bg-muted/40 p-0.5 text-xs">
              {(['up', 'down'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={modoBurn === k} onClick={() => setModoBurn(k)}
                  className={`rounded-full px-3 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${modoBurn === k ? 'bg-card font-medium text-foreground shadow-sm dark:shadow-none dark:ring-1 dark:ring-border' : 'text-muted-foreground hover:text-foreground'}`}>
                  {k === 'up' ? 'Burnup' : 'Burndown'}
                </button>
              ))}
            </div>
          }>
          <BurnChart data={burnupDados} hojeLabel={hojeLabel} labels={{
            real: t(modoBurn === 'up' ? 'autoMet.concluidasAcum' : 'autoMet.restantes'), ideal: t('autoMet.ritmoIdeal'), projecao: t('autoMet.projecao'),
            escopo: t('autoMet.escopo', { n: burnup.total }), hoje: t('autoMet.hoje'), semana: (l) => t('autoMet.semanaDe', { d: l }),
          }} />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: 'hsl(var(--chart-trend))' }} />{t(modoBurn === 'up' ? 'autoMet.concluidasAcum' : 'autoMet.restantes')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-muted" />{t('autoMet.escopo', { n: burnup.total })}</span>
            {temIdeal && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-muted-foreground" />{t('autoMet.ritmoIdeal')}</span>}
            {previsao.porSemana > 0 && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: 'hsl(var(--chart-trend))' }} />{t('autoMet.projecao')}</span>}
          </div>
        </MetricCard>
        <MetricCard title={t('autoMet.previsao')} subtitle={t('autoMet.previsaoSub')}>
          <div className="space-y-4">
            <div>
              <p className={`text-3xl font-semibold tabular-nums tracking-tight ${previsaoAtrasa ? 'text-destructive' : 'text-foreground'}`}>{previsao.data ? previsao.data.toLocaleDateString(intlLocale()) : '—'}</p>
              {previsao.data
                ? <p className="mt-1 text-xs text-muted-foreground">{t('autoMet.previsaoBase', { n: previsao.porSemana.toFixed(1), r: previsao.restantes })}</p>
                : <p className="mt-2 rounded-md border border-dashed border-border bg-muted/30 p-2.5 text-xs leading-relaxed text-muted-foreground">{t('autoMet.previsaoSemRitmoLongo', { r: previsao.restantes })}</p>}
            </div>
            {fimPrev && <Row label={t('autoMet.fimPrevisto')} value={fimPrev.toLocaleDateString(intlLocale())} hint={previsaoAtrasa ? t('autoMet.previsaoAtrasa') : ''} tone={previsaoAtrasa ? 'destructive' : undefined} />}
            <div className="space-y-2.5 border-t pt-4">
              <div className="text-xs font-semibold text-muted-foreground">{t('autoMet.tempoMedio')}</div>
              {(['critica', 'alta', 'media', 'baixa'] as const).map((p) => (
                <div key={p} className="grid grid-cols-[60px_minmax(0,1fr)_52px] items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{getPrioridadeLabel(t, p)}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    {tempoPrior[p] != null && maxTempo > 0 && <div className="h-full origin-left animate-scale-in rounded-full motion-reduce:animate-none" style={{ width: `${Math.max(6, (tempoPrior[p]! / maxTempo) * 100)}%`, background: corPrior[p] }} />}
                  </div>
                  <span className="whitespace-nowrap text-right text-xs tabular-nums">{tempoPrior[p] == null ? <span className="text-muted-foreground">—</span> : t('autoMet.diasCurto', { n: tempoPrior[p]!.toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) })}</span>
                </div>
              ))}
            </div>
          </div>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricCard title={t('autoMet.velocidade8')} subtitle={t('autoMet.ritmoSub')}
          action={<Chip tone={ultima > penultima ? 'done' : ultima < penultima ? 'attention' : 'rest'}>{ultima - penultima > 0 ? '+' : ''}{ultima - penultima} {t('autoMet.vsAnterior')}</Chip>}>
          <WeeklyBars data={m.semanas.map((s) => ({ label: s.label, value: s.concluidas }))} media={mediaSemanal}
            mediaLabel={t('autoMet.media', { n: mediaSemanal.toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) })}
            tooltip={() => t('autoMet.concluidasLabel')} onSelect={abrirSemana} selected={lista ? semanaSel : null} />
        </MetricCard>
        <MetricCard title={t('projetos.metricas.byPriority')} subtitle={t('autoMet.prioridadeSub')}>
          <StackedPriority onSelect={abrirPrioridade}
            rows={empilhado.map((r) => ({ key: r.prior, label: getPrioridadeLabel(t, r.prior), color: corPrior[r.prior], concluidas: r.concluidas, abertas: r.abertas, atrasadas: r.atrasadas, total: r.total }))}
            labels={{ concluidas: t('autoMet.concluidasLabel'), abertas: t('autoMet.emAberto'), atrasadas: t('p3Projetos.painel.atrasadas'), vazio: '—' }} />
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricCard title={t('projetos.metricas.timeAndSla')} subtitle={t('autoMet.tempoSub')}>
          <div className="grid items-center gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            {m.estimado > 0
              ? <Gauge value={(m.gasto / m.estimado) * 100} label={t('autoMet.gastoVsEstimado')} />
              : <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t('autoMet.semEstimativa')}</p>}
            <div className="space-y-3">
              <Row label={t('projetos.metricas.estimatedTotal')} value={`${m.estimado.toFixed(1)}h`} />
              <Row label={t('projetos.metricas.spentTotal')} value={`${m.gasto.toFixed(1)}h`} hint={m.gasto > m.estimado && m.estimado > 0 ? t('projetos.metricas.aboveBudget') : ''} tone={m.gasto > m.estimado && m.estimado > 0 ? 'destructive' : undefined} />
              <Row label={t('projetos.metricas.slaViolated')} value={String(m.slaViolado)} tone={m.slaViolado > 0 ? 'destructive' : undefined} hint={m.slaViolado > 0 ? t('projetos.metricas.requiresAction') : ''} />
              <Row label={t('projetos.metricas.slaAtRisk')} value={String(m.slaRisco)} tone={m.slaRisco > 0 ? 'warning' : undefined} hint={m.slaRisco > 0 ? t('autoMet.atencao') : ''} />
            </div>
          </div>
        </MetricCard>
        <MetricCard title={t('autoMet.porColuna')} subtitle={t('autoMet.porColunaSub')}>
          <ul className="space-y-2.5">
            {m.porColuna.map((c, i) => { const max = Math.max(1, ...m.porColuna.map((x) => x.qtd)); return (
              <li key={c.nome} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_32px] items-center gap-3 text-sm">
                <span className="truncate text-muted-foreground">{c.nome}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted/60"><div className="h-full origin-left animate-scale-in rounded-full motion-reduce:animate-none" style={{ width: `${(c.qtd / max) * 100}%`, background: 'hsl(var(--chart-trend))', opacity: 0.4 + 0.6 * (c.qtd / max), animationDelay: `${i * 50}ms` }} /></div>
                <span className="text-right text-xs font-semibold tabular-nums">{c.qtd}</span>
              </li>
            ); })}
          </ul>
        </MetricCard>
      </div>

      <Sheet open={!!lista} onOpenChange={(o) => { if (!o) { setLista(null); setSemanaSel(null); } }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{lista?.titulo}</SheetTitle>
            <SheetDescription>{t('autoMet.nAtividades', { n: lista?.itens.length ?? 0 })}</SheetDescription>
          </SheetHeader>
          <ul className="mt-4 divide-y divide-border">
            {lista?.itens.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">{t('autoMet.listaVazia')}</li>}
            {lista?.itens.map((x) => { const p = partirTitulo(x.titulo); const atras = !x.concluida_em && estaAtrasada(x); const d = x.concluida_em ? new Date(x.concluida_em) : (x.data_fim ?? x.prazo) ? parseDataLocal((x.data_fim ?? x.prazo)!) : null; return (
              <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
                {x.concluida_em ? <IconSuccess className="h-4 w-4 shrink-0 text-success" /> : <span className={`h-3.5 w-3.5 shrink-0 rounded-full border ${atras ? 'border-destructive' : 'border-muted-foreground/40'}`} />}
                {p.codigo && <CodeChip codigo={p.codigo} nivel="atividade" />}
                <span className={`min-w-0 flex-1 truncate ${x.concluida_em ? 'text-muted-foreground' : ''}`}>{p.nome}</span>
                {d && <span className={`text-xs tabular-nums ${atras ? 'text-destructive' : 'text-muted-foreground'}`}>{d.toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit' })}</span>}
              </li>
            ); })}
          </ul>
        </SheetContent>
      </Sheet>
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

