/**
 * «Já posso marcar a auditoria?» — uma pergunta, uma resposta.
 *
 * ## Duas contas para a mesma pergunta, no mesmo ecrã
 *
 * O cabeçalho já tinha um bloco «Prontidão para auditoria» com veredicto. Ao
 * acrescentar um cartão com a mesma pergunta mais abaixo, o ecrã passou a
 * mostrar duas respostas diferentes ao mesmo tempo: em cima «14 não
 * conformidades bloqueiam», em baixo «15 por avaliar, 14 não conformes, 15
 * parciais, 58 sem prova». Medido no navegador, na ISO 27001.
 *
 * É a repetição exacta do defeito que este módulo mais teve — três fórmulas
 * paralelas de aderência, com uma guarda dedicada a impedir a quarta. O cartão
 * saiu; o que ele trazia de novo entrou no bloco que já existia.
 *
 * ## E o veredicto do cabeçalho deixava passar dois «prontos» falsos
 *
 *  · dizia PRONTO com 80% de cobertura — um quinto por avaliar, que numa ISO
 *    são 23 controlos que ninguém olhou;
 *  · e nunca olhava para a prova. Conformes com zero ficheiros liam «pronto»,
 *    e é aí que uma auditoria reprova: o auditor não avalia o que a empresa
 *    afirma, avalia o que ela mostra.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { prontidaoDoFramework, somarCategorias } from '@/lib/gap-prontidao';

const totais = (p: Partial<Record<string, number>>) => ({
  conforme: 0, parcial: 0, nao_conforme: 0, nao_aplicavel: 0, nao_avaliado: 0, total: 0, ...p,
}) as any;

describe('a regra vive num sítio só', () => {
  it('o cabeçalho não faz a sua própria conta', () => {
    const s = readFileSync('src/components/gap-analysis/v2/FrameworkHeader.tsx', 'utf8');
    expect(s).toContain('prontidaoDoFramework');
    /*
       A cadeia antiga terminava em `else veredito = 'pronto'` — ou seja, o
       ecrã declarava pronto por exclusão de partes, sem ninguém perguntar
       pelos requisitos por avaliar nem pela prova. O «pronto» tem de vir da
       regra, e só dela.
    */
    expect(s, 'o pronto deixou de vir da regra').toContain(
      "if (prontidao.pronto) veredito = 'pronto';",
    );
    expect(
      /else\s+veredito\s*=\s*'pronto'/.test(s),
      'o ecrã voltou a declarar pronto por exclusão de partes',
    ).toBe(false);
  });

  it('não há um segundo cartão a responder ao mesmo', () => {
    expect(existsSync('src/components/gap-analysis/v2/CartaoDeProntidao.tsx')).toBe(false);
    const pagina = readFileSync('src/pages/GapAnalysisFrameworkDetail.tsx', 'utf8');
    expect(pagina).not.toContain('CartaoDeProntidao');
  });

  it('a Declaração de Aplicabilidade usa a mesma contagem de provas', () => {
    const soa = readFileSync('src/components/gap-analysis/v2/SoATabV2.tsx', 'utf8');
    expect(soa).toContain('provasPorRequisito');
  });
});

describe('o que impede o «pronto»', () => {
  it('requisitos por avaliar, mesmo com 80% de cobertura', () => {
    /* 100 requisitos, 80 conformes, 20 por avaliar: a regra antiga dizia
       PRONTO. Vinte controlos que ninguém olhou. */
    const p = prontidaoDoFramework(totais({ total: 100, conforme: 80, nao_avaliado: 20 }), 0);
    expect(p.pronto).toBe(false);
    expect(p.bloqueios.map((b) => b.chave)).toContain('nao_avaliado');
  });

  it('conformes sem uma única prova', () => {
    const p = prontidaoDoFramework(totais({ total: 100, conforme: 100 }), 100);
    expect(p.pronto).toBe(false);
  });

  it('tudo conforme, tudo com prova: pronto', () => {
    const p = prontidaoDoFramework(totais({ total: 100, conforme: 100 }), 0);
    expect(p.pronto).toBe(true);
    expect(p.bloqueios).toEqual([]);
  });

  it('leitura de provas falhada não inventa bloqueio', () => {
    const p = prontidaoDoFramework(totais({ total: 100, conforme: 100 }), null);
    expect(p.pronto).toBe(true);
  });

  it('escopo que excluiu tudo não é «pronto», é vazio', () => {
    expect(prontidaoDoFramework(totais({ total: 40, nao_aplicavel: 40 }), 0).pronto).toBe(false);
  });

  it('conta aplicáveis, não o total', () => {
    const p = prontidaoDoFramework(totais({ total: 10, nao_aplicavel: 3, conforme: 7 }), 0);
    expect(p.aplicaveis).toBe(7);
    expect(p.pronto).toBe(true);
  });
});

describe('somar categorias dá o mesmo que os totais', () => {
  it('as duas entradas concordam', () => {
    const cats = [
      totais({ total: 6, conforme: 4, parcial: 2 }),
      totais({ total: 4, conforme: 1, nao_conforme: 3 }),
    ];
    const porCategoria = prontidaoDoFramework(cats, 0);
    const porTotais = prontidaoDoFramework(somarCategorias(cats), 0);
    expect(porCategoria).toEqual(porTotais);
    expect(porTotais.aplicaveis).toBe(10);
  });
});
