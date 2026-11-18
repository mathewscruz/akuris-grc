/**
 * Regras puras do cronograma de projetos (Gantt editável, dependências,
 * período da tarefa principal, linha de base e deslocamento em lote).
 * Datas sempre no formato local 'YYYY-MM-DD'.
 */
const DAY_MS = 86_400_000;

export type DataISO = string;
export interface DatasTarefa { data_inicio: DataISO | null; data_fim: DataISO | null; prazo?: string | null }

const toUTC = (d: DataISO) => { const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const fromUTC = (ms: number): DataISO => { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export function somarDias(d: DataISO, dias: number): DataISO { return fromUTC(toUTC(d) + dias * DAY_MS); }
export function diferencaDias(a: DataISO, b: DataISO): number { return Math.round((toUTC(b) - toUTC(a)) / DAY_MS); }

/** Arrasto em pixels → dias inteiros (arredondado ao dia mais próximo). */
export function diasDoArrasto(dx: number, pxPorDia: number): number {
  if (!pxPorDia) return 0;
  const d = Math.round(dx / pxPorDia);
  return Object.is(d, -0) ? 0 : d;
}

export function inicioDe(t: DatasTarefa): DataISO | null { return (t.data_inicio ?? t.prazo ?? t.data_fim)?.slice(0, 10) ?? null; }
export function fimDe(t: DatasTarefa): DataISO | null { return (t.data_fim ?? t.prazo ?? t.data_inicio)?.slice(0, 10) ?? null; }

/** Mover a barra inteira ou só esticar o fim (o fim nunca fica antes do início). */
export function aplicarArrasto(t: DatasTarefa, dias: number, modo: 'mover' | 'fim'): { data_inicio: DataISO; data_fim: DataISO } | null {
  const ini = inicioDe(t); const fim = fimDe(t);
  if (!ini || !fim) return null;
  if (modo === 'mover') return { data_inicio: somarDias(ini, dias), data_fim: somarDias(fim, dias) };
  const novoFim = somarDias(fim, dias);
  return { data_inicio: ini, data_fim: diferencaDias(ini, novoFim) < 0 ? ini : novoFim };
}

export type TipoDependencia = 'FS' | 'SS' | 'FF' | 'SF';
export interface Dependencia { tarefa_id: string; depende_de_tarefa_id: string; tipo: TipoDependencia }

/** True quando a tarefa viola a dependência (ex.: FS = começa antes da anterior terminar). */
export function violaDependencia(tarefa: DatasTarefa, anterior: DatasTarefa, tipo: TipoDependencia): boolean {
  const ti = inicioDe(tarefa), tf = fimDe(tarefa), ai = inicioDe(anterior), af = fimDe(anterior);
  switch (tipo) {
    case 'FS': return !!(ti && af) && diferencaDias(af, ti) <= 0;
    case 'SS': return !!(ti && ai) && diferencaDias(ai, ti) < 0;
    case 'FF': return !!(tf && af) && diferencaDias(af, tf) < 0;
    case 'SF': return !!(tf && ai) && diferencaDias(ai, tf) < 0;
  }
}

export function conflitosDependencia<T extends DatasTarefa & { id: string }>(tarefas: T[], deps: Dependencia[]): Set<string> {
  const porId = new Map(tarefas.map((t) => [t.id, t]));
  const out = new Set<string>();
  deps.forEach((d) => {
    const t = porId.get(d.tarefa_id); const a = porId.get(d.depende_de_tarefa_id);
    if (t && a && violaDependencia(t, a, d.tipo)) out.add(t.id);
  });
  return out;
}

/** Período coberto pelas subtarefas datadas, se ultrapassar o da tarefa principal. */
export function periodoSubtarefasExcede(pai: DatasTarefa, filhos: DatasTarefa[]): { data_inicio: DataISO; data_fim: DataISO } | null {
  const inis = filhos.map(inicioDe).filter(Boolean) as DataISO[];
  const fins = filhos.map(fimDe).filter(Boolean) as DataISO[];
  if (!inis.length || !fins.length) return null;
  const minI = inis.reduce((a, b) => (a < b ? a : b));
  const maxF = fins.reduce((a, b) => (a > b ? a : b));
  const pi = inicioDe(pai); const pf = fimDe(pai);
  if (pi && pf && pi <= minI && pf >= maxF) return null;
  return { data_inicio: pi && pi < minI ? pi : minI, data_fim: pf && pf > maxF ? pf : maxF };
}

/** Desvio em dias do fim atual face à linha de base (positivo = atrasou). */
export function desvioLinhaBase(t: DatasTarefa & { baseline_fim?: string | null }): number | null {
  const f = fimDe(t);
  return f && t.baseline_fim ? diferencaDias(t.baseline_fim, f) : null;
}

/** Desloca várias tarefas X dias; tarefas sem data ficam de fora. */
export function deslocarLote<T extends DatasTarefa & { id: string }>(tarefas: T[], dias: number): { id: string; data_inicio: DataISO; data_fim: DataISO }[] {
  return tarefas.flatMap((t) => { const r = aplicarArrasto(t, dias, 'mover'); return r ? [{ id: t.id, ...r }] : []; });
}


/** Verdadeiro se "tarefaId depende de novaDepId" fecharia um ciclo (ou é ela mesma). */
export function criaCicloDependencia(deps: { tarefa_id: string; depende_de_tarefa_id: string }[], tarefaId: string, novaDepId: string): boolean {
  if (tarefaId === novaDepId) return true;
  const proximas = new Map<string, string[]>();
  deps.forEach((d) => { proximas.set(d.tarefa_id, [...(proximas.get(d.tarefa_id) ?? []), d.depende_de_tarefa_id]); });
  const pilha = [novaDepId]; const vistos = new Set<string>();
  while (pilha.length) {
    const atual = pilha.pop()!;
    if (atual === tarefaId) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    pilha.push(...(proximas.get(atual) ?? []));
  }
  return false;
}

/** Período inválido: fim antes do início (datas YYYY-MM-DD). */
export function periodoInvertido(inicio?: string | null, fim?: string | null): boolean {
  return !!inicio && !!fim && fim < inicio;
}
