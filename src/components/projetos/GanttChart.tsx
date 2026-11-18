import React, { useMemo } from 'react';
import type { ProjetoTarefa, ProjetoColuna } from '@/types/projetos';
import { EmptyState } from '@/components/ui/empty-state';
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale, parseDataLocal, formatarDiaParaDB } from '@/lib/date-utils';
import { isMarco, estaAtrasada, ordenarArvorePorData, periodoHerdado, type OrdemGantt } from '@/lib/projeto-acompanhamento';
import { IconChevron, IconCalendar } from '@/components/icons';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { aplicarArrasto, diasDoArrasto, conflitosDependencia, desvioLinhaBase, somarDias, inicioDe, fimDe } from '@/lib/projeto-cronograma';
import { useDependenciasProjeto, useAtualizarTarefas, useSalvarLinhaBase } from '@/hooks/useProjetoCronograma';
import { statusKindDe, type StatusKind } from './StatusPill';
import { partirTitulo, mapaFilhos, nivelDe, CodeChip, NIVEL_ROW, type Nivel } from './projeto-visual';

interface GanttChartProps {
  tarefas: ProjetoTarefa[];
  colunas?: ProjetoColuna[];
  onSelectTarefa?: (t: ProjetoTarefa) => void;
}

const DAY_MS = 86_400_000;
const ROW_H = 36;
const LEFT_W = 340;
type Zoom = 'semana' | 'mes' | 'trimestre';
const PX_DIA: Record<Zoom, number> = { semana: 22, mes: 6, trimestre: 2.2 };

const BAR: Record<StatusKind, { track: string; fill: string }> = {
  rest: { track: 'bg-muted-foreground/15', fill: 'bg-muted-foreground/50' },
  active: { track: 'bg-state-active/20', fill: 'bg-state-active' },
  done: { track: 'bg-state-done/25', fill: 'bg-state-done' },
  late: { track: 'bg-destructive/15', fill: 'bg-destructive' },
};

export const GanttChart: React.FC<GanttChartProps> = ({ tarefas, colunas = [], onSelectTarefa }) => {
  const { t } = useLanguage();
  const [zoom, setZoom] = React.useState<Zoom>('mes');
  const chave = `projeto-gantt-recolhidos:${tarefas[0]?.projeto_id ?? ''}`;
  const [recolhidos, setRecolhidos] = React.useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(chave) ?? '[]')); } catch { return new Set(); }
  });
  const alternar = (id: string) => setRecolhidos((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id);
    try { sessionStorage.setItem(chave, JSON.stringify([...n])); } catch { /* sem storage */ }
    return n;
  });

  const chaveOrdem = `gantt-ordem:${tarefas[0]?.projeto_id ?? ''}`;
  const [ordenacao, setOrdenacao] = React.useState<OrdemGantt>(() => {
    try { const v = localStorage.getItem(chaveOrdem); return v === 'inicio' || v === 'prazo' ? v : 'estrutura'; } catch { return 'estrutura'; }
  });
  const projetoId = tarefas[0]?.projeto_id;
  const { data: deps = [] } = useDependenciasProjeto(projetoId, useMemo(() => tarefas.map((x) => x.id), [tarefas]));
  const atualizar = useAtualizarTarefas(projetoId);
  const salvarLinhaBase = useSalvarLinhaBase(projetoId);
  const [verDeps, setVerDeps] = React.useState(true);
  const [verBase, setVerBase] = React.useState(false);
  const [confirmBase, setConfirmBase] = React.useState(false);
  const conflitos = useMemo(() => conflitosDependencia(tarefas, deps), [tarefas, deps]);
  const temBase = useMemo(() => tarefas.some((x) => x.baseline_fim), [tarefas]);
  /* Arrasto: pré-visualização local; grava ao soltar, com Desfazer. */
  const [arrasto, setArrasto] = React.useState<{ id: string; modo: 'mover' | 'fim'; x0: number; dias: number } | null>(null);
  const arrastou = React.useRef(false);
  const mudarOrdem = (o: OrdemGantt) => { setOrdenacao(o); try { localStorage.setItem(chaveOrdem, o); } catch { /* sem storage */ } };

  const filhos = useMemo(() => mapaFilhos(tarefas), [tarefas]);
  const intervalo = (x: ProjetoTarefa) => {
    const ini = x.data_inicio ? parseDataLocal(x.data_inicio) : x.prazo ? parseDataLocal(x.prazo) : null;
    const f = x.data_fim ?? x.prazo;
    const fim = f ? parseDataLocal(f) : ini;
    if (!ini || !fim) return null;
    return { ini: ini.getTime(), fim: Math.max(fim.getTime(), ini.getTime()) + DAY_MS };
  };

  const linhas = useMemo(() => {
    const ids = new Set(tarefas.map((x) => x.id));
    const raiz = tarefas.filter((x) => !x.parent_task_id || !ids.has(x.parent_task_id)).sort((a, b) => a.ordem - b.ordem);
    const out: { t: ProjetoTarefa; depth: number; nivel: Nivel }[] = [];
    if (ordenacao !== 'estrutura') {
      return ordenarArvorePorData(tarefas, ordenacao, recolhidos).map(({ t: x, depth }) => ({ t: x, depth, nivel: nivelDe(x, filhos, depth) }));
    }
    const push = (x: ProjetoTarefa, d: number) => {
      out.push({ t: x, depth: d, nivel: nivelDe(x, filhos, d) });
      if (recolhidos.has(x.id)) return;
      (filhos.get(x.id) ?? []).slice().sort((a, b) => a.ordem - b.ordem).forEach((c) => push(c, d + 1));
    };
    raiz.forEach((r) => push(r, 0));
    return out;
  }, [tarefas, filhos, recolhidos, ordenacao]);

  const escala = useMemo(() => {
    const iv = tarefas.map(intervalo).filter(Boolean) as { ini: number; fim: number }[];
    if (!iv.length) return null;
    const a = new Date(Math.min(...iv.map((i) => i.ini)));
    const b = new Date(Math.max(...iv.map((i) => i.fim)));
    const min = new Date(a.getFullYear(), a.getMonth(), 1).getTime();
    const max = new Date(b.getFullYear(), b.getMonth() + 1, 1).getTime();
    return { min, max };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas]);

  if (!escala) {
    return <EmptyState title={t('projetos.gantt.noDatesTitle')} description={t('projetos.gantt.noDatesDescription')} />;
  }

  const px = PX_DIA[zoom];
  const x = (ms: number) => ((ms - escala.min) / DAY_MS) * px;
  const largura = x(escala.max);
  const meses: { ini: number; fim: number }[] = [];
  for (let d = new Date(escala.min); d.getTime() < escala.max; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    meses.push({ ini: d.getTime(), fim: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() });
  }
  const hoje = Date.now();
  const hojeVisivel = hoje >= escala.min && hoje <= escala.max;

  // Agrupadores: barra-resumo do intervalo coberto pelas atividades abaixo.
  const resumo = (id: string): { ini: number; fim: number } | null => {
    const iv: { ini: number; fim: number }[] = [];
    const walk = (pid: string) => (filhos.get(pid) ?? []).forEach((c) => { const r = intervalo(c); if (r) iv.push(r); walk(c.id); });
    walk(id);
    return iv.length ? { ini: Math.min(...iv.map((i) => i.ini)), fim: Math.max(...iv.map((i) => i.fim)) } : null;
  };
  const porId = new Map(tarefas.map((tk) => [tk.id, tk]));
  const periodoReal = (tk: ProjetoTarefa) => (filhos.has(tk.id) ? resumo(tk.id) ?? intervalo(tk) : intervalo(tk));
  const iniciarArrasto = (e: React.PointerEvent, tk: ProjetoTarefa, modo: 'mover' | 'fim') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrastou.current = false;
    setArrasto({ id: tk.id, modo, x0: e.clientX, dias: 0 });
  };
  const moverArrasto = (e: React.PointerEvent) => {
    if (!arrasto) return;
    const dias = diasDoArrasto(e.clientX - arrasto.x0, px);
    if (dias !== 0) arrastou.current = true;
    if (dias !== arrasto.dias) setArrasto({ ...arrasto, dias });
  };
  const soltarArrasto = (tk: ProjetoTarefa) => {
    const a = arrasto; setArrasto(null);
    if (!a || a.dias === 0) return;
    const r = aplicarArrasto(tk, a.dias, a.modo);
    if (r) void atualizar([{ id: tk.id, ...r }], t('p3Projetos.cronograma.datasAtualizadas'));
  };
  const definirDatas = (tk: ProjetoTarefa, herdado: { ini: number } | null) => {
    const hojeISO = formatarDiaParaDB(new Date());
    const ini = herdado ? formatarDiaParaDB(new Date(herdado.ini)) : hojeISO;
    void atualizar([{ id: tk.id, data_inicio: ini, data_fim: somarDias(ini, 4) }], t('p3Projetos.cronograma.datasAtualizadas'));
  };
  const deslocamento = (id: string) => (arrasto && arrasto.id === id ? arrasto : null);
  const progressoAgregado = (id: string) => {
    const v: number[] = [];
    const walk = (pid: string) => (filhos.get(pid) ?? []).forEach((c) => (filhos.has(c.id) ? walk(c.id) : v.push(c.concluida_em ? 100 : c.progresso_pct ?? 0)));
    walk(id);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <span className="mr-auto hidden text-xs text-muted-foreground md:inline">{t('p3Projetos.cronograma.arrastarDica')}</span>
        <button type="button" aria-pressed={verDeps} onClick={() => setVerDeps((v) => !v)}
          className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${verDeps ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
          {t('p3Projetos.cronograma.mostrarDeps')}{conflitos.size > 0 && <span className="ml-1 text-destructive">· {conflitos.size}</span>}
        </button>
        {temBase && (
          <button type="button" aria-pressed={verBase} onClick={() => setVerBase((v) => !v)}
            className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${verBase ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
            {t('p3Projetos.cronograma.mostrarLinhaBase')}
          </button>
        )}
        <Button type="button" size="sm" variant="outline" className="mr-3 h-8 text-xs" onClick={() => setConfirmBase(true)} disabled={salvarLinhaBase.isPending}>
          {t('p3Projetos.cronograma.linhaBase')}
        </Button>
        <label className="mr-1 text-xs text-muted-foreground" htmlFor="gantt-ordem">{t('p3Projetos.gantt.ordenar')}</label>
        <select id="gantt-ordem" value={ordenacao} onChange={(e) => mudarOrdem(e.target.value as OrdemGantt)}
          className="mr-3 h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground">
          <option value="estrutura">{t('p3Projetos.gantt.ordemEstrutura')}</option>
          <option value="inicio">{t('p3Projetos.gantt.ordemInicio')}</option>
          <option value="prazo">{t('p3Projetos.gantt.ordemPrazo')}</option>
        </select>
        {(['semana', 'mes', 'trimestre'] as Zoom[]).map((z) => (
          <button key={z} type="button" onClick={() => setZoom(z)}
            className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${zoom === z ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
            {t(`p3Projetos.gantt.${z}`)}
          </button>
        ))}
      </div>
      <div className="overflow-auto rounded-lg border border-border bg-card">
        <div style={{ width: LEFT_W + largura }} className="relative">
          {/* Cabeçalho */}
          <div className="sticky top-0 z-20 flex h-10 border-b border-border bg-muted/40 backdrop-blur">
            <div style={{ width: LEFT_W }} className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border bg-muted/60 px-4 text-micro font-medium uppercase tracking-wide text-muted-foreground/75">
              {t('projetos.lista.colTarefa')}
            </div>
            <div className="relative" style={{ width: largura }}>
              {meses.map((m) => (
                <div key={m.ini} style={{ left: x(m.ini), width: x(m.fim) - x(m.ini) }}
                  className="absolute inset-y-0 flex items-center overflow-hidden border-r border-border/60 px-2 text-xs font-medium capitalize text-muted-foreground">
                  <span className="truncate">{new Date(m.ini).toLocaleDateString(intlLocale(), zoom === 'trimestre' ? { month: 'short' } : { month: 'short', year: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grelha de meses + hoje */}
          <div aria-hidden className="pointer-events-none absolute bottom-0 top-10" style={{ left: LEFT_W, width: largura }}>
            {meses.map((m) => <div key={m.ini} className="absolute inset-y-0 border-r border-border/40" style={{ left: x(m.fim) - 1 }} />)}
            {hojeVisivel && (
              <div className="absolute inset-y-0 z-10 w-0.5 bg-primary" style={{ left: x(hoje) }}>
                <span className="absolute -top-0 left-1 rounded bg-primary px-1 text-micro font-semibold text-primary-foreground">{t('projetos.calendar.today')}</span>
              </div>
            )}
          </div>

          {verDeps && deps.length > 0 && (() => {
            const idx = new Map(linhas.map((l, i) => [l.t.id, i]));
            const periodo = (tk: ProjetoTarefa) => { const d = deslocamento(tk.id); const base = d ? aplicarArrasto(tk, d.dias, d.modo) : null; const src = base ?? tk; const i = inicioDe(src); const f = fimDe(src); return i && f ? { ini: parseDataLocal(i).getTime(), fim: parseDataLocal(f).getTime() + DAY_MS } : null; };
            return (
              <svg aria-hidden className="pointer-events-none absolute z-[5]" style={{ left: LEFT_W, top: 40, width: largura, height: linhas.length * ROW_H }}>
                <defs>
                  <marker id="gantt-seta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="hsl(var(--muted-foreground))" /></marker>
                  <marker id="gantt-seta-erro" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="hsl(var(--destructive))" /></marker>
                </defs>
                {deps.map((d) => {
                  const ia = idx.get(d.depende_de_tarefa_id); const ib = idx.get(d.tarefa_id);
                  const a = porId.get(d.depende_de_tarefa_id); const b = porId.get(d.tarefa_id);
                  if (ia == null || ib == null || !a || !b) return null;
                  const pa = periodo(a); const pb = periodo(b);
                  if (!pa || !pb) return null;
                  const x1 = x(d.tipo === 'SS' || d.tipo === 'SF' ? pa.ini : pa.fim); const y1 = ia * ROW_H + ROW_H / 2;
                  const x2 = x(d.tipo === 'FF' || d.tipo === 'SF' ? pb.fim : pb.ini); const y2 = ib * ROW_H + ROW_H / 2;
                  const erro = conflitos.has(b.id);
                  const mx = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 8));
                  return <path key={`${d.depende_de_tarefa_id}-${d.tarefa_id}`} d={`M${x1},${y1} H${mx} V${y2} H${x2}`} fill="none"
                    stroke={erro ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground) / 0.6)'} strokeWidth={1.25} strokeDasharray={erro ? '3 2' : undefined}
                    markerEnd={`url(#${erro ? 'gantt-seta-erro' : 'gantt-seta'})`} />;
                })}
              </svg>
            );
          })()}

          {linhas.map(({ t: tk, depth, nivel }) => {
            const { codigo, nome } = partirTitulo(tk.titulo);
            const temFilhos = filhos.has(tk.id);
            const iv = temFilhos ? resumo(tk.id) ?? intervalo(tk) : intervalo(tk);
            const kind = tk.concluida_em ? 'done' : estaAtrasada(tk) ? 'late' : statusKindDe(colunas.find((c) => c.id === tk.coluna_id));
            const pct = temFilhos ? progressoAgregado(tk.id) : Math.max(0, Math.min(100, tk.concluida_em ? 100 : tk.progresso_pct ?? 0));
            const marco = isMarco(tk);
            const semData = !iv;
            const herdado = semData ? periodoHerdado(tk, porId, periodoReal) : null;
            const d = deslocamento(tk.id);
            const ivVis = iv && d && !temFilhos ? (() => { const r = aplicarArrasto(tk, d.dias, d.modo); return r ? { ini: parseDataLocal(r.data_inicio).getTime(), fim: parseDataLocal(r.data_fim).getTime() + DAY_MS } : iv; })() : iv;
            const conflito = conflitos.has(tk.id);
            const desvio = verBase ? desvioLinhaBase(tk) : null;
            const base = verBase && tk.baseline_inicio && tk.baseline_fim ? { ini: parseDataLocal(tk.baseline_inicio).getTime(), fim: parseDataLocal(tk.baseline_fim).getTime() + DAY_MS } : null;
            return (
              <div key={tk.id} className={`group flex border-b border-border/60 hover:bg-muted/30 ${NIVEL_ROW[nivel]}`} style={{ height: ROW_H }}>
                <div style={{ width: LEFT_W, paddingLeft: 12 + depth * 18 }}
                  className={`sticky left-0 z-10 flex shrink-0 cursor-pointer items-center gap-2 border-r border-border pr-3 ${nivel === 'atividade' ? 'bg-card' : nivel === 'fase' ? 'bg-[hsl(var(--card))] [background-image:linear-gradient(hsl(var(--primary)/0.08),hsl(var(--primary)/0.08))]' : 'bg-[hsl(var(--card))] [background-image:linear-gradient(hsl(var(--chart-teal)/0.08),hsl(var(--chart-teal)/0.08))]'}`}
                  onClick={() => onSelectTarefa?.(tk)}>
                  {temFilhos ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); alternar(tk.id); }}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-background/70"
                      aria-label={recolhidos.has(tk.id) ? t('p3Projetos.tarefa.expand') : t('p3Projetos.tarefa.collapse')}>
                      <IconChevron className={`h-3.5 w-3.5 transition-transform ${recolhidos.has(tk.id) ? '' : 'rotate-90'}`} />
                    </button>
                  ) : <span className="w-5 shrink-0" />}
                  {codigo && <CodeChip codigo={codigo} nivel={nivel} />}
                  {marco && <span className="text-[hsl(var(--fw-gold))]">◆</span>}
                  <span className={`truncate text-sm ${nivel === 'fase' ? 'font-bold' : nivel === 'dominio' ? 'font-semibold' : ''}`} title={nome}>{nome}</span>
                  {semData && <IconCalendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-label={t('p3Projetos.gantt.semData')} />}
                </div>
                <div className="relative" style={{ width: largura }}>
                  {semData && (herdado ? (
                    <button type="button" onClick={() => definirDatas(tk, herdado)} title={t('p3Projetos.gantt.semDataDica')}
                      className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 px-1.5 text-micro font-medium text-muted-foreground transition-ui hover:border-primary/50 hover:text-foreground"
                      style={{ left: x(herdado.ini), width: Math.max(8, x(herdado.fim) - x(herdado.ini)) }}>
                      <span className="truncate">{t('p3Projetos.gantt.semData')}</span>
                    </button>
                  ) : (
                    <button type="button" onClick={() => definirDatas(tk, null)} title={t('p3Projetos.gantt.semDataDica')}
                      className="sticky left-2 top-1/2 ml-2 mt-[9px] inline-flex h-[18px] items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 bg-muted/40 px-2 text-micro font-medium text-muted-foreground hover:text-foreground">
                      <IconCalendar className="h-3 w-3" />{t('p3Projetos.gantt.semData')}
                    </button>
                  ))}
                  {iv && (marco && !temFilhos ? (
                    <button type="button" onClick={() => onSelectTarefa?.(tk)} title={nome}
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-[hsl(var(--fw-gold))] ring-2 ring-card"
                      style={{ left: x(iv.fim - DAY_MS / 2) }} />
                  ) : temFilhos ? (
                    <button type="button" onClick={() => onSelectTarefa?.(tk)} title={`${nome} · ${pct}%`}
                      className={`absolute top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full ${nivel === 'fase' ? 'bg-primary/20' : 'bg-[hsl(var(--chart-teal)/0.2)]'}`}
                      style={{ left: x(iv.ini), width: Math.max(6, x(iv.fim) - x(iv.ini)) }}>
                      <span className={`block h-full ${nivel === 'fase' ? 'bg-primary' : 'bg-[hsl(var(--chart-teal))]'}`} style={{ width: `${pct}%` }} />
                    </button>
                  ) : (
                    <div role="button" tabIndex={0} title={conflito ? `${nome} · ${t('p3Projetos.cronograma.conflito')}` : `${nome} · ${pct}%`}
                      onPointerDown={(e) => iniciarArrasto(e, tk, 'mover')} onPointerMove={moverArrasto} onPointerUp={() => soltarArrasto(tk)} onPointerCancel={() => setArrasto(null)}
                      onClick={() => { if (!arrastou.current) onSelectTarefa?.(tk); arrastou.current = false; }}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSelectTarefa?.(tk); }}
                      className={`group/bar absolute top-1/2 flex h-5 -translate-y-1/2 touch-none select-none items-center overflow-hidden rounded-md ${BAR[kind].track} ${d ? 'cursor-grabbing ring-2 ring-primary/50' : 'cursor-grab'} ${conflito ? 'ring-2 ring-destructive/70' : ''} transition-shadow hover:ring-2 hover:ring-primary/40`}
                      style={{ left: x(ivVis!.ini), width: Math.max(8, x(ivVis!.fim) - x(ivVis!.ini)) }}>
                      <span className={`absolute inset-y-0 left-0 ${BAR[kind].fill}`} style={{ width: `${pct}%` }} />
                      {x(ivVis!.fim) - x(ivVis!.ini) > 36 && <span className={`relative px-1.5 text-micro font-semibold tabular-nums ${(x(ivVis!.fim) - x(ivVis!.ini)) * pct / 100 >= 40 ? 'text-primary-foreground' : 'text-foreground/80'}`}>{pct}%</span>}
                      <span aria-hidden onPointerDown={(e) => iniciarArrasto(e, tk, 'fim')}
                        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-foreground/0 group-hover/bar:bg-foreground/20" />
                    </div>
                  ))}
                  {base && (
                    <span aria-hidden className="pointer-events-none absolute bottom-1 h-[3px] rounded-full bg-muted-foreground/50"
                      style={{ left: x(base.ini), width: Math.max(4, x(base.fim) - x(base.ini)) }} />
                  )}
                  {desvio != null && desvio !== 0 && iv && (
                    <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 text-micro font-semibold tabular-nums ${desvio > 0 ? 'text-destructive' : 'text-[hsl(var(--state-done))]'}`}
                      style={{ left: x(iv.fim) }}>
                      {t('p3Projetos.cronograma.desvio', { dias: `${desvio > 0 ? '+' : ''}${desvio}` })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ConfirmDialog open={confirmBase} onOpenChange={setConfirmBase} title={t('p3Projetos.cronograma.linhaBase')}
        description={t('p3Projetos.cronograma.linhaBaseConfirm')} confirmText={t('p3Projetos.cronograma.linhaBase')}
        loading={salvarLinhaBase.isPending}
        onConfirm={() => salvarLinhaBase.mutate(undefined, { onSettled: () => setConfirmBase(false) })} />
    </div>
  );
};
