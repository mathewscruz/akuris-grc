/**
 * Testes do contrato de compliance do ANALISADOR (analyze-document-adherence)
 * e do quick_adherence do docgen-chat — todos usam o mesmo módulo determinístico
 * em `_shared/compliance-score.ts`.
 *
 * Cenários cobertos:
 *   1) documento com todos os requisitos "conforme" → score 100 e resultado_geral='conforme'
 *   2) requisitos silenciosamente omitidos pela IA entram como nao_conforme (não inflam score)
 *   3) `nao_aplicavel` sai do denominador
 *   4) score reportado pela IA que diverge do determinístico em mais de 25 pontos é sobrescrito
 *   5) documento vazio devolve score 0 sem quebrar
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeAnalyzedScore,
  reconcileReportedScore,
  resolveResultadoGeral,
  type RequisitoAnalisado,
} from "../_shared/compliance-score.ts";

function makeAnalisados(
  conformes: number,
  parciais: number,
  naoConformes: number,
  na: number,
): RequisitoAnalisado[] {
  const list: RequisitoAnalisado[] = [];
  for (let i = 0; i < conformes; i++) list.push({ requisito_codigo: `C${i}`, status_aderencia: "conforme" });
  for (let i = 0; i < parciais; i++) list.push({ requisito_codigo: `P${i}`, status_aderencia: "parcial" });
  for (let i = 0; i < naoConformes; i++) list.push({ requisito_codigo: `N${i}`, status_aderencia: "nao_conforme" });
  for (let i = 0; i < na; i++) list.push({ requisito_codigo: `A${i}`, status_aderencia: "nao_aplicavel" });
  return list;
}

Deno.test("Analisador — documento com todos conformes → score 100 e resultado 'conforme'", () => {
  const analisados = makeAnalisados(10, 0, 0, 0);
  const { score, contagem } = computeAnalyzedScore(analisados);
  assertEquals(score, 100);
  assertEquals(contagem.conformes, 10);
  assertEquals(resolveResultadoGeral(score), "conforme");
});

Deno.test("Analisador — mix de status usa a fórmula canônica (100/50/0)", () => {
  const analisados = makeAnalisados(4, 2, 2, 0); // (4*100 + 2*50 + 2*0)/8 = 62.5 → 63
  const { score } = computeAnalyzedScore(analisados);
  assertEquals(score, 63);
  assertEquals(resolveResultadoGeral(score), "parcial");
});

Deno.test("Analisador — nao_aplicavel sai do denominador", () => {
  const analisados = makeAnalisados(3, 0, 0, 5); // 3 conformes / 3 = 100
  const { score, contagem } = computeAnalyzedScore(analisados);
  assertEquals(score, 100);
  assertEquals(contagem.nao_aplicaveis, 5);
});

Deno.test("Analisador — requisitos silenciosamente omitidos entram como nao_conforme (evita inflação em PCI/CIS)", () => {
  const analisados = makeAnalisados(10, 0, 0, 0); // IA só avaliou 10
  // Framework tem 100 requisitos → 90 silenciosamente omitidos
  const { score } = computeAnalyzedScore(analisados, 90);
  // (10*100) / (10 + 90) = 10%
  assertEquals(score, 10);
  assertEquals(resolveResultadoGeral(score), "nao_conforme");
});

Deno.test("Analisador — reconciliação: score reportado 0% enquanto há vários conformes é sobrescrito pelo determinístico", () => {
  const analisados = makeAnalisados(8, 2, 0, 0); // determinístico = 90
  const det = computeAnalyzedScore(analisados).score;
  const { score, source } = reconcileReportedScore(0, det);
  assertEquals(source, "deterministic");
  assertEquals(score, det);
});

Deno.test("Analisador — reconciliação: score reportado coerente (delta<=25) é mantido", () => {
  const analisados = makeAnalisados(8, 2, 0, 0); // determinístico = 90
  const det = computeAnalyzedScore(analisados).score;
  const { score, source } = reconcileReportedScore(85, det); // delta = 5
  assertEquals(source, "ia");
  assertEquals(score, 85);
});

Deno.test("Analisador — reconciliação: divergência > 25 pontos → determinístico vence (evita IA inflar score)", () => {
  const analisados = makeAnalisados(2, 0, 8, 0); // determinístico = 20
  const det = computeAnalyzedScore(analisados).score;
  const { score, source } = reconcileReportedScore(95, det); // IA reportou 95%, absurdo
  assertEquals(source, "deterministic");
  assertEquals(score, 20);
});

Deno.test("Analisador — nenhum requisito → score 0, sem quebrar", () => {
  const { score, contagem } = computeAnalyzedScore([]);
  assertEquals(score, 0);
  assertEquals(contagem.total, 0);
});

Deno.test("Fluxo E2E — DocGen gera 100%, refino remove 1 requisito, análise formal reflete a queda", () => {
  // Simula o pipeline completo em memória:
  // 1) generate_document → coverage 5, sem gap in-scope → 100%
  // 2) refine_section remove A.8.13 → coverage 4, denom 5 → 80%
  // 3) analyze-document-adherence roda com os 5 requisitos originais →
  //    IA avalia como 4 conformes + 1 nao_conforme (o removido)

  const analisadosPosRefino: RequisitoAnalisado[] = [
    { requisito_codigo: "A.7.7", status_aderencia: "conforme" },
    { requisito_codigo: "A.5.10", status_aderencia: "conforme" },
    { requisito_codigo: "A.8.10", status_aderencia: "conforme" },
    { requisito_codigo: "A.5.15", status_aderencia: "conforme" },
    { requisito_codigo: "A.8.13", status_aderencia: "nao_conforme" }, // removido no refino
  ];
  const { score } = computeAnalyzedScore(analisadosPosRefino);
  // (4*100 + 0 + 0)/5 = 80
  assertEquals(score, 80);
  assertEquals(resolveResultadoGeral(score), "conforme");
  assert(score < 100, "análise formal capturou a queda do refino");
});
