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
import { avaliacoesPorRisco, avaliacaoVigente } from '@/lib/risco-vigente';

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
      /avaliacaoVigente/.test(texto),
      `${f} tem de resolver a avaliação vigente com o helper partilhado, não à mão.`,
    ).toBe(true);
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
