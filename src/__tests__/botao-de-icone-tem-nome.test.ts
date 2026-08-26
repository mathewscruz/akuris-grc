/**
 * Um botão que é só um ícone tem de dizer o que faz.
 *
 * Medido na árvore de acessibilidade — a mesma que o leitor de ecrã lê — em 18
 * rotas da aplicação: **119 botões anunciados apenas como «botão»**, vindos de
 * 14 sítios do código. São os «três pontos» de cada linha de tabela: numa
 * página com 22 ativos, vinte e dois botões anónimos idênticos, um por linha.
 *
 * E não é só para quem não vê. Quem vê também não sabe o que os três pontos
 * fazem sem clicar — daí `title` além de `aria-label`: um dá o nome acessível,
 * o outro dá a dica ao rato.
 *
 * Duas armadilhas apanhadas ao corrigir, e que esta guarda deixa passar de
 * propósito:
 *
 *   1. `DocumentosLista` já tinha um `sr-only` MELHOR do que qualquer rótulo
 *      genérico — «Ações do documento {nome}», que diz de que linha se trata.
 *      Um `aria-label` por cima teria apagado essa informação. Por isso um
 *      `sr-only` no corpo conta como nome.
 *   2. `ProjetoActionsMenu` tem uma variante com texto VISÍVEL ao lado do
 *      ícone. Pôr-lhe `aria-label` faria o leitor anunciar uma coisa e a
 *      pessoa ver outra — o que a WCAG 2.5.3 chama «label in name». Por isso
 *      só se exige nome a quem não tem texto nenhum.
 */
import { describe, expect, it } from 'vitest';
import { fontesTsx, ler } from './_fontes';

/** `<Button ...>` … `</Button>` — sem apanhar Buttons aninhados. */
const BOTAO = /<Button\b(?<attrs>(?:(?!<\/?Button)[\s\S])*?)>(?<corpo>(?:(?!<\/?Button)[\s\S])*?)<\/Button>/g;
/** Corpo que é exclusivamente um ou mais ícones. */
const SO_ICONES = /^(?:\s*<Icon\w+\b[^>]*\/>\s*)+$/;

function temNome(attrs: string, corpo: string): boolean {
  return (
    /\baria-label[=\s]/.test(attrs) ||
    /\btitle=/.test(attrs) ||
    /\baria-labelledby[=\s]/.test(attrs) ||
    /sr-only/.test(corpo)
  );
}

describe('botão de ícone tem nome', () => {
  it('nenhum botão só-de-ícone fica sem nome acessível', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTsx()) {
      const fonte = ler(arquivo);
      for (const m of fonte.matchAll(BOTAO)) {
        const attrs = m.groups?.attrs ?? '';
        const corpo = m.groups?.corpo ?? '';
        if (!SO_ICONES.test(corpo)) continue; // tem texto: já se anuncia
        if (temNome(attrs, corpo)) continue;
        const linha = fonte.slice(0, m.index).split('\n').length;
        infratores.push(`${arquivo}:${linha}`);
      }
    }

    expect(
      infratores,
      'Botão sem nada além do ícone: o leitor de ecrã anuncia só «botão». ' +
        'Acrescente aria-label={t(...)} e title={t(...)} — ou um <span className="sr-only"> que diga de que linha se trata.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe, e deixa passar o que é legítimo', () => {
    const casos: [string, boolean][] = [
      // [fonte, deve ser apanhado]
      ['<Button variant="ghost" size="icon-sm"><IconMore className="h-4 w-4" /></Button>', true],
      ['<Button size="icon"><IconEdit /></Button>', true],
      // nome acessível presente, nas três formas aceites
      ['<Button size="icon" aria-label={t(\'x\')}><IconMore /></Button>', false],
      ['<Button size="icon" title={t(\'x\')}><IconMore /></Button>', false],
      ['<Button size="icon"><span className="sr-only">Ações</span><IconMore /></Button>', false],
      // texto visível: não precisa de nome, e pô-lo seria pior (WCAG 2.5.3)
      ['<Button size="sm"><IconMore /> {t(\'acoes\')}</Button>', false],
    ];

    for (const [fonte, apanhar] of casos) {
      const m = [...fonte.matchAll(BOTAO)][0];
      const attrs = m?.groups?.attrs ?? '';
      const corpo = m?.groups?.corpo ?? '';
      const infrator = SO_ICONES.test(corpo) && !temNome(attrs, corpo);
      expect(infrator, fonte).toBe(apanhar);
    }
  });
});
