/**
 * A decisão de aplicabilidade vive na SoA — e o lote escreve nos dois sítios.
 *
 * O caso: em `SoATabV2`, marcar requisitos como "Não aplicável" em lote
 * chamava `bulkChangeStatus`, que gravava **só** `conformity_status` em
 * `gap_analysis_evaluations`. A SoA continuava a dizer `aplicavel = true`.
 *
 * Logo abaixo, no mesmo ficheiro, `handleSave` tem uma etapa que existe para
 * quando alguém volta atrás na SoA: reverte para `nao_avaliado` tudo o que
 * esteja `aplicavel` com status `nao_aplicavel`. Como o lote nunca tinha
 * escrito na SoA, essa etapa apanhava exactamente o que o lote acabara de
 * fazer.
 *
 * Resultado: marcar trinta controlos como N/A em lote e clicar em Salvar
 * apagava os trinta, sem aviso nenhum. E é o caminho que o produto oferece a
 * quem tem um framework grande — no PCI DSS são 247 requisitos.
 *
 * A regra: `aplicavel` é a fonte; `conformity_status = 'nao_aplicavel'` é o
 * reflexo. Quem escreve o reflexo escreve a fonte.
 */
import { describe, it, expect } from 'vitest';
import { ler } from './_fontes';

const SOA = 'src/components/gap-analysis/v2/SoATabV2.tsx';

/** O corpo de uma função, do `const nome =` até ao fecho da arrow. */
function corpoDe(texto: string, nome: string): string {
  const i = texto.indexOf(`const ${nome} =`);
  if (i === -1) return '';
  const fim = texto.indexOf('\n  };', i);
  return fim === -1 ? texto.slice(i) : texto.slice(i, fim);
}

describe('lote não se desfaz', () => {
  it('bulkChangeStatus escreve na SoA quando muda a aplicabilidade', () => {
    const corpo = corpoDe(ler(SOA), 'bulkChangeStatus');
    expect(corpo, `${SOA}: não encontrei bulkChangeStatus`).not.toBe('');

    expect(
      /gap_analysis_soa/.test(corpo),
      'bulkChangeStatus marca "não aplicável" e não toca em gap_analysis_soa: o Salvar seguinte desfaz tudo.',
    ).toBe(true);

    expect(
      /aplicavel/.test(corpo),
      'bulkChangeStatus tem de gravar `aplicavel` na SoA, não apenas o conformity_status.',
    ).toBe(true);
  });

  it('a reversão do Salvar continua a existir, para quem volta atrás na SoA', () => {
    const corpo = corpoDe(ler(SOA), 'handleSave');
    expect(
      /item\.aplicavel && item\.conformity_status === 'nao_aplicavel'/.test(corpo),
      `${SOA}: a etapa que reverte N/A quando o requisito volta a ser aplicável desapareceu.`,
    ).toBe(true);
  });
});
