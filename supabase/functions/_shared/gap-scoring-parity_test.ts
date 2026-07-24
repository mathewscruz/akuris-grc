/**
 * Paridade entre o scoring do Gap Analysis (frontend) e o scoring do analisador
 * de aderência (Edge Functions). Ambos precisam devolver o MESMO score para o
 * mesmo conjunto de status — caso contrário o documento "gerado em compliance"
 * pelo DocGen aparece com nota diferente no Gap Analysis.
 *
 * A lógica canônica do frontend vive em `src/lib/gap-analysis-scoring.ts`.
 * Como Deno não importa `src/`, reimplementamos aqui e comparamos com
 * `computeAnalyzedScore` do módulo compartilhado das Edge Functions.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeAnalyzedScore, type RequisitoAnalisado } from "./compliance-score.ts";

// Réplica exata de src/lib/gap-analysis-scoring.ts (mantida em sincronia por este teste).
const CONFORMITY_SCORE: Record<string, number> = { conforme: 100, parcial: 50, nao_conforme: 0 };
function frontendComputeConformityScore(
  evaluations: Array<{ conformity_status?: string | null }>,
  totalRequirements: number,
): number {
  const naCount = evaluations.filter((e) => e.conformity_status === "nao_aplicavel").length;
  const denominador = Math.max(totalRequirements - naCount, 0);
  if (denominador === 0) return 0;
  const numerador = evaluations
    .filter((e) => e.conformity_status && e.conformity_status !== "nao_aplicavel")
    .reduce((s, e) => s + (CONFORMITY_SCORE[e.conformity_status as string] ?? 0), 0);
  return Math.round(numerador / denominador);
}

// Converte o mesmo dataset para o formato do analisador. Requisitos sem avaliação
// no Gap Analysis viram `silentlyMissing` no analisador (ambos contam como 0).
function toAnalyzer(
  evaluations: Array<{ conformity_status?: string | null }>,
  totalRequirements: number,
): { analisados: RequisitoAnalisado[]; silentlyMissing: number } {
  const analisados: RequisitoAnalisado[] = evaluations
    .filter((e) => e.conformity_status)
    .map((e, i) => ({
      requisito_codigo: `R${i}`,
      status_aderencia: e.conformity_status as any,
    }));
  const evaluated = evaluations.filter(
    (e) => e.conformity_status && e.conformity_status !== "nao_aplicavel",
  ).length;
  const na = evaluations.filter((e) => e.conformity_status === "nao_aplicavel").length;
  const silentlyMissing = Math.max(totalRequirements - evaluated - na, 0);
  return { analisados, silentlyMissing };
}

Deno.test("Paridade Gap ⇄ Analisador — todos conformes", () => {
  const data = Array.from({ length: 10 }, () => ({ conformity_status: "conforme" }));
  const front = frontendComputeConformityScore(data, 10);
  const { analisados } = toAnalyzer(data, 10);
  const back = computeAnalyzedScore(analisados).score;
  assertEquals(front, back);
  assertEquals(front, 100);
});

Deno.test("Paridade — mix 100/50/0 sobre 8 aplicáveis", () => {
  const data = [
    ...Array(4).fill({ conformity_status: "conforme" }),
    ...Array(2).fill({ conformity_status: "parcial" }),
    ...Array(2).fill({ conformity_status: "nao_conforme" }),
  ];
  const front = frontendComputeConformityScore(data, 8);
  const { analisados } = toAnalyzer(data, 8);
  const back = computeAnalyzedScore(analisados).score;
  assertEquals(front, back);
  assertEquals(front, 63);
});

Deno.test("Paridade — nao_aplicavel sai do denominador em ambos", () => {
  const data = [
    ...Array(3).fill({ conformity_status: "conforme" }),
    ...Array(5).fill({ conformity_status: "nao_aplicavel" }),
  ];
  const front = frontendComputeConformityScore(data, 8);
  const { analisados } = toAnalyzer(data, 8);
  const back = computeAnalyzedScore(analisados).score;
  assertEquals(front, back);
  assertEquals(front, 100);
});

Deno.test("Paridade — requisitos silenciosamente omitidos = não avaliados no Gap", () => {
  // Gap Analysis: 5 conformes de um framework de 10 requisitos = 50%.
  // Analisador: 5 conformes + 5 silentlyMissing = (5*100)/10 = 50%.
  const data = Array.from({ length: 5 }, () => ({ conformity_status: "conforme" }));
  const front = frontendComputeConformityScore(data, 10);
  const { analisados, silentlyMissing } = toAnalyzer(data, 10);
  const back = computeAnalyzedScore(analisados, silentlyMissing).score;
  assertEquals(front, back);
  assertEquals(front, 50);
});

Deno.test("Paridade — regressão 22 requisitos (10c/5p/2NA/5 sem avaliação)", () => {
  const data = [
    ...Array(10).fill({ conformity_status: "conforme" }),
    ...Array(5).fill({ conformity_status: "parcial" }),
    ...Array(2).fill({ conformity_status: "nao_aplicavel" }),
  ];
  const front = frontendComputeConformityScore(data, 22);
  const { analisados, silentlyMissing } = toAnalyzer(data, 22);
  const back = computeAnalyzedScore(analisados, silentlyMissing).score;
  assertEquals(front, back);
  assertEquals(front, 63);
});

Deno.test("Paridade — framework vazio → 0 em ambos", () => {
  assertEquals(frontendComputeConformityScore([], 0), 0);
  assertEquals(computeAnalyzedScore([]).score, 0);
});
