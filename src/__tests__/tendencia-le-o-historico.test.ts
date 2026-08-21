/**
 * Uma curva de risco tem de poder DESCER.
 *
 * O painel desenhava "Evolução dos Riscos" filtrando riscos por `created_at` e
 * aplicando a severidade **de hoje** a todos os meses anteriores. Consequências
 * medidas na base de desenvolvimento: abril 1 risco (Médio) → 50; maio +9 → 75;
 * junho sem riscos novos → 75; julho +1 Baixo → 70; agosto sem riscos novos →
 * 70. A curva era só a ordem em que os riscos foram CADASTRADOS. Tratar,
 * reavaliar ou encerrar um risco não a movia um pixel.
 *
 * Um gráfico de risco que estruturalmente não pode melhorar é pior do que
 * nenhum: é o número que vai ao conselho.
 *
 * O mais revelador é que já tinha sido corrigido — em `useRiskScoreTrend`, cujo
 * próprio comentário descreve este bug — e o painel ficou com a versão antiga.
 * Duas implementações do mesmo conceito, e a errada era a mais visível.
 *
 * A regra: quem desenha série temporal de risco lê `riscos_historico_avaliacoes`
 * e resolve a avaliação vigente com `risco-vigente.ts`. Ninguém volta a inferir
 * o passado a partir do estado presente.
 */
import { describe, it, expect } from 'vitest';
import { fontes, ler } from './_fontes';
import { avaliacoesPorRisco, avaliacaoVigente, vigenteNoTempo } from '@/lib/risco-vigente';

/** Ficheiros que desenham a evolução do risco ao longo do tempo. */
function seriesDeRisco(): string[] {
  return fontes().filter(
    (f) =>
      f.includes('RiskScoreTimeline') ||
      f.includes('RiskTrendChart') ||
      f.includes('useRiskScoreTrend'),
  );
}

describe('tendência lê o histórico', () => {
  it('nenhuma série temporal de risco usa a severidade actual para o passado', () => {
    const infratores: string[] = [];
    for (const f of seriesDeRisco()) {
      const texto = ler(f);
      // O padrão do defeito: filtrar por created_at e ler o nível de HOJE.
      const filtraPorCriacao = /created_at\s*\)\s*<=?\s*end|jaExistiaEm/.test(texto);
      const leNivelAtual = /r\.nivel_risco_residual\s*\|\|\s*r\.nivel_risco_inicial/.test(texto);
      if (filtraPorCriacao && leNivelAtual) {
        infratores.push(`${f}: infere o passado a partir do nível actual do risco`);
      }
    }
    expect(
      infratores,
      `Série temporal que não pode descer:\n${infratores.join('\n')}`,
    ).toEqual([]);
  });

  it('o painel lê mesmo a tabela de histórico', () => {
    const f = 'src/components/dashboard/RiskScoreTimeline.tsx';
    const texto = ler(f);
    expect(
      /riscos_historico_avaliacoes/.test(texto),
      `${f} desenha a evolução do risco sem abrir o histórico de avaliações.`,
    ).toBe(true);
    expect(
      /avaliacaoVigente|vigenteNoTempo/.test(texto),
      `${f} tem de resolver a avaliação vigente com o helper partilhado, não à mão.`,
    ).toBe(true);
  });

  it('a série não toca na tabela dos riscos vivos', () => {
    /*
      A regra que faltava, e que custou o defeito reportado: apagar um risco
      cadastrado em maio mudava o ponto de MAIO. A causa era a série cruzar o
      histórico com `from('riscos')` — a tabela do PRESENTE. Quem não existe
      hoje desaparecia de todos os meses em que existiu.

      O livro (`riscos_historico_avaliacoes`) é append-only, sobrevive à
      exclusão e traz a linha `exclusao` que diz até quando cada risco contava.
      Ler a carteira de hoje para desenhar o passado é o defeito, não um
      detalhe de implementação.
    */
    const f = 'src/components/dashboard/RiskScoreTimeline.tsx';
    const texto = ler(f);
    expect(
      /\.from\(\s*['"]riscos['"]\s*\)/.test(texto),
      `${f} lê a tabela dos riscos vivos para montar a série: o passado volta a reescrever-se a cada exclusão.`,
    ).toBe(false);
  });

  it('um risco apagado continua a contar nos meses em que existiu', () => {
    const linhas = [
      { risco_id: 'r1', created_at: '2026-05-02T00:00:00Z', tipo: 'inicial', score: 12 },
      { risco_id: 'r1', created_at: '2026-08-20T00:00:00Z', tipo: 'exclusao', score: 12 },
    ];
    const porRisco = avaliacoesPorRisco(linhas);

    // Em maio existia — e continua a existir no livro depois de apagado.
    const emMaio = vigenteNoTempo(porRisco.get('r1'), new Date('2026-06-01T00:00:00Z'));
    expect(emMaio.existia, 'maio não pode mudar por causa de uma exclusão em agosto').toBe(true);
    expect(emMaio.avaliacao?.score).toBe(12);

    // Depois da exclusão, deixa de contar — o erro oposto, e igualmente errado.
    const emSetembro = vigenteNoTempo(porRisco.get('r1'), new Date('2026-09-01T00:00:00Z'));
    expect(emSetembro.existia, 'um risco apagado não conta para sempre').toBe(false);
  });

  it('entre a inicial e a residual do mesmo instante, vale a residual', () => {
    /*
      Não é hipótese: `RiscoFormWizard` grava as duas no mesmo `insert`, e na
      base de desenvolvimento o risco "Falta de Extintor" tem `inicial=Médio` e
      `residual=Baixo` com o carimbo idêntico ao microssegundo. Sem desempate,
      a curva mostrava o risco POR TRATAR num mês em que ele já estava tratado.
    */
    const instante = '2026-07-14T13:00:53.526126+00:00';
    const porRisco = avaliacoesPorRisco([
      { risco_id: 'r1', created_at: instante, tipo: 'inicial', nivel_risco: 'Médio' },
      { risco_id: 'r1', created_at: instante, tipo: 'residual', nivel_risco: 'Baixo' },
    ]);
    const vigente = avaliacaoVigente(porRisco.get('r1'), new Date('2026-08-01T00:00:00Z'));
    expect(vigente?.nivel_risco, 'a residual tem de ganhar o empate').toBe('Baixo');
  });

  it('sem reavaliação até à data, cai para a linha de base', () => {
    const porRisco = avaliacoesPorRisco([
      { risco_id: 'r1', created_at: '2026-07-10T00:00:00Z', tipo: 'residual', nivel_risco: 'Baixo' },
    ]);
    // Em junho o risco existia mas ainda não tinha sido reavaliado.
    const vigente = avaliacaoVigente(porRisco.get('r1'), new Date('2026-07-01T00:00:00Z'));
    expect(vigente, 'antes da reavaliação não há avaliação vigente').toBeNull();
  });
});
