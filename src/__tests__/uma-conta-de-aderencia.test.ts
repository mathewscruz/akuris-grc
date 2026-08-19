/**
 * A aderência é uma conta só, em todo o módulo de Gap Analysis.
 *
 * O caso que originou este teste: o cartão de "Controles organizacionais" no
 * mapa de calor dizia **56** e a barra da aba com o mesmo nome, quarenta pixels
 * abaixo, dizia **45** — na mesma tela, ao mesmo tempo. Eram três fórmulas
 * paralelas:
 *
 *   SectionHeatmap           (conforme*100 + parcial*50) / aplicáveis
 *   GenericRequirementsTable conforme / aplicáveis
 *   gap-score.ts             ponderada pelo peso e restrita ao escopo do SoA
 *
 * E a única testada, a terceira, não era usada por nenhuma das outras duas.
 *
 * A regra: quem precisar de percentagem de conformidade chama
 * `calcularScoreFramework`. Ninguém volta a escrever a fórmula à mão.
 */
import { describe, it, expect } from 'vitest';
import { fontes, ler, linhas } from './_fontes';

/** Arquivos do módulo, mais as telas que o consomem. */
function fontesDoGap(): string[] {
  return fontes().filter(
    (f) => f.includes('gap-analysis') || f.includes('GapAnalysis') || f.includes('gap-score'),
  );
}

/**
 * `conforme` dividido por alguma coisa, ou a soma ponderada 100/50 escrita à
 * mão. É como as duas fórmulas paralelas se apresentavam.
 */
const FORMULA_A_MAO = [
  /\bconforme\b[^\n]{0,40}\/\s*(applicable|aplicaveis|aplicáveis|total)/i,
  /conforme\s*\*\s*100[^\n]{0,30}parcial\s*\*\s*50/i,
];

/** Comentário citando a fórmula antiga é documentação, não reincidência. */
function ehComentario(linha: string): boolean {
  return /^\s*(\/\/|\*|\/\*)/.test(linha);
}

describe('uma conta de aderência', () => {
  it('a definição do score vive apenas em lib/gap-score.ts', () => {
    const infratores: string[] = [];
    for (const f of fontesDoGap()) {
      if (f.endsWith('lib/gap-score.ts')) continue;
      linhas(f).forEach((linha, i) => {
        if (ehComentario(linha)) return;
        if (FORMULA_A_MAO.some((re) => re.test(linha))) {
          infratores.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(infratores, 'usar calcularScoreFramework em vez de refazer a conta').toEqual([]);
  });

  it('as telas que mostram percentagem de conformidade importam a conta única', () => {
    // A tabela deixou de mostrar percentagem por categoria — essa fileira de
    // abas duplicava o mapa de calor que fica logo acima. Quem mostra o número
    // é a lista de frameworks e o detalhe.
    const consumidores = [
      'src/pages/GapAnalysisFrameworks.tsx',
      'src/pages/GapAnalysisFrameworkDetail.tsx',
    ];
    const semImportar = consumidores.filter((f) => !ler(f).includes('calcularScoreFramework'));
    expect(semImportar).toEqual([]);
  });

  it('a Declaração de Aplicabilidade é consultada em todo lugar que conta requisito', () => {
    // A exclusão pelo SoA já valia no score, na fila e no PDF, mas não na
    // tabela — que é onde se passa a maior parte do tempo. Era essa a origem
    // dos dois números diferentes para a mesma categoria.
    const obrigados = [
      'src/pages/GapAnalysisFrameworkDetail.tsx',
      'src/components/gap-analysis/GenericRequirementsTable.tsx',
    ];
    const semSoA = obrigados.filter((f) => !ler(f).includes('buscarForaDoEscopo'));
    expect(semSoA).toEqual([]);
  });
});
