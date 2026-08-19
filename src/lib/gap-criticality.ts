/**
 * Definição ÚNICA de "gap" e "gap crítico" no Gap Analysis.
 *
 * Existiam três leituras diferentes na aplicação (cartão "Gaps a tratar",
 * leitura do Akuris e fila de prioridades). Todas passam a usar estas funções.
 *
 * Regras:
 *  - Gap em aberto  = requisito avaliado como `nao_conforme`.
 *  - Gap crítico    = gap em aberto com peso alto (>= 4) OU com prazo vencido.
 *  - Gap atrasado   = gap em aberto com prazo de implementação no passado.
 */

/**
 * Peso mínimo a partir do qual um requisito não conforme é crítico.
 *
 * Era 4, e o maior peso que existe no produto é 3 — os três frameworks com
 * requisitos pesados (390, 407 e 776 linhas) topam em 3. O resultado: "Gaps a
 * tratar 49 · críticos 0" com 30 gaps de peso máximo na Nexure, a fila de
 * prioridades nunca a imprimir "alta criticidade", e o balde de esforço alto
 * sempre vazio. `prazo_implementacao` é nulo em todas as 157 avaliações, por
 * isso o segundo critério de `isGapCritico` também nunca dispara.
 */
export const GAP_CRITICAL_WEIGHT = 3;

export interface GapLike {
  conformity_status?: string | null;
  /** Peso/criticidade do requisito (1-5). Sem valor assume 3. */
  peso?: number | null;
  prazo_implementacao?: string | null;
}

export function isGapAberto(status: string | null | undefined): boolean {
  return status === 'nao_conforme';
}

export function isGapAtrasado(prazo: string | null | undefined): boolean {
  if (!prazo) return false;
  const ts = new Date(prazo).getTime();
  if (Number.isNaN(ts)) return false;
  return ts < Date.now();
}

export function isGapCritico(gap: GapLike): boolean {
  if (!isGapAberto(gap.conformity_status)) return false;
  const peso = Number(gap.peso ?? 3);
  return peso >= GAP_CRITICAL_WEIGHT || isGapAtrasado(gap.prazo_implementacao);
}

export interface GapSummary {
  /** Requisitos não conformes. */
  abertos: number;
  /** Subconjunto dos abertos que é crítico (peso alto ou prazo vencido). */
  criticos: number;
  /** Subconjunto dos abertos com prazo vencido. */
  atrasados: number;
}

export function summarizeGaps(gaps: GapLike[]): GapSummary {
  return gaps.reduce<GapSummary>(
    (acc, gap) => {
      if (!isGapAberto(gap.conformity_status)) return acc;
      acc.abertos += 1;
      if (isGapCritico(gap)) acc.criticos += 1;
      if (isGapAtrasado(gap.prazo_implementacao)) acc.atrasados += 1;
      return acc;
    },
    { abertos: 0, criticos: 0, atrasados: 0 },
  );
}

export const EMPTY_GAP_SUMMARY: GapSummary = { abertos: 0, criticos: 0, atrasados: 0 };
