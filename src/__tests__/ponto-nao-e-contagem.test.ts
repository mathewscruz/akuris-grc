/**
 * Ponto de score não é número de gaps — e o produto já disse isto duas vezes.
 *
 * O `ganhoPotencial`, em `lib/gap-score`, nasceu porque a aba de Remediação
 * mostrava «+5pts» somando os PESOS dos requisitos em aberto. O comentário que
 * lá ficou explica: peso não é ponto.
 *
 * O mesmo erro estava vivo no cartão do topo do Gap Analysis, noutra forma:
 *
 *     pts: Math.min(15, criticalCount)
 *
 * — a CONTAGEM de gaps, com um teto de 15, apresentada como pontos de índice.
 * Com 30 gaps críticos dizia «até 15 pontos». A aba de Remediação do MESMO
 * framework, que usa a conta certa, dizia «+37pts». Duas respostas à mesma
 * pergunta, no mesmo produto, e a que ficava no lugar mais visto era a que não
 * é conta nenhuma — a subestimar justamente o número que serve para convencer
 * alguém a agir.
 *
 * Medido na base de desenvolvimento: fechar os 26 gaps críticos da ISO 27001
 * vale 25 pontos nesse framework; fechar os 44 abertos vale 37; e o índice
 * global, que é a média ponderada de dois frameworks, sobe 24.
 */
import { describe, expect, it } from 'vitest';
import { calcularScoreFramework, ganhoPotencial, type RequisitoParaScore } from '@/lib/gap-score';
import { fontesTodas, ler } from './_fontes';

/** Requisitos com pesos como os reais da ISO: 1, 2 e 3. */
const universo: RequisitoParaScore[] = [
  ...Array.from({ length: 26 }, (_, i) => ({ id: `c${i}`, peso: 3, conformityStatus: 'nao_conforme' })),
  ...Array.from({ length: 18 }, (_, i) => ({ id: `n${i}`, peso: 2, conformityStatus: 'nao_conforme' })),
  ...Array.from({ length: 44 }, (_, i) => ({ id: `ok${i}`, peso: 3, conformityStatus: 'conforme' })),
  ...Array.from({ length: 26 }, (_, i) => ({ id: `p${i}`, peso: 2, conformityStatus: 'parcial' })),
];

describe('ponto de score não é contagem de gaps', () => {
  it('o ganho é uma percentagem do peso total, não um número de itens', () => {
    const criticos = universo.filter((r) => r.peso === 3 && r.conformityStatus === 'nao_conforme');
    const ganho = ganhoPotencial(universo, criticos);

    /* Não se afirma que os dois números diferem — podem coincidir por acaso,
       e neste universo coincidem. Afirma-se o que os separa: o ganho é uma
       fracção do peso total, e portanto nunca passa de 100, por muitos gaps
       que existam. Uma contagem não tem esse teto. */
    expect(criticos.length).toBe(26);
    expect(ganho).toBeGreaterThan(0);
    expect(ganho).toBeLessThanOrEqual(100);

    const muitos = Array.from({ length: 500 }, (_, i) => ({
      id: `m${i}`, peso: 3, conformityStatus: 'nao_conforme',
    }));
    expect(ganhoPotencial(muitos, muitos), '500 gaps continuam a valer no máximo 100 pontos').toBe(100);
  });

  it('o mesmo número de gaps dá ganhos diferentes em frameworks diferentes', () => {
    const doisGaps: RequisitoParaScore[] = [
      { id: 'a', peso: 3, conformityStatus: 'nao_conforme' },
      { id: 'b', peso: 3, conformityStatus: 'nao_conforme' },
    ];
    const pequeno = [...doisGaps, { id: 'c', peso: 3, conformityStatus: 'conforme' }];
    const grande = [
      ...doisGaps,
      ...Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, peso: 3, conformityStatus: 'conforme' })),
    ];

    // Dois gaps valem quase tudo num framework de três requisitos e quase nada
    // num de duzentos. Uma fórmula baseada na contagem daria o mesmo nos dois.
    expect(ganhoPotencial(pequeno, doisGaps)).toBeGreaterThan(50);
    expect(ganhoPotencial(grande, doisGaps)).toBeLessThan(5);
  });

  it('fechar os gaps sobe o score exactamente o que o ganho prometeu', () => {
    const criticos = universo.filter((r) => r.peso === 3 && r.conformityStatus === 'nao_conforme');
    const antes = calcularScoreFramework(universo).score;
    const depois = calcularScoreFramework(
      universo.map((r) => (criticos.includes(r) ? { ...r, conformityStatus: 'conforme' } : r)),
    ).score;

    // A promessa tem de ser cumprível: o ganho anunciado é a subida real.
    expect(depois - antes).toBe(ganhoPotencial(universo, criticos));
  });

  it('nenhum ecrã deriva «pontos» de uma contagem de gaps', () => {
    const infratores: string[] = [];
    /* `pts:` (ou `points:`) alimentado por uma contagem — que foi exactamente
       a forma do defeito: `pts: Math.min(15, criticalCount)`. */
    /*
      Uma regex só não chega: o defeito era
      `pts: Math.min(15, criticalCount)`, e a vírgula do `Math.min`
      fecha qualquer classe que pare nela. Olha-se a linha inteira a
      partir do `pts:`.
    */
    const contagemComoPontos = (linha: string): boolean => {
      const depois = linha.split(/\b(?:pts|points|pontos)\s*:/)[1];
      return depois !== undefined && /\b\w*(?:[Cc]ount|[Ll]ength|[Tt]otal)\b/.test(depois);
    };

    for (const arquivo of fontesTodas()) {
      if (!arquivo.includes('gap-analysis') && !arquivo.includes('GapAnalysis')) continue;
      ler(arquivo)
        .split('\n')
        .forEach((linha, i) => {
          const t = linha.trimStart();
          if (t.startsWith('*') || t.startsWith('//')) return;
          if (contagemComoPontos(linha)) infratores.push(`${arquivo}:${i + 1}`);
        });
    }

    expect(
      infratores,
      'Pontos de score vêm de `ganhoPotencial()`, nunca de contar gaps: são grandezas diferentes.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe', () => {
    /*
      Uma regex só não chega: o defeito era
      `pts: Math.min(15, criticalCount)`, e a vírgula do `Math.min`
      fecha qualquer classe que pare nela. Olha-se a linha inteira a
      partir do `pts:`.
    */
    const contagemComoPontos = (linha: string): boolean => {
      const depois = linha.split(/\b(?:pts|points|pontos)\s*:/)[1];
      return depois !== undefined && /\b\w*(?:[Cc]ount|[Ll]ength|[Tt]otal)\b/.test(depois);
    };
    expect(contagemComoPontos('{ pts: Math.min(15, criticalCount) }')).toBe(true);
    expect(contagemComoPontos('{ pts: gaps.length }')).toBe(true);
    expect(contagemComoPontos('{ pts: ganhoSeFecharCriticos ?? 0 }')).toBe(false);
    expect(contagemComoPontos('{ pts: ganhoPotencial(todos, alvos) }')).toBe(false);
  });
});
