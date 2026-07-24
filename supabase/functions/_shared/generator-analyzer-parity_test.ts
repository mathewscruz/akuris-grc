/**
 * Paridade determinística entre GERADOR (docgen-chat/generate_document) e
 * ANALISADOR (analyze-document-adherence). Testes puros sobre as funções de
 * `compliance-score.ts` para provar que, dado o MESMO universo de requisitos e
 * cobertura, os dois lados convergem para o MESMO percentual.
 *
 * Não substitui um E2E real com LLM — prova apenas que a matemática é
 * consistente. A variabilidade residual é do julgamento do modelo, não da
 * fórmula.
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  computeCoverageScore,
  computeAnalyzedScore,
  expandNaoCobertosFromCatalog,
  filterInScope,
  resolveResultadoGeral,
  AUDIT_THRESHOLD,
} from "./compliance-score.ts";

// Catálogo sintético representando um framework de 20 requisitos.
const CATALOGO_20 = Array.from({ length: 20 }, (_, i) => `R.${i + 1}`);

Deno.test("paridade: cobertura completa (100%) — gerador e analisador coincidem em 100", () => {
  const coverageMap = CATALOGO_20.map((c) => ({
    requirement_codigo: c,
    requirement_titulo: `Requisito ${c}`,
    section_indexes: [0],
    evidencia: `Cláusula que satisfaz ${c}`,
  }));

  const naoCobertosExpandidos = expandNaoCobertosFromCatalog(CATALOGO_20, coverageMap, []);
  const scoreGerador = computeCoverageScore(coverageMap, naoCobertosExpandidos);

  const analisados = CATALOGO_20.map((c) => ({ requisito_codigo: c, status_aderencia: "conforme" as const }));
  const { score: scoreAnalisador } = computeAnalyzedScore(analisados, 0);

  assertEquals(scoreGerador, 100);
  assertEquals(scoreAnalisador, 100);
  assertEquals(resolveResultadoGeral(scoreGerador), "conforme");
});

Deno.test("paridade: fora do escopo simétrico é neutro nos dois lados", () => {
  // Documento cobre 15 dos 20; 5 são declarados "fora do escopo" no gerador
  // e vêm como "nao_aplicavel" no analisador (o auditor concordou com o escopo).
  const cobertos = CATALOGO_20.slice(0, 15);
  const foraEscopo = CATALOGO_20.slice(15);

  const coverageMap = cobertos.map((c) => ({ requirement_codigo: c, evidencia: `ok ${c}` }));
  const naoCobertos = foraEscopo.map((c) => ({ codigo: c, motivo: "fora do escopo deste documento" }));
  const naoCobertosExpandidos = expandNaoCobertosFromCatalog(CATALOGO_20, coverageMap, naoCobertos);
  const scoreGerador = computeCoverageScore(coverageMap, naoCobertosExpandidos);

  const analisados = [
    ...cobertos.map((c) => ({ requisito_codigo: c, status_aderencia: "conforme" as const })),
    ...foraEscopo.map((c) => ({ requisito_codigo: c, status_aderencia: "nao_aplicavel" as const })),
  ];
  const { score: scoreAnalisador } = computeAnalyzedScore(analisados, 0);

  assertEquals(scoreGerador, 100);
  assertEquals(scoreAnalisador, 100);
  assertEquals(filterInScope(naoCobertosExpandidos).length, 0);
});

Deno.test("silêncio no analisador penaliza — gerador não sabe, analisador sabe (comportamento correto)", () => {
  // Cenário: gerador declarou cobrir todos os 20, mas o analisador só devolveu
  // 15 requisitos (5 silenciosamente omitidos). O analisador DEVE penalizar
  // via silently_missing, enquanto o gerador continua reportando 100 (ele não
  // tem como saber que o auditor omitiu itens). O contrato do sistema é: o
  // score que VALE para publicação é o do analisador.
  const coverageMap = CATALOGO_20.map((c) => ({ requirement_codigo: c, evidencia: `ok ${c}` }));
  const scoreGerador = computeCoverageScore(coverageMap, expandNaoCobertosFromCatalog(CATALOGO_20, coverageMap, []));

  const analisados = CATALOGO_20.slice(0, 15).map((c) => ({
    requisito_codigo: c,
    status_aderencia: "conforme" as const,
  }));
  const { score: scoreAnalisador, contagem } = computeAnalyzedScore(analisados, 5);

  assertEquals(scoreGerador, 100);
  // 15 conformes * 100 / (15 avaliados + 5 missing) = 1500 / 20 = 75
  assertEquals(scoreAnalisador, 75);
  assertEquals(contagem.silently_missing, 5);
});

Deno.test("cobertura parcial: gerador reporta X%, analisador que marca faltantes como nao_conforme reporta o mesmo X%", () => {
  // 18 cobertos, 2 in-scope não cobertos. Gerador: 18/20 = 90.
  // Analisador que reconhecer 18 conformes + 2 nao_conforme: 1800/20 = 90.
  const cobertos = CATALOGO_20.slice(0, 18);
  const naoCobertos = CATALOGO_20.slice(18).map((c) => ({ codigo: c, motivo: "não coberto pela versão atual" }));

  const coverageMap = cobertos.map((c) => ({ requirement_codigo: c, evidencia: `ok ${c}` }));
  const scoreGerador = computeCoverageScore(coverageMap, naoCobertos);

  const analisados = [
    ...cobertos.map((c) => ({ requisito_codigo: c, status_aderencia: "conforme" as const })),
    ...CATALOGO_20.slice(18).map((c) => ({ requisito_codigo: c, status_aderencia: "nao_conforme" as const })),
  ];
  const { score: scoreAnalisador } = computeAnalyzedScore(analisados, 0);

  assertEquals(scoreGerador, 90);
  assertEquals(scoreAnalisador, 90);
});

Deno.test("piso operacional AUDIT_THRESHOLD=80 filtra publicação de docs abaixo do gate", () => {
  // Prova que a constante compartilhada bloqueia publicação em documentos com
  // ≤ 79% via `resolveResultadoGeral` (que classifica ≥ 80 como "conforme").
  assertEquals(AUDIT_THRESHOLD, 80);
  assertEquals(resolveResultadoGeral(79), "parcial");
  assertEquals(resolveResultadoGeral(80), "conforme");
  assertEquals(resolveResultadoGeral(100), "conforme");
});
