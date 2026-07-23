/**
 * Testes ponta a ponta do CONTRATO DE COMPLIANCE do DocGen.
 *
 * Cobrimos as três garantias que o usuário pediu:
 *   1) documento GERADO sai em compliance (score >= 80 quando coverage_map cobre os requisitos relevantes)
 *   2) REFINO de seção que preserva cláusulas mantém o score
 *   3) REFINO que remove cobertura reduz o score e sinaliza compliance_impact='reduced'
 *
 * Os testes rodam sobre as funções PURAS que a Edge Function usa — mesma
 * fórmula, sem depender do gateway da IA (o que tornaria o teste flaky/caro).
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeCoverageScore,
  applyRefineCoverage,
  complianceImpactFrom,
  resolveResultadoGeral,
  filterInScope,
  type CoverageItem,
  type NaoCobertoJustificativa,
} from "../_shared/compliance-score.ts";

// --- Fixture: documento típico gerado pelo DocGen para ISO 27001 "Mesa Limpa" ---
function fixtureCleanDeskGenerated() {
  const coverageMap: CoverageItem[] = [
    { requirement_codigo: "A.7.7", requirement_titulo: "Mesa limpa e tela limpa", section_indexes: [1, 2], evidencia: "Os colaboradores devem manter mesas livres..." },
    { requirement_codigo: "A.5.10", requirement_titulo: "Uso aceitável de informação", section_indexes: [1], evidencia: "As informações classificadas como Restritas..." },
    { requirement_codigo: "A.8.13", requirement_titulo: "Backup", section_indexes: [3], evidencia: "Cópias de segurança semanais..." },
    { requirement_codigo: "A.8.10", requirement_titulo: "Exclusão de informações", section_indexes: [4], evidencia: "Documentos impressos devem ser destruídos..." },
  ];
  const naoCobertos: NaoCobertoJustificativa[] = [
    { codigo: "A.5.7", motivo: "Fora do escopo desta política específica" },
    { codigo: "A.8.9", motivo: "Não aplicável — trata de gestão de configuração" },
  ];
  return { coverageMap, naoCobertos };
}

Deno.test("Onda 1 — documento gerado sai em compliance quando coverage_map cobre os requisitos relevantes", () => {
  const { coverageMap, naoCobertos } = fixtureCleanDeskGenerated();
  const score = computeCoverageScore(coverageMap, naoCobertos);
  // 4 cobertos / (4 cobertos + 0 relevantes-não-cobertos) = 100%
  assertEquals(score, 100);
  assertEquals(resolveResultadoGeral(score), "conforme");
});

Deno.test("Onda 1 — score cai quando existem requisitos relevantes sem cobertura", () => {
  const { coverageMap } = fixtureCleanDeskGenerated();
  const naoCobertos: NaoCobertoJustificativa[] = [
    { codigo: "A.5.15", motivo: "não conseguimos endereçar controles de acesso nesta política" },
    { codigo: "A.5.16", motivo: "gestão de identidade precisa entrar em política específica" },
  ];
  const score = computeCoverageScore(coverageMap, naoCobertos);
  // 4 / (4 + 2) = 67%
  assertEquals(score, 67);
  assertEquals(resolveResultadoGeral(score), "parcial");
});

Deno.test("Onda 1 — 'fora de escopo' e 'não aplicável' são excluídos do denominador", () => {
  const naoCobertos: NaoCobertoJustificativa[] = [
    { codigo: "A.5.7", motivo: "Fora do escopo desta política específica" },
    { codigo: "A.8.9", motivo: "não aplicável a política de mesa limpa" },
    { codigo: "A.9.1", motivo: "não aplicavel" },
  ];
  const inScope = filterInScope(naoCobertos);
  assertEquals(inScope.length, 0);
});

Deno.test("Onda 2 — refino que PRESERVA cobertura mantém score e sinaliza 'preserved'", () => {
  const { coverageMap, naoCobertos } = fixtureCleanDeskGenerated();
  const scoreAntes = computeCoverageScore(coverageMap, naoCobertos);

  const next = applyRefineCoverage({
    currentCoverage: coverageMap,
    sectionIndex: 1,
    removedCodes: [],
    keptCodes: ["A.7.7", "A.5.10"],
    evidenceUpdates: [["A.7.7", "Colaboradores mantêm as mesas livres ao fim de cada expediente..."]],
  });

  const scoreDepois = computeCoverageScore(next, naoCobertos);
  const impact = complianceImpactFrom(0);

  assertEquals(next.length, coverageMap.length, "nenhum requisito perdido");
  assertEquals(scoreDepois, scoreAntes);
  assertEquals(impact, "preserved");
  const a77 = next.find((c) => c.requirement_codigo === "A.7.7");
  assert(a77?.evidencia?.startsWith("Colaboradores mantêm as mesas livres"), "evidência foi atualizada");
});

Deno.test("Onda 2 — refino que REMOVE cobertura reduz o score e sinaliza 'reduced'", () => {
  const { coverageMap, naoCobertos } = fixtureCleanDeskGenerated();
  const scoreAntes = computeCoverageScore(coverageMap, naoCobertos);

  // usuário pede "simplificar" e a IA remove uma cláusula que sustentava A.8.13 (backup)
  const removed = ["A.8.13"];
  const next = applyRefineCoverage({
    currentCoverage: coverageMap,
    sectionIndex: 3,
    removedCodes: removed,
  });
  const scoreDepois = computeCoverageScore(next, naoCobertos, removed.length);
  const impact = complianceImpactFrom(removed.length);

  assert(scoreDepois < scoreAntes, `esperado score menor após remoção — antes=${scoreAntes} depois=${scoreDepois}`);
  assertEquals(next.length, coverageMap.length - 1);
  assertEquals(impact, "reduced");
  assert(!next.some((c) => c.requirement_codigo === "A.8.13"));
});

Deno.test("Onda 2 — refino de OUTRA seção nunca toca cobertura de seções vizinhas", () => {
  const { coverageMap } = fixtureCleanDeskGenerated();
  const next = applyRefineCoverage({
    currentCoverage: coverageMap,
    sectionIndex: 99, // seção que não existe no coverage map
    removedCodes: ["A.7.7", "A.5.10"], // devem ser IGNORADOS porque não pertencem à seção 99
  });
  assertEquals(next.length, coverageMap.length, "nada removido — códigos não pertencem à seção alvo");
});

Deno.test("Onda 2 — remoção NÃO confirmada em coverage_kept é preservada (compliance-first)", () => {
  const { coverageMap } = fixtureCleanDeskGenerated();
  // A IA não devolveu nem removed_coverage nem coverage_kept para A.7.7 — a regra é preservar
  const next = applyRefineCoverage({
    currentCoverage: coverageMap,
    sectionIndex: 1,
    removedCodes: [],
    keptCodes: ["A.5.10"], // A.7.7 fica de fora, MAS não foi marcada como removida
  });
  assert(next.some((c) => c.requirement_codigo === "A.7.7"), "A.7.7 mantido por segurança");
});
