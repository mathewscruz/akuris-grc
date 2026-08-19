/**
 * `due_diligence_assessments.score_final` é uma PERCENTAGEM.
 *
 * Quem grava é `calculate-assessment-score`: a IA pontua cada resposta de 0 a
 * 10, a função faz a média ponderada e multiplica por 10 — `(weightedScore /
 * totalWeight) * 10` — antes de gravar. O valor guardado é 0–100.
 *
 * O produto leu esse número em três escalas ao mesmo tempo:
 *   · o diálogo e o drill-down do dashboard mostravam-no como percentagem  ✔
 *   · a lista de fornecedores e o KPI "Score Médio" multiplicavam por 10:
 *     uma avaliação de 75 aparecia como "750%", em verde, porque 750 passa
 *     o limiar de 80
 *   · a classificação comparava com 8 / 6 / 4, a escala das notas por
 *     pergunta: tudo acima de 8% era "Excelente"
 *
 * Esta guarda não corre a UI — procura no código quem volte a multiplicar
 * `score_final` por 10 ou a compará-lo com um limiar de um dígito.
 */
import { describe, expect, it } from 'vitest';
import { fontesTsx, linhas } from './_fontes';

const DUE_DILIGENCE = /due-diligence|dueDiligence/i;

describe('escala do score de due diligence', () => {
  it('ninguém multiplica score_final por 10', () => {
    const infratores: string[] = [];
    for (const arquivo of fontesTsx()) {
      linhas(arquivo).forEach((linha, i) => {
        const t = linha.trimStart();
        if (t.startsWith('*') || t.startsWith('//')) return;
        if (/score_final[^;]*\*\s*10\b/.test(linha) || /\*\s*10[^;]*score_final/.test(linha)) {
          infratores.push(`${arquivo}:${i + 1}`);
        }
      });
    }
    expect(
      infratores,
      'score_final já é percentagem: calculate-assessment-score grava (média/peso)*10.',
    ).toEqual([]);
  });

  it('a classificação compara com limiares de percentagem', () => {
    const suspeitos: string[] = [];
    for (const arquivo of fontesTsx()) {
      if (!DUE_DILIGENCE.test(arquivo)) continue;
      linhas(arquivo).forEach((linha, i) => {
        const t = linha.trimStart();
        if (t.startsWith('*') || t.startsWith('//')) return;
        // `score >= 8` num módulo cujo score vai até 100 é a escala errada.
        if (/\bscore\w*\s*>=\s*[0-9](?![0-9])/.test(linha)) suspeitos.push(`${arquivo}:${i + 1} → ${linha.trim()}`);
      });
    }
    expect(
      suspeitos,
      'Limiar de um dígito num score 0–100: use 80 / 60 / 40.',
    ).toEqual([]);
  });

  it('a guarda enxerga os padrões que proíbe', () => {
    // Sem isto, um erro nas expressões faria os dois testes passarem sempre.
    const mult = /score_final[^;]*\*\s*10\b/;
    expect(mult.test('const score = stats.score_final * 10;')).toBe(true);
    expect(mult.test('const score = stats.score_final;')).toBe(false);

    const limiar = /\bscore\w*\s*>=\s*[0-9](?![0-9])/;
    expect(limiar.test('if (score >= 8) return excelente;')).toBe(true);
    expect(limiar.test('if (score >= 80) return excelente;')).toBe(false);
  });
});
