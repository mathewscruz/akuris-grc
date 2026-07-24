/**
 * Testes determinísticos do scoring canônico do Gap Analysis.
 *
 * Trava a fórmula compartilhada por Dashboard, FrameworkCard, GapAnalysisFrameworkDetail,
 * SoA e useGapAnalysisStats:
 *   - conforme=100, parcial=50, nao_conforme=0
 *   - `nao_aplicavel` sai do denominador
 *   - requisitos SEM avaliação contam como 0 no numerador mas ficam no denominador
 *   - totalRequirements=0 → score 0 sem NaN
 *
 * Regressão explícita do bug "50% vs 48%" que já corrigimos duas vezes.
 */
import { describe, it, expect } from 'vitest';
import {
  computeConformityScore,
  countEvaluated,
  CONFORMITY_SCORE,
  type EvaluationLite,
} from '../gap-analysis-scoring';

const evals = (spec: Record<string, number>): EvaluationLite[] => {
  const out: EvaluationLite[] = [];
  Object.entries(spec).forEach(([status, n]) => {
    for (let i = 0; i < n; i++) out.push({ conformity_status: status });
  });
  return out;
};

describe('CONFORMITY_SCORE', () => {
  it('mantém 100 / 50 / 0 — mudar isso quebra todo relatório e certificação', () => {
    expect(CONFORMITY_SCORE).toEqual({ conforme: 100, parcial: 50, nao_conforme: 0 });
  });
});

describe('computeConformityScore — fórmula canônica', () => {
  it('todos conformes → 100', () => {
    expect(computeConformityScore(evals({ conforme: 10 }), 10)).toBe(100);
  });

  it('mix 100/50/0 sobre 8 requisitos aplicáveis: (4*100 + 2*50 + 2*0)/8 = 63', () => {
    expect(computeConformityScore(evals({ conforme: 4, parcial: 2, nao_conforme: 2 }), 8)).toBe(63);
  });

  it('nao_aplicavel sai do denominador (3 conformes de 3 aplicáveis = 100 mesmo com 5 N/A)', () => {
    const data = evals({ conforme: 3, nao_aplicavel: 5 });
    expect(computeConformityScore(data, 8)).toBe(100);
  });

  it('requisitos SEM avaliação contam como 0 no numerador mas continuam no denominador', () => {
    // 5 conformes avaliados, mas o framework tem 10 requisitos no total → (5*100)/10 = 50
    expect(computeConformityScore(evals({ conforme: 5 }), 10)).toBe(50);
  });

  it('totalRequirements = 0 → score 0 (nunca NaN)', () => {
    expect(computeConformityScore([], 0)).toBe(0);
    expect(computeConformityScore(null, 0)).toBe(0);
    expect(computeConformityScore(undefined, 0)).toBe(0);
  });

  it('lista vazia mas framework tem requisitos → 0 (nada avaliado)', () => {
    expect(computeConformityScore([], 20)).toBe(0);
  });

  it('regressão "50% vs 48%": 10 conformes + 5 parciais + 5 não avaliados + 2 N/A em 22 requisitos', () => {
    // Denom aplicável = 22 - 2 = 20; Num = 10*100 + 5*50 + 5*0 = 1250; 1250/20 = 62.5 → 63
    const data = evals({ conforme: 10, parcial: 5, nao_aplicavel: 2 });
    // 5 requisitos ficam sem avaliação (não entram na lista mas o total é 22)
    expect(computeConformityScore(data, 22)).toBe(63);
  });

  it('naCount não pode empurrar denominador para negativo', () => {
    // Corner case: mais N/A do que total (não deve acontecer, mas defensivo)
    const data = evals({ nao_aplicavel: 10 });
    expect(computeConformityScore(data, 5)).toBe(0);
  });

  it('status desconhecido é tratado como 0', () => {
    // Alguém escreveu "em_progresso" — não conta no numerador
    const data = [{ conformity_status: 'em_progresso' }, { conformity_status: 'conforme' }];
    expect(computeConformityScore(data, 2)).toBe(50);
  });
});

describe('countEvaluated', () => {
  it('ignora nao_avaliado e valores vazios, aceita N/A como decisão', () => {
    const data: EvaluationLite[] = [
      { conformity_status: 'conforme' },
      { conformity_status: 'parcial' },
      { conformity_status: 'nao_aplicavel' },
      { conformity_status: 'nao_avaliado' },
      { conformity_status: null },
      { conformity_status: '' },
    ];
    expect(countEvaluated(data)).toBe(3);
  });

  it('lista vazia/null → 0', () => {
    expect(countEvaluated([])).toBe(0);
    expect(countEvaluated(null)).toBe(0);
    expect(countEvaluated(undefined)).toBe(0);
  });
});

describe('Paridade com useFrameworksOverview e useGapAnalysisStats', () => {
  it('reproduz a fórmula usada pelo Dashboard/Frameworks Overview', () => {
    // Reimplementa a fórmula inline do useFrameworksOverview.ts (linhas 79-103)
    // para provar que ambas devolvem o MESMO número sob o mesmo dataset.
    const data = evals({ conforme: 12, parcial: 6, nao_conforme: 4, nao_aplicavel: 3 });
    const total = 30;

    const canonical = computeConformityScore(data, total);

    // Cópia da lógica do useFrameworksOverview (SCORE_OF map + naCount)
    const SCORE_OF: Record<string, number> = { conforme: 100, parcial: 50, nao_conforme: 0 };
    const naCount = data.filter((e) => e.conformity_status === 'nao_aplicavel').length;
    const aplicaveis = Math.max(total - naCount, 0);
    const evaluated = data.filter(
      (e) => e.conformity_status && e.conformity_status !== 'nao_aplicavel',
    );
    const dashboard =
      aplicaveis > 0
        ? Math.round(evaluated.reduce((s, e) => s + (SCORE_OF[e.conformity_status!] ?? 0), 0) / aplicaveis)
        : 0;

    expect(canonical).toBe(dashboard);
  });
});
