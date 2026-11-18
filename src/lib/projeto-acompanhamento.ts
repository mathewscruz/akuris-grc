/**
 * Indicadores de acompanhamento de cronograma (mesma lógica do painel de
 * planilhas de implementação): só as atividades-folha contam — fases e
 * domínios são agrupadores e duplicariam o progresso.
 */
import type { ProjetoTarefa } from '@/types/projetos';
import { parseDataLocal } from '@/lib/date-utils';

export const TAG_MARCO = 'marco';

export const isMarco = (t: Pick<ProjetoTarefa, 'tags'>) => (t.tags ?? []).includes(TAG_MARCO);

export function folhas(tarefas: ProjetoTarefa[]): ProjetoTarefa[] {
  const pais = new Set(tarefas.map((t) => t.parent_task_id).filter(Boolean) as string[]);
  return tarefas.filter((t) => !pais.has(t.id));
}

/** Atrasada = prazo/fim vencido e progresso abaixo de 100%. */
export function estaAtrasada(t: ProjetoTarefa, hoje = new Date()): boolean {
  const fim = t.data_fim ?? t.prazo;
  if (!fim || t.concluida_em || (t.progresso_pct ?? 0) >= 100) return false;
  const d = parseDataLocal(fim);
  d.setHours(23, 59, 59, 999);
  return d < hoje;
}

/** Fração (0–1) do período da tarefa já decorrida em `hoje`. */
function fracaoPlanejada(t: ProjetoTarefa, hoje: Date): number {
  const ini = t.data_inicio ?? t.data_fim ?? t.prazo;
  const fim = t.data_fim ?? t.prazo ?? t.data_inicio;
  if (!ini || !fim) return 0;
  const a = parseDataLocal(ini).getTime();
  const b = parseDataLocal(fim).getTime() + 86400000;
  const h = hoje.getTime();
  if (h <= a) return 0;
  if (h >= b) return 1;
  return (h - a) / (b - a);
}

export function indicadores(tarefas: ProjetoTarefa[], hoje = new Date()) {
  const f = folhas(tarefas);
  const total = f.length;
  const media = (xs: number[]) => (xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : 0);
  const progresso = media(f.map((t) => Math.min(100, Math.max(0, t.progresso_pct ?? 0)))) / 100;
  const planejado = media(f.map((t) => fracaoPlanejada(t, hoje)));
  const concluidas = f.filter((t) => t.concluida_em || (t.progresso_pct ?? 0) >= 100).length;
  const atrasadas = f.filter((t) => estaAtrasada(t, hoje)).length;
  const proximoMarco = f
    .filter((t) => isMarco(t) && !t.concluida_em && (t.progresso_pct ?? 0) < 100 && (t.data_fim ?? t.prazo))
    .sort((a, b) => String(a.data_fim ?? a.prazo).localeCompare(String(b.data_fim ?? b.prazo)))[0] ?? null;
  return { total, progresso, planejado, concluidas, atrasadas, proximoMarco };
}

/** Progresso médio das folhas sob cada tarefa de topo (fases). */
export function progressoPorFase(tarefas: ProjetoTarefa[]) {
  const porId = new Map(tarefas.map((t) => [t.id, t]));
  const raiz = (t: ProjetoTarefa): ProjetoTarefa => {
    let cur = t;
    const vistos = new Set<string>();
    while (cur.parent_task_id && porId.has(cur.parent_task_id) && !vistos.has(cur.id)) {
      vistos.add(cur.id);
      cur = porId.get(cur.parent_task_id)!;
    }
    return cur;
  };
  const grupos = new Map<string, { fase: ProjetoTarefa; valores: number[] }>();
  folhas(tarefas).forEach((t) => {
    const r = raiz(t);
    if (r.id === t.id) return;
    if (!grupos.has(r.id)) grupos.set(r.id, { fase: r, valores: [] });
    grupos.get(r.id)!.valores.push(t.progresso_pct ?? 0);
  });
  return [...grupos.values()]
    .sort((a, b) => (a.fase.ordem ?? 0) - (b.fase.ordem ?? 0))
    .map(({ fase, valores }) => ({
      id: fase.id,
      titulo: fase.titulo,
      total: valores.length,
      progresso: Math.round(valores.reduce((s, n) => s + n, 0) / valores.length),
    }));
}

/** Chave AAAA-MM do mês de início, para a visão "Plano mensal". */
export function mesInicio(t: ProjetoTarefa): string | null {
  const d = t.data_inicio ?? t.data_fim ?? t.prazo;
  return d ? String(d).slice(0, 7) : null;
}

const concluida = (t: ProjetoTarefa) => !!t.concluida_em || (t.progresso_pct ?? 0) >= 100;
const diaMs = (s: string) => parseDataLocal(s).getTime();

/**
 * "Você deveria estar aqui": posição de hoje numa lista ordenada por período.
 * `ordem` = tarefas na ordem de exibição; `ehFolha` diz quem conta (agrupadores não).
 * indice = posição antes da qual o marcador entra (ordem.length = no fim).
 */
export function calcularPosicaoHoje(
  ordem: ProjetoTarefa[],
  ehFolha: (t: ProjetoTarefa) => boolean,
  hoje = new Date(),
) {
  const h = new Date(hoje); h.setHours(0, 0, 0, 0);
  const hMs = h.getTime();
  let indice = ordem.length;
  const emCurso: string[] = [];
  const atrasadas: string[] = [];
  const adiantadas: string[] = [];
  ordem.forEach((t, i) => {
    if (!ehFolha(t)) return;
    const ini = t.data_inicio ?? t.data_fim ?? t.prazo;
    const fim = t.data_fim ?? t.prazo ?? t.data_inicio;
    if (!ini || !fim) return;
    const a = diaMs(ini); const b = diaMs(fim);
    if (a > hMs) {
      if (indice === ordem.length) indice = i;
      if (concluida(t)) adiantadas.push(t.id);
    } else if (b < hMs) {
      if (!concluida(t)) atrasadas.push(t.id);
    } else if (!concluida(t)) emCurso.push(t.id);
  });
  // Recuar até ao agrupador pai imediatamente acima para não partir uma fase a meio do cabeçalho.
  while (indice > 0 && indice < ordem.length && !ehFolha(ordem[indice - 1]) && ordem[indice].parent_task_id === ordem[indice - 1].id) indice--;
  const ritmo: 'adiantado' | 'atrasado' | 'no_ritmo' = atrasadas.length ? 'atrasado' : adiantadas.length ? 'adiantado' : 'no_ritmo';
  return { indice, emCurso, atrasadas, adiantadas, ritmo };
}


export type OrdemGantt = 'estrutura' | 'inicio' | 'prazo';

/** Ordena tarefas por data (início ou prazo); sem data vão para o fim. */
export function ordenarTarefasPorData<T extends { data_inicio?: string | null; data_fim?: string | null; prazo?: string | null; ordem?: number | null }>(
  tarefas: T[], ordem: Exclude<OrdemGantt, 'estrutura'>,
): T[] {
  const chave = (x: T) => (ordem === 'inicio' ? x.data_inicio ?? x.prazo ?? x.data_fim : x.data_fim ?? x.prazo ?? x.data_inicio) ?? null;
  return tarefas.slice().sort((a, b) => {
    const ka = chave(a); const kb = chave(b);
    if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
    if (ka && !kb) return -1;
    if (!ka && kb) return 1;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
}

/**
 * Período herdado para desenhar uma tarefa sem data no Gantt: o do ancestral
 * mais próximo que tenha período (próprio ou resumo dos filhos datados).
 * Só serve para desenho — nunca é gravado nem entra em resumos/escala.
 */
export function periodoHerdado<T extends { id: string; parent_task_id?: string | null }>(
  tarefa: T,
  porId: Map<string, T>,
  periodoDe: (t: T) => { ini: number; fim: number } | null,
): { ini: number; fim: number } | null {
  let p = tarefa.parent_task_id; let guarda = 0;
  while (p && porId.has(p) && guarda++ < 20) {
    const pai = porId.get(p)!;
    const iv = periodoDe(pai);
    if (iv) return iv;
    p = pai.parent_task_id;
  }
  return null;
}

/**
 * Ordena por data mantendo a hierarquia: irmãos são ordenados pela data
 * (grupos pela menor data dos descendentes); sem data vão para o fim do seu
 * nível, ainda dentro do pai. Devolve a lista achatada com profundidade.
 */
export function ordenarArvorePorData<T extends { id: string; parent_task_id?: string | null; data_inicio?: string | null; data_fim?: string | null; prazo?: string | null; ordem?: number | null }>(
  tarefas: T[], ordem: Exclude<OrdemGantt, 'estrutura'>, recolhidos: Set<string> = new Set(),
): { t: T; depth: number }[] {
  const ids = new Set(tarefas.map((x) => x.id));
  const filhos = new Map<string, T[]>();
  const raiz: T[] = [];
  tarefas.forEach((x) => {
    if (x.parent_task_id && ids.has(x.parent_task_id)) {
      const l = filhos.get(x.parent_task_id) ?? []; l.push(x); filhos.set(x.parent_task_id, l);
    } else raiz.push(x);
  });
  const propria = (x: T) => (ordem === 'inicio' ? x.data_inicio ?? x.prazo ?? x.data_fim : x.data_fim ?? x.prazo ?? x.data_inicio) ?? null;
  const memo = new Map<string, string | null>();
  const chave = (x: T, guarda = 0): string | null => {
    if (memo.has(x.id)) return memo.get(x.id)!;
    let k = propria(x);
    if (guarda < 20) for (const c of filhos.get(x.id) ?? []) { const kc = chave(c, guarda + 1); if (kc && (!k || kc < k)) k = kc; }
    memo.set(x.id, k); return k;
  };
  const sort = (l: T[]) => l.slice().sort((a, b) => {
    const ka = chave(a); const kb = chave(b);
    if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
    if (ka && !kb) return -1;
    if (!ka && kb) return 1;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
  const out: { t: T; depth: number }[] = [];
  const push = (x: T, d: number) => {
    out.push({ t: x, depth: d });
    if (recolhidos.has(x.id) || d > 20) return;
    sort(filhos.get(x.id) ?? []).forEach((c) => push(c, d + 1));
  };
  sort(raiz).forEach((r) => push(r, 0));
  return out;
}
