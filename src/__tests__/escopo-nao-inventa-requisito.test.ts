/**
 * O assistente de escopo não exclui requisito que não existe.
 *
 * Cada pergunta do assistente, respondida com NÃO, tira do escopo uma lista de
 * códigos. Um código que não exista no framework **não dá erro nenhum**: a
 * consulta simplesmente não encontra a linha, nada é excluído, e a pessoa fica
 * a acreditar que a lista encolheu quando não encolheu. É o pior tipo de
 * defeito num módulo de conformidade — silencioso e a favor do erro.
 *
 * O desenho original trazia seis códigos inventados na LGPD (Art. 31, 51, 56,
 * 57, 58 e 59) e uma pergunta inteira cuja única exclusão era um deles, que
 * portanto não excluía nada. Foram removidos na geração, contra a base.
 *
 * Esta guarda impede que voltem. E verifica mais duas coisas que o auditor
 * exigiu por escrito: nenhuma pergunta sem nada a excluir, e nenhuma
 * justificativa vazia — uma exclusão sem motivo escrito é exactamente o que o
 * auditor recusa no Estágio 1.
 *
 * Os códigos vêm de um retrato commitado da base, pela mesma razão que as
 * categorias: as migrations não contêm a semente toda (ver
 * `fase-nao-esquece-categoria`). Regenerar quando um framework mudar.
 */
import { describe, expect, it } from 'vitest';
import { ESCOPO_POR_FRAMEWORK, aplicarTravas, codigosExcluidos, escopoDe } from '@/lib/gap-escopo';
import CODIGOS from './_codigos-por-framework.json';

const REAIS = CODIGOS as Record<string, string[]>;

describe('escopo não inventa requisito', () => {
  it('todo o código que uma pergunta exclui existe no framework', () => {
    const inventados: string[] = [];
    for (const [framework, assistente] of Object.entries(ESCOPO_POR_FRAMEWORK)) {
      const reais = new Set(REAIS[framework] ?? []);
      expect(reais.size, `sem retrato de códigos para ${framework}`).toBeGreaterThan(0);
      for (const p of assistente.perguntas) {
        for (const c of p.codigos) {
          if (!reais.has(c)) inventados.push(`${framework}/${p.id}: "${c}"`);
        }
      }
    }
    expect(
      inventados,
      `estes códigos não excluiriam nada, em silêncio:\n${inventados.join('\n')}`,
    ).toEqual([]);
  });

  it('nenhuma pergunta fica sem nada a excluir', () => {
    const vazias: string[] = [];
    for (const [framework, assistente] of Object.entries(ESCOPO_POR_FRAMEWORK)) {
      for (const p of assistente.perguntas) {
        if (p.codigos.length === 0) vazias.push(`${framework}/${p.id}`);
      }
    }
    expect(vazias, `perguntas que não mudam nada — só custam tempo:\n${vazias.join('\n')}`).toEqual([]);
  });

  it('nenhuma exclusão fica sem justificativa escrita', () => {
    const mudas: string[] = [];
    for (const [framework, assistente] of Object.entries(ESCOPO_POR_FRAMEWORK)) {
      for (const p of assistente.perguntas) {
        // Não é rigor de estilo: uma exclusão sem motivo é o que o auditor
        // recusa. Sessenta caracteres é o mínimo para uma frase que se defenda.
        if ((p.justificativa || '').trim().length < 60) {
          mudas.push(`${framework}/${p.id}: "${(p.justificativa || '').slice(0, 40)}"`);
        }
      }
    }
    expect(mudas, `exclusão sem motivo que o auditor aceite:\n${mudas.join('\n')}`).toEqual([]);
  });

  it('as travas resolvem combinações impossíveis', () => {
    const iso = escopoDe('iso27001')!;
    expect(iso.travas?.length).toBeGreaterThan(0);

    // Sem escritório e sem trabalho remoto: a empresa não existe em lado nenhum.
    const { respostas, forcadas } = aplicarTravas(iso, {
      instalacoes_proprias: 'nao',
      trabalho_fora_das_instalacoes: 'nao',
    });
    expect(respostas.trabalho_fora_das_instalacoes).toBe('sim');
    expect(forcadas.length).toBeGreaterThan(0);
    expect(forcadas[0].porque.length).toBeGreaterThan(10);

    // E a exclusão da segurança física deixa de vir acompanhada da do remoto.
    const fora = codigosExcluidos(iso, respostas).map((x) => x.codigo);
    expect(fora).toContain('A.7.1');
    expect(fora).not.toContain('A.6.7');
  });

  it('cada exclusão carrega a sua justificativa até ao fim', () => {
    const iso = escopoDe('iso27001')!;
    const fora = codigosExcluidos(iso, { desenvolvimento_interno: 'nao' });
    expect(fora.length).toBeGreaterThan(0);
    for (const x of fora) {
      expect(x.justificativa.length, `${x.codigo} sairia sem motivo`).toBeGreaterThan(60);
    }
  });

  it('framework sem assistente devolve null em vez de inventar', () => {
    expect(escopoDe('nistCsf')).toBeNull();
    expect(escopoDe(null)).toBeNull();
  });
});
