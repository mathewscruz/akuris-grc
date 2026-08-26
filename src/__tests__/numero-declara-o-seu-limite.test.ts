/**
 * Um campo numérico declara o seu limite inferior — nem que seja para dizer
 * que aceita negativos.
 *
 * Vinte e dois campos não o declaravam: quantidade de licenças, valor de
 * aquisição, custo de manutenção, valor do contrato, valor do marco, dias de
 * antecedência do alerta, RTO, RPO, estimativa de horas, tamanho de ficheiro.
 * Nenhum deles admite um valor negativo, e todos o aceitavam.
 *
 * O que isso custa não é o campo: é a soma. O valor do contrato entra na
 * carteira, e um «-500000» digitado por engano — o traço fica ao lado do
 * número no teclado — passa a estar lá dentro sem nada avisar. A base também
 * não ajudava: procuradas todas as `CHECK` de `public`, a única que limitava
 * um número era `progresso_pct BETWEEN 0 AND 100`, em tarefas de projeto.
 *
 * A regra não obriga a `min="0"`. Obriga a ESCOLHER. Um campo que aceite
 * variações negativas passa com um mínimo negativo explícito — o que não
 * passa é ninguém ter pensado no assunto.
 */
import { describe, expect, it } from 'vitest';
import { fontesTodas, ler, tagsJsx } from './_fontes';

/*
 * A tag é lida por `tagsJsx`, em `_fontes`: um varrimento que conta
 * chavetas e aspas, porque o `>` da seta de `onChange` fecha qualquer
 * regex a meio. Foi por isso que a primeira tentativa de corrigir estes
 * campos partiu dezasseis ficheiros de uma vez.
 */
const tagsDeInput = (fonte: string) => tagsJsx(fonte, 'Input');

describe('número declara o seu limite', () => {
  it('todo campo numérico diz qual é o mínimo que aceita', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTodas()) {
      if (!arquivo.endsWith('.tsx')) continue;
      const fonte = ler(arquivo);
      for (const { texto, posicao } of tagsDeInput(fonte)) {
        if (!/type="number"/.test(texto)) continue;
        if (/\bmin=/.test(texto)) continue;
        infratores.push(`${arquivo}:${fonte.slice(0, posicao).split('\n').length}`);
      }
    }

    expect(
      infratores,
      'Campo numérico sem `min`: escolha o limite. `min="0"` para quantidades, valores e prazos; ' +
        'um mínimo negativo explícito se o campo aceitar mesmo valores abaixo de zero.',
    ).toEqual([]);
  });

  it('a guarda lê a tag inteira — setas e chavetas aninhadas incluídas', () => {
    const acha = (s: string) =>
      tagsDeInput(s).some((t) => /type="number"/.test(t.texto) && !/\bmin=/.test(t.texto));

    const comSetaAntesDoMin =
      '<Input type="number" value={x} onChange={(e) => set(e.target.value)} min="0" />';
    const comChavetasAninhadas =
      '<Input type="number" onChange={(e) => set({ ...s, v: e.target.value })} min="5" />';
    const semMin =
      '<Input type="number" value={x} onChange={(e) => set(e.target.value)} />';

    expect(acha(comSetaAntesDoMin), 'min depois da seta: não é infractor').toBe(false);
    expect(acha(comChavetasAninhadas), 'chavetas aninhadas: lê-se até ao fim').toBe(false);
    expect(acha(semMin), 'sem min: é infractor').toBe(true);
  });
});
