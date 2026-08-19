/**
 * Um padrão por coisa: quando um substitui o outro, o antigo sai do código.
 *
 * O `StatCard` — cartões soltos, cada um com a sua borda e o seu vão — foi
 * substituído pelo `StatStrip`, que é um cartão único com células divididas.
 * A troca ficou pela metade durante um tempo: 21 telas já usavam a faixa nova
 * e 7 continuavam nos cartões antigos, e as duas versões apareciam lado a
 * lado no mesmo produto.
 *
 * Deixar o componente antigo no repositório é o que permite isso acontecer.
 * Enquanto ele existe, alguém importa; e o padrão nunca fica sendo um só.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fontesTsx, ler } from './_fontes';

/** Componentes que foram substituídos e não podem voltar. */
const APOSENTADOS = [
  { arquivo: 'src/components/ui/stat-card.tsx', simbolo: 'StatCard', substituto: 'StatStrip' },
];

describe('um padrão por coisa', () => {
  it.each(APOSENTADOS)('o arquivo de $simbolo não existe mais', ({ arquivo, substituto }) => {
    expect(
      existsSync(resolve(__dirname, '../../', arquivo)),
      `${arquivo} foi substituído por ${substituto}. Enquanto o arquivo existir, alguém volta a importá-lo e o produto fica com dois padrões.`,
    ).toBe(false);
  });

  it.each(APOSENTADOS)('ninguém importa $simbolo', ({ simbolo, substituto }) => {
    const infratores = fontesTsx().filter((f) =>
      new RegExp(`import[^\\n]*\\b${simbolo}\\b[^\\n]*from`).test(ler(f)),
    );
    expect(infratores, `Use ${substituto}.`).toEqual([]);
  });

  it('a faixa de indicadores é sempre a mesma', () => {
    // O padrão antigo era um `grid` com vão onde cada filho tinha borda
    // própria; o novo é um cartão só com divisores internos. Se voltar a
    // aparecer um grid de cartões de indicador, é a regressão.
    const infratores: string[] = [];
    for (const f of fontesTsx()) {
      const src = ler(f);
      if (!/StatStrip/.test(src)) continue;
      // uma tela que já usa a faixa não deve montar cartões de indicador à mão
      if (/<Card[^>]*>\s*<CardContent[^>]*>\s*\{?\s*(stats|metrics|kpis)\./.test(src)) {
        infratores.push(f);
      }
    }
    expect(infratores, 'Passe os indicadores para os items do StatStrip.').toEqual([]);
  });
});
