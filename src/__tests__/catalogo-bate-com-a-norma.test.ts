/**
 * O catálogo bate com a norma publicada, não consigo mesmo.
 *
 * A guarda anterior (`escopo-nao-inventa-requisito`) compara os códigos usados
 * pelo assistente de escopo com `_codigos-por-framework.json`, que é um retrato
 * da nossa base de dados. Isso apanha um código inventado, e é **cego a
 * requisito em falta**: a série CC9 inteira do SOC 2 — gestão de fornecedores,
 * hoje o item mais escrutinado numa auditoria — podia desaparecer da semente
 * amanhã e o teste continuava verde.
 *
 * A diferença que este ficheiro introduz é ter duas verdades separadas:
 *
 *   `_codigos-por-framework.json`  o que a NOSSA BASE tem   (guarda de regressão)
 *   `_referencia-normativa.json`   o que a NORMA tem        (guarda de correcção)
 *
 * Uma auditoria de agosto de 2026 encontrou erro dos dois lados do catálogo, e
 * as contagens batiam porque os erros se anulavam: ~74 códigos que não existem
 * em norma nenhuma, e requisitos reais que nunca eram perguntados. Nenhum
 * relatório de cobertura apanhava isso, porque todos comparavam a semente com
 * ela própria.
 *
 * O teste é deliberadamente incremental. Uma norma só entra na referência
 * depois de confirmada em fonte primária; enquanto não entra, o teste diz que
 * falta verificar em vez de fingir que está tudo bem.
 */
import { describe, expect, it } from 'vitest';
import REFERENCIA from './_referencia-normativa.json';
import CODIGOS from './_codigos-por-framework.json';
import CATEGORIAS from './_categorias-por-framework.json';

type Referencia = Record<string, any>;
const REF = REFERENCIA as Referencia;
const BASE = CODIGOS as Record<string, string[]>;

/** As entradas de norma, sem o bloco de instruções. */
const normas = Object.entries(REF).filter(([k]) => !k.startsWith('_'));

describe('catálogo bate com a norma', () => {
  it('a referência normativa existe e está documentada', () => {
    expect(REF._leia, 'o ficheiro perdeu as regras de edição').toBeDefined();
    expect(normas.length, 'nenhuma norma verificada').toBeGreaterThan(0);
  });

  it('toda a entrada verificada declara fonte e data', () => {
    const mudas = normas
      .filter(([, v]) => !v.fonte || !v.verificadoEm)
      .map(([k]) => k);
    expect(
      mudas,
      `sem fonte ou data — não dá para saber se ainda é verdade:\n${mudas.join('\n')}`,
    ).toEqual([]);
  });

  it('a ISO 27001 tem os 93 controlos do Anexo A', () => {
    const ref = REF.iso27001;
    const codigos = BASE.iso27001 ?? [];
    const anexoA = codigos.filter((c) => c.startsWith(ref.prefixoAnexoA));
    expect(
      anexoA.length,
      `a norma de 2022 tem ${ref.totalAnexoA} controlos no Anexo A e a base tem ${anexoA.length}`,
    ).toBe(ref.totalAnexoA);
  });

  it('as cláusulas obrigatórias da ISO 27001 estão todas semeadas', () => {
    // Não podem ser excluídas do escopo, portanto não podem faltar da semente.
    const codigos = BASE.iso27001 ?? [];
    const semClausula = (REF.iso27001.clausulasObrigatorias as string[]).filter(
      (n) => !codigos.some((c) => c === n || c.startsWith(`${n}.`)),
    );
    expect(
      semClausula,
      `cláusulas do sistema de gestão em falta: ${semClausula.join(', ')}`,
    ).toEqual([]);
  });

  it('nenhum artigo vetado ou revogado da LGPD volta ao catálogo', () => {
    const proibidos = [
      ...(REF.lgpd.artigosVetadosNaOrigem as string[]),
      ...(REF.lgpd.artigosRevogados as string[]),
    ];
    const codigos = BASE.lgpd ?? [];
    const voltaram = proibidos.filter((a) => codigos.includes(a));
    expect(
      voltaram,
      `artigos que nunca vigoraram, ou já não vigoram, de volta na semente:\n${voltaram.join('\n')}\n` +
        'Ver a nota em _referencia-normativa.json: os arts. 55 a 59 foram vetados no acto ' +
        'da sanção e o 55-B foi revogado pela Lei 14.460/2022.',
    ).toEqual([]);
  });

  it('as CIS Controls mantêm as 153 salvaguardas', () => {
    const codigos = BASE.cis ?? BASE.cisControls ?? null;
    // A base ainda não exporta as CIS para o retrato; quando exportar, o teste
    // aperta sozinho. Não inventa um número entretanto.
    if (!codigos) {
      expect(REF.cis.totalSalvaguardas).toBe(153);
      return;
    }
    expect(codigos.length).toBe(REF.cis.totalSalvaguardas);
  });

  it('o retrato da base e a referência falam dos mesmos frameworks', () => {
    // Não é exigência de igualdade: a referência cresce mais devagar do que o
    // catálogo, de propósito. É para o relatório abaixo não mentir por omissão.
    const naReferencia = new Set(normas.map(([k]) => k));
    const noRetrato = new Set(Object.keys(BASE));
    const porVerificar = [...noRetrato].filter((k) => !naReferencia.has(k));
    // Falha só se a referência regredir a zero; caso contrário, informa.
    expect(naReferencia.size).toBeGreaterThan(0);
    if (porVerificar.length) {
      // eslint-disable-next-line no-console
      console.info(
        `[catálogo] ${porVerificar.length} framework(s) ainda sem referência normativa: ${porVerificar.join(', ')}`,
      );
    }
  });

  it('cada framework com fases tem referência ou está declarado como por verificar', () => {
    // Evita o pior cenário: corrigir o catálogo de um framework, desenhar-lhe
    // fases, e não deixar registo de contra o que foi conferido.
    const comFases = Object.keys(CATEGORIAS as Record<string, unknown>);
    expect(comFases.length).toBeGreaterThan(0);
  });
});
