/**
 * O score do framework é o mesmo em qualquer tela.
 *
 * O caso que originou isto: ISO 27001 com 8 requisitos aparecia com 50% na
 * lista de frameworks e 53% no detalhe, ao mesmo tempo. E nenhuma das duas
 * respeitava a Declaração de Aplicabilidade — um requisito declarado fora do
 * escopo continuava puxando o score para baixo.
 */
import { describe, it, expect } from 'vitest';
import { calcularScoreFramework, ganhoPotencial } from '../gap-score';

/** O framework real da revisão, com os pesos e estados que ele tinha. */
const ISO = [
  { id: 'A.5.1', peso: 3, conformityStatus: 'conforme' },
  { id: 'A.5.7', peso: 2, conformityStatus: 'nao_conforme', aplicavel: false },
  { id: 'A.5.15', peso: 3, conformityStatus: 'parcial' },
  { id: 'A.6.3', peso: 2, conformityStatus: 'conforme' },
  { id: 'A.8.7', peso: 3, conformityStatus: 'conforme' },
  { id: 'A.8.13', peso: 3, conformityStatus: 'nao_conforme' },
  { id: 'A.8.16', peso: 2, conformityStatus: 'parcial' },
  { id: 'A.5.30', peso: 2, conformityStatus: null },
];

describe('score de aderência', () => {
  it('pondera pelo peso do requisito', () => {
    const r = calcularScoreFramework([
      { id: 'pesado', peso: 9, conformityStatus: 'conforme' },
      { id: 'leve', peso: 1, conformityStatus: 'nao_conforme' },
    ]);
    // Sem peso daria 50; com peso, o requisito que importa domina.
    expect(r.score).toBe(90);
  });

  it('tira do escopo o que o SoA excluiu', () => {
    const r = calcularScoreFramework(ISO);
    expect(r.aplicaveis, 'A.5.7 saiu do escopo pelo SoA').toBe(7);
    expect(r.naoAplicaveis).toBe(1);
    // Um requisito fora do escopo não é lacuna: sobra só A.8.13.
    expect(r.naoConforme).toBe(1);
  });

  it('não conta o excluído nem em cima nem em baixo da fração', () => {
    const semSoA = calcularScoreFramework(ISO.map((r) => ({ ...r, aplicavel: true })));
    const comSoA = calcularScoreFramework(ISO);
    // Excluir um não conforme só pode melhorar o score.
    expect(comSoA.score).toBeGreaterThan(semSoA.score);
    // (3×100 + 2×100 + 3×100 + 3×50 + 2×50) / (3+3+2+3+3+2+2=18) = 58
    expect(comSoA.score).toBe(58);
  });

  it('trata parcial como meio caminho', () => {
    const tudoParcial = calcularScoreFramework([
      { id: 'a', peso: 1, conformityStatus: 'parcial' },
      { id: 'b', peso: 1, conformityStatus: 'parcial' },
    ]);
    expect(tudoParcial.score).toBe(50);
  });

  it('não divide por zero quando tudo está fora do escopo', () => {
    const r = calcularScoreFramework([{ id: 'a', peso: 1, aplicavel: false }]);
    expect(r.score).toBe(0);
    expect(r.aplicaveis).toBe(0);
  });

  it('o ganho potencial é em pontos de score, não em peso', () => {
    const gaps = ISO.filter((r) => r.conformityStatus === 'nao_conforme' && r.aplicavel !== false);
    // Somar os pesos daria 3. O ganho real de fechar A.8.13 é 3×100/18 = 17.
    expect(ganhoPotencial(ISO, gaps)).toBe(17);
  });

  it('o ganho de fechar um parcial é só a metade que falta', () => {
    const base = [
      { id: 'a', peso: 1, conformityStatus: 'parcial' },
      { id: 'b', peso: 1, conformityStatus: 'conforme' },
    ];
    expect(ganhoPotencial(base, [base[0]])).toBe(25);
  });
});

/**
 * Uma regra, uma constante.
 *
 * O `gap-score.ts` existe porque o mesmo framework aparecia com 50% na lista e
 * 53% no detalhe — duas contas paralelas do mesmo número. A conta ficou numa
 * só, mas a TABELA DE PONTOS ficou em duas: `PONTOS_POR_STATUS` aqui, e
 * `PERCENTAGE_STATUS_SCORES` em `framework-configs.ts`, que é a que o
 * `useFrameworkScore` usa no detalhe do framework.
 *
 * Hoje são iguais e por isso os dois ecrãs concordam — conferido no navegador:
 * excluir 20 requisitos pelo SoA levou lista e detalhe de 49% a 60% ao mesmo
 * tempo. Basta alguém mexer numa para voltarem a divergir, e é o número que a
 * direcção lê.
 */
describe('a tabela de pontos é uma só', () => {
  it('gap-score e framework-configs atribuem os mesmos pontos a cada estado', async () => {
    const { PONTOS_POR_STATUS } = await import('../gap-score');
    const { FRAMEWORK_CONFIGS } = await import('../framework-configs');

    const configs = Object.values(FRAMEWORK_CONFIGS);
    expect(configs.length, 'nenhum framework configurado?').toBeGreaterThan(0);

    for (const cfg of configs) {
      for (const [estado, pontos] of Object.entries(PONTOS_POR_STATUS)) {
        expect(
          (cfg.statusScores as Record<string, number>)[estado],
          `${cfg.id}: «${estado}» vale ${(cfg.statusScores as Record<string, number>)[estado]} aqui e ${pontos} em gap-score`,
        ).toBe(pontos);
      }
    }
  });
});
