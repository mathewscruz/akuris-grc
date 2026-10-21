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
