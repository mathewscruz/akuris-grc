import React, { useMemo } from 'react';
import type { ProjetoTarefa, ProjetoColuna } from '@/types/projetos';
import { EmptyState } from '@/components/ui/empty-state';
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
import { isMarco, estaAtrasada } from '@/lib/projeto-acompanhamento';
import { IconChevron } from '@/components/icons';
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
    const push = (x: ProjetoTarefa, d: number) => {
      out.push({ t: x, depth: d, nivel: nivelDe(x, filhos, d) });
      if (recolhidos.has(x.id)) return;
      (filhos.get(x.id) ?? []).slice().sort((a, b) => a.ordem - b.ordem).forEach((c) => push(c, d + 1));
    };
    raiz.forEach((r) => push(r, 0));
    return out;
  }, [tarefas, filhos, recolhidos]);

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
  const progressoAgregado = (id: string) => {
    const v: number[] = [];
    const walk = (pid: string) => (filhos.get(pid) ?? []).forEach((c) => (filhos.has(c.id) ? walk(c.id) : v.push(c.concluida_em ? 100 : c.progresso_pct ?? 0)));
    walk(id);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        {(['semana', 'mes', 'trimestre'] as Zoom[]).map((z) => (
          <button key={z} type="button" onClick={() => setZoom(z)}
            className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${zoom === z ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
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
                <span className="absolute -top-0 left-1 rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{t('projetos.calendar.today')}</span>
              </div>
            )}
          </div>

          {linhas.map(({ t: tk, depth, nivel }) => {
            const { codigo, nome } = partirTitulo(tk.titulo);
            const temFilhos = filhos.has(tk.id);
            const iv = temFilhos ? resumo(tk.id) ?? intervalo(tk) : intervalo(tk);
            const kind = tk.concluida_em ? 'done' : estaAtrasada(tk) ? 'late' : statusKindDe(colunas.find((c) => c.id === tk.coluna_id));
            const pct = temFilhos ? progressoAgregado(tk.id) : Math.max(0, Math.min(100, tk.concluida_em ? 100 : tk.progresso_pct ?? 0));
            const marco = isMarco(tk);
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
                </div>
                <div className="relative" style={{ width: largura }}>
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
                    <button type="button" onClick={() => onSelectTarefa?.(tk)} title={`${nome} · ${pct}%`}
                      className={`absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md ${BAR[kind].track} transition-shadow hover:ring-2 hover:ring-primary/40`}
                      style={{ left: x(iv.ini), width: Math.max(8, x(iv.fim) - x(iv.ini)) }}>
                      <span className={`absolute inset-y-0 left-0 ${BAR[kind].fill}`} style={{ width: `${pct}%` }} />
                      {x(iv.fim) - x(iv.ini) > 36 && <span className="relative px-1.5 text-[10px] font-semibold tabular-nums text-foreground/80">{pct}%</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
