/**
 * Uma chave que o código chama existe no dicionário.
 *
 * Quando `t()` não encontra a chave, não falha: humaniza o último segmento e
 * segue. `t('p3Kpis.revisaoAcessos.emptyTitle')` virava **"Empty Title"** — e
 * era esse o título do estado vazio da Revisão de Acessos, o primeiro ecrã que
 * um cliente novo vê nesse módulo. Ao lado, "Empty Description" e um botão
 * "Empty Action". A causa foi um ficheiro de dicionário escrito com as chaves
 * em texto plano com pontos (`'p3Kpis.revisaoAcessos.emptyTitle': '...'`)
 * enquanto `t()` desce por níveis.
 *
 * O teste de paridade pt/en não apanhava nada disto: as duas línguas estavam
 * igualmente erradas, logo estavam em paridade. E o aviso de consola só existe
 * em desenvolvimento, onde ninguém lê a consola de um módulo que não está a
 * mexer. Só a comparação entre o que o código PEDE e o que o dicionário TEM
 * fecha o buraco.
 */
import { describe, expect, it } from 'vitest';
import { pt } from '@/i18n/pt';
import { en } from '@/i18n/en';
import { modulesPt, modulesEn, mergeDictionaries } from '@/i18n/modules';
import { localizePtDictionary } from '@/lib/pt-variants';
import { fontes, linhas, semComentario } from './_fontes';

/*
  O dicionário que o produto usa não é o `pt.ts` — é o `pt.ts` fundido com os
  módulos, e depois localizado por variante. Montá-lo aqui do mesmo modo que
  o LanguageContext o monta é o que torna o teste fiel: um teste que olhasse
  só para `pt.ts` acusaria milhares de chaves em falta que existem.
*/
const DICS: Array<[string, any]> = [
  ['pt', localizePtDictionary(mergeDictionaries(pt, modulesPt), 'pt')],
  ['pt-BR', localizePtDictionary(mergeDictionaries(pt, modulesPt), 'pt-BR')],
  ['en', mergeDictionaries(en, modulesEn)],
];

/** Desce a chave pontuada pelo dicionário, como `t()` faz. */
function resolve(dic: any, chave: string): boolean {
  let v: any = dic;
  for (const k of chave.split('.')) {
    if (v === null || typeof v !== 'object') return false;
    v = v[k];
    if (v === undefined) return false;
  }
  // Uma chave que aponta para um objecto só serve se for plural ({one, other})
  // ou uma lista — senão `t()` devolveria "[object Object]".
  if (typeof v === 'string') return true;
  if (Array.isArray(v)) return true;
  if (v && typeof v === 'object') return 'other' in v || 'one' in v;
  return false;
}

/** `t('a.b.c')` e `tList('a.b')` com chave literal — as computadas ficam de fora. */
const CHAMADA = /\bt(?:List)?\(\s*'([a-zA-Z][\w.]*)'/g;

describe('chave de tradução existe', () => {
  const pedidas = new Map<string, string>(); // chave -> primeiro sítio que a pede

  for (const f of fontes()) {
    if (!/\.tsx?$/.test(f) || f.includes('/i18n/') || f.includes('__tests__')) continue;
    const fonte = linhas(f).map(semComentario).join('\n');
    for (const m of fonte.matchAll(CHAMADA)) {
      if (!m[1].includes('.')) continue; // segmento único não é chave de dicionário
      if (!pedidas.has(m[1])) pedidas.set(m[1], f);
    }
  }

  it('o teste vê o produto', () => {
    expect(pedidas.size, 'nenhuma chamada a t() encontrada — o teste cegou').toBeGreaterThan(500);
  });

  for (const [idioma, dic] of DICS) {
    it(`toda a chave pedida resolve em ${idioma}`, () => {
      const maus = [...pedidas]
        .filter(([k]) => !resolve(dic, k))
        .map(([k, f]) => `${k}  (${f})`);
      expect(
        maus,
        `chaves que o utilizador veria humanizadas em vez de traduzidas (${idioma}):\n${maus.join('\n')}`,
      ).toEqual([]);
    });
  }
});
