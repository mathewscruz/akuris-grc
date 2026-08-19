/**
 * Cada cartão abre a sua própria lista.
 *
 * O relato era simples: "os cards de alguns módulos ao clicar exibem o mesmo
 * popup lateral com as mesmas informações". O levantamento devolveu bem mais
 * do que alguns — vinte e quatro cartões repartidos por sete gavetas, e no
 * conjunto do produto sessenta cartões por dezanove. Clicar em "Total de
 * dados" abria a lista de solicitações de titular; clicar em "Chaves
 * críticas" abria a mesma lista de "Total de chaves".
 *
 * A causa não foi descuido de quem escreveu cada tile. Abrir uma gaveta nova
 * custava vinte e cinco linhas de consulta quase igual à do vizinho, e o
 * caminho barato era reutilizar a chave do lado. A tabela `RECORTES` tornou o
 * caminho barato o correcto; estes testes garantem que assim fica.
 *
 * Duas regras, ambas comportamentais:
 *   1. dentro da mesma tira de KPIs, duas chaves iguais são um erro;
 *   2. toda a chave usada tem rótulo nos dois idiomas — uma gaveta sem
 *      tradução abre com a chave crua no cabeçalho.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler } from './_fontes';

/** As chaves de gaveta de uma mesma tira `items={[...]}`. */
function tirasDe(fonte: string): string[][] {
  const tiras: string[][] = [];
  const re = /items=\{\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte))) {
    // Anda até fechar o array, contando parênteses rectos.
    let i = m.index + m[0].length;
    let nivel = 1;
    while (i < fonte.length && nivel > 0) {
      if (fonte[i] === '[') nivel++;
      else if (fonte[i] === ']') nivel--;
      i++;
    }
    const bloco = fonte.slice(m.index, i);
    const chaves = [...bloco.matchAll(/drillDown: '([a-z0-9_-]+)'/g)].map((x) => x[1]);
    if (chaves.length > 1) tiras.push(chaves);
  }
  return tiras;
}

describe('um KPI, uma gaveta', () => {
  it('nenhuma tira de KPIs repete a mesma gaveta', () => {
    const maus: string[] = [];
    for (const f of fontes()) {
      if (!/\.tsx$/.test(f)) continue;
      const fonte = ler(f);
      if (!fonte.includes('drillDown')) continue;
      for (const tira of tirasDe(fonte)) {
        const vistos = new Map<string, number>();
        for (const k of tira) vistos.set(k, (vistos.get(k) || 0) + 1);
        for (const [k, n] of vistos) {
          if (n > 1) maus.push(`${f}: ${n} cartões abrem "${k}"`);
        }
      }
    }
    expect(maus, `cartões diferentes a abrir a mesma lista:\n${maus.join('\n')}`).toEqual([]);
  });

  it('toda a gaveta usada tem rótulo em pt e en', () => {
    const usadas = new Set<string>();
    for (const f of fontes()) {
      if (!/\.tsx$/.test(f) || f.endsWith('KpiDrillDownDrawer.tsx')) continue;
      for (const m of ler(f).matchAll(/drillDown: '([a-z0-9_-]+)'/g)) usadas.add(m[1]);
    }
    expect(usadas.size, 'nenhuma gaveta encontrada — o teste deixou de ver o produto').toBeGreaterThan(20);

    const dic = ler('src/i18n/modules/dashboard-widgets.ts');
    // `drill: {` abre uma vez por idioma; conta os rótulos de cada bloco.
    const blocos = dic.split(/\n {2}drill: \{\n/).slice(1);
    expect(blocos.length, 'o dicionário deixou de ter dois idiomas').toBe(2);

    const maus: string[] = [];
    blocos.forEach((bloco, i) => {
      const idioma = i === 0 ? 'pt' : 'en';
      for (const k of usadas) {
        // As chaves com hífen são escritas entre plicas no objecto.
        const alvo = /-/.test(k) ? `'${k}':` : `${k}:`;
        if (!bloco.includes(`\n    ${alvo}`)) maus.push(`${idioma}: falta "${k}"`);
      }
    });
    expect(maus, `gavetas sem rótulo — abririam com a chave crua:\n${maus.join('\n')}`).toEqual([]);
  });
});
