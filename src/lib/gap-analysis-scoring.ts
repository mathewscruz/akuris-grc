/**
 * Cálculo canônico do score de conformidade de Gap Analysis.
 *
 * Denominador = requisitos APLICÁVEIS (exclui `nao_aplicavel`).
 * Não avaliados contam como 0 no numerador.
 * conforme=100, parcial=50, nao_conforme=0.
 *
 * Consolidado para evitar as três implementações independentes que já causaram
 * regressões (dashboard, card e detalhe do framework mostrando números diferentes).
 */
export const CONFORMITY_SCORE: Record<string, number> = {
  conforme: 100,
  parcial: 50,
  nao_conforme: 0,
};

export type EvaluationLite = { conformity_status?: string | null };

/**
 * Score 0-100 baseado no total de requisitos do framework e nas avaliações
 * já feitas. Requisitos sem avaliação contam como 0 no numerador mas continuam
 * no denominador (a menos que estejam marcados como N/A).
 */
export function computeConformityScore(
  evaluations: EvaluationLite[] | null | undefined,
  totalRequirements: number,
): number {
  const evals = evaluations || [];
  const naCount = evals.filter((e) => e.conformity_status === 'nao_aplicavel').length;
  const denominador = Math.max(totalRequirements - naCount, 0);
  if (denominador === 0) return 0;
  const numerador = evals
    .filter((e) => e.conformity_status && e.conformity_status !== 'nao_aplicavel')
    .reduce((sum, e) => sum + (CONFORMITY_SCORE[e.conformity_status as string] ?? 0), 0);
  return Math.round(numerador / denominador);
}

/**
 * Quantidade de requisitos "avaliados" (qualquer status diferente de
 * `nao_avaliado` e vazio; N/A conta como avaliado porque é uma decisão).
 */
export function countEvaluated(evaluations: EvaluationLite[] | null | undefined): number {
  return (evaluations || []).filter(
    (e) => e.conformity_status && e.conformity_status !== 'nao_avaliado',
  ).length;
}
