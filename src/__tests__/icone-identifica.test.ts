/**
 * Dois itens da mesma lista não podem mostrar o mesmo glifo.
 *
 * Um ícone existe para identificar. Se o Dashboard e os Projetos aparecem no
 * menu com o mesmo desenho, o ícone deixou de dizer alguma coisa e passou a
 * ser enfeite. Aconteceu de facto: ao reduzir 186 conceitos do catálogo
 * genérico para ~110 glifos próprios, ganhou-se coerência e perdeu-se
 * distinção em catorze sítios — menu lateral, paleta de comandos, navegação
 * móvel e os mapas de estado de licenças, chaves, saúde do GRC e alertas.
 *
 * A verificação é por ARRAY, não por arquivo: listas diferentes no mesmo
 * arquivo podem repetir glifos de propósito, porque nunca se veem ao mesmo
 * tempo — é o caso das sugestões da AkurIA, que mudam conforme a rota.
 */
import { describe, it, expect } from 'vitest';
import { fontes, ler } from './_fontes';

const arquivos = fontes().filter((f) => !f.includes('components/icons/'));

/** Os literais de array do arquivo, com os parênteses retos equilibrados. */
function arrays(src: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '[') continue;
    let prof = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '[') prof++;
      else if (src[j] === ']') {
        prof--;
        if (prof === 0) {
          if (j - i < 4000) out.push(src.slice(i, j + 1));
          i = j;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Pares glifo → rótulo dentro de um bloco.
 *
 * `icon: MODULE_ICON['/rota']` conta como a rota, não como `MODULE_ICON`:
 * senão toda a navegação parecia uma colisão gigante, quando na verdade é o
 * contrário — é a fonte única que garante que não há duas.
 */
function entradas(bloco: string) {
  const out: { glifo: string; rotulo: string }[] = [];
  for (const m of bloco.matchAll(/\{[^{}]*\bicon:\s*(MODULE_ICON\['[^']+'\]|[A-Z]\w+)[^{}]*\}/g)) {
    const r = /(?:title|label|nome|name|labelKey|key):\s*(?:t\(\s*)?['"]([^'"]+)['"]/.exec(m[0]);
    out.push({ glifo: m[1], rotulo: r ? r[1] : m[0].slice(0, 30) });
  }
  return out;
}

describe('o ícone identifica', () => {
  it('nenhuma lista repete um glifo em itens diferentes', () => {
    const colisoes: string[] = [];
    for (const f of arquivos) {
      const src = ler(f);
      if (!src.includes('icon:')) continue;
      for (const bloco of arrays(src)) {
        const es = entradas(bloco);
        if (es.length < 2) continue;
        const porGlifo = new Map<string, Set<string>>();
        for (const e of es) {
          if (!porGlifo.has(e.glifo)) porGlifo.set(e.glifo, new Set());
          porGlifo.get(e.glifo)!.add(e.rotulo);
        }
        for (const [glifo, rotulos] of porGlifo) {
          if (rotulos.size > 1) colisoes.push(`${f}: ${glifo} serve ${[...rotulos].join(' e ')}`);
        }
      }
    }
    expect(
      [...new Set(colisoes)],
      'Desenhe um glifo próprio para cada item — o ícone existe para distinguir.',
    ).toEqual([]);
  });
});
