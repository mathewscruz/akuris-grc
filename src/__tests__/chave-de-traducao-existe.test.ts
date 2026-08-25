/**
 * Toda a chave que o código pede tem de existir no dicionário.
 *
 * ## Porque isto passou despercebido tanto tempo
 *
 * Quando falta uma chave, o `t()` NÃO mostra a chave crua: o
 * `fallbackForKey` do `LanguageContext` humaniza o último segmento. Uma
 * `gapAnalysis.audit.status.naoConforme` em falta aparecia como «Nao Conforme»
 * — sem acento, e em português mesmo com a interface em inglês.
 *
 * Ou seja: o defeito disfarça-se de texto plausível. Ninguém olha para «Nao
 * Conforme» e pensa "falta uma tradução"; pensa que alguém escreveu mal. Foi
 * assim que seis chaves da trilha de auditoria do Gap Analysis sobreviveram.
 *
 * O teste de paridade PT/EN não apanha isto — compara os dois dicionários um
 * com o outro, e ambos estavam igualmente incompletos. Falta ver o terceiro
 * lado: o que o CÓDIGO pede.
 *
 * ## O alcance, dito com honestidade
 *
 * Só se verificam as chaves escritas por extenso, `t('a.b.c')`. As dinâmicas —
 * `t(\`prefixo.${variavel}\`)` — não são verificáveis sem executar o código, e
 * é exactamente aí que vivia o defeito original. Para essas fica o cuidado
 * humano; esta guarda cobre as outras milhares.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pt as corePt } from '@/i18n/pt';
import { en as coreEn } from '@/i18n/en';
import { modulesPt, modulesEn, mergeDictionaries } from '@/i18n/modules';
import { fontes } from './_fontes';

type Dict = Record<string, unknown>;

const dicionarioPt = mergeDictionaries(corePt as Dict, modulesPt as Dict);
const dicionarioEn = mergeDictionaries(coreEn as Dict, modulesEn as Dict);

/** Percorre `a.b.c` no dicionário; devolve o valor ou `undefined`. */
function resolver(dic: Dict, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((no, parte) => {
    if (no && typeof no === 'object' && parte in (no as Dict)) return (no as Dict)[parte];
    return undefined;
  }, dic);
}

/*
  Uma chave resolvida pode ser texto simples OU um objecto de plural,
  `{ one: '1 avaliado', other: '{count} avaliados' }`. Exigir só `string` daria
  29 falsos positivos -- todas as chaves que contam coisas.
*/
function ehTraducao(valor: unknown): boolean {
  if (typeof valor === 'string') return true;
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const o = valor as Dict;
    return typeof o.one === 'string' || typeof o.other === 'string';
  }
  return false;
}

/*
  `t('a.b.c')` e `t("a.b.c")` — só literais. Exige pelo menos um ponto, para não
  apanhar `t(x)` nem chamadas de outras funções com nome parecido.
  O `(?<![\w.])` evita casar o `t(` de `format(`, `at(`, `split(`.
*/
const CHAMADA_LITERAL = /(?<![\w.])t\(\s*['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]/g;

function chavesUsadas(): Map<string, string> {
  const encontradas = new Map<string, string>(); // chave -> primeiro sítio
  for (const ficheiro of fontes()) {
    // Os próprios dicionários citam chaves em comentários e exemplos; não são
    // sítios de chamada.
    if (/[\/]i18n[\/]/.test(ficheiro)) continue;
    const texto = readFileSync(ficheiro, 'utf8');
    for (const m of texto.matchAll(CHAMADA_LITERAL)) {
      if (!encontradas.has(m[1])) encontradas.set(m[1], ficheiro);
    }
  }
  return encontradas;
}

describe('chave de tradução existe', () => {
  const usadas = chavesUsadas();

  it('há chaves literais para verificar (a guarda não está cega)', () => {
    // Se um refactor partir a extração, isto avisa antes de o teste passar por vazio.
    expect(usadas.size).toBeGreaterThan(500);
  });

  it('toda a chave usada no código existe em português', () => {
    const emFalta: string[] = [];
    for (const [chave, ficheiro] of usadas) {
      if (!ehTraducao(resolver(dicionarioPt, chave))) {
        emFalta.push(`${chave}  (${ficheiro})`);
      }
    }
    expect(
      emFalta,
      'Chave pedida pelo código e ausente do dicionário PT. Na tela não ' +
        'aparece a chave: o `fallbackForKey` humaniza o último segmento e ' +
        'inventa um texto plausível, sem acentos — por isso passa despercebido.',
    ).toEqual([]);
  });

  it('toda a chave usada no código existe em inglês', () => {
    const emFalta: string[] = [];
    for (const [chave, ficheiro] of usadas) {
      if (!ehTraducao(resolver(dicionarioEn, chave))) {
        emFalta.push(`${chave}  (${ficheiro})`);
      }
    }
    expect(
      emFalta,
      'Chave pedida pelo código e ausente do dicionário EN. O utilizador ' +
        'inglês vê uma palavra derivada do português.',
    ).toEqual([]);
  });
});
