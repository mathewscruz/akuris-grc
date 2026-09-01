/**
 * Não se filtra por uma coluna que a base não tem.
 *
 * Um `.eq('ativo', true)` numa tabela sem `ativo` não rebenta: o PostgREST
 * devolve 400 (42703, «column … does not exist»), o erro é engolido pelo
 * `catch` mais próximo, e a consulta devolve nada. A funcionalidade morre em
 * silêncio — ninguém vê um erro, só um ecrã vazio que parece verdade.
 *
 * Custou duas, encontradas a observar as respostas enquanto se percorriam as
 * rotas:
 *
 *  · `integracoes_config.ativo` — a página de Ativos falhava esta consulta em
 *    todas as visitas. A integração do Azure ficava sempre por encontrar,
 *    mesmo depois de configurada, e o botão de sincronizar nunca aparecia.
 *  · `gap_analysis_frameworks.ativo` — o filtro dos dois relatórios em PDF. O
 *    «Frameworks Monitorados» do executivo dizia sempre zero, e a tabela de
 *    Frameworks do de compliance saía em branco. A empresa acompanha dois.
 *
 * O esquema vive no repositório, em `types.ts`, gerado a partir da base: dá
 * para conferir sem rede. Se um nome aqui acusado existir mesmo, o `types.ts`
 * está velho — corre-se o gerador, não se silencia a guarda.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTodas } from './_fontes';

const TIPOS = readFileSync('src/integrations/supabase/types.ts', 'utf8');

/** `tabela -> colunas`, lido do bloco `Row` de cada tabela do `types.ts`. */
function esquema(): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  const tabela = /^ {6}([a-z0-9_]+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm;
  for (const m of TIPOS.matchAll(tabela)) {
    const colunas = new Set<string>();
    for (const linha of m[2].split('\n')) {
      const c = /^ {10}([a-z0-9_]+)\??:/.exec(linha);
      if (c) colunas.add(c[1]);
    }
    if (colunas.size) mapa.set(m[1], colunas);
  }
  return mapa;
}

const FROM = /\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)/g;
const FILTRO = /\.(eq|neq|gt|gte|lt|lte|like|ilike|in|is|order)\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;

describe('as colunas pedidas existem mesmo', () => {
  it('nenhum filtro aponta para uma coluna inexistente', () => {
    const tabelas = esquema();
    expect(tabelas.size, 'Não consegui ler o esquema do types.ts — a guarda ficaria a olhar para o vazio.').toBeGreaterThan(50);

    const falhas: string[] = [];

    for (const ficheiro of fontesTodas()) {
      if (!/\.tsx?$/.test(ficheiro)) continue;
      const fonte = readFileSync(ficheiro, 'utf8');
      if (!fonte.includes('.from(')) continue;

      for (const m of fonte.matchAll(FROM)) {
        const tabela = m[1];
        const colunas = tabelas.get(tabela);
        if (!colunas) continue;                       // vista, ou nome que o types.ts não traz

        /*
           Janela curta e cortada na consulta seguinte: encadeia-se tudo a
           partir do `.from(...)`, e uma janela larga apanhava filtros da
           consulta do lado. Comentários fora, senão uma nota a EXPLICAR o
           defeito seria lida como o defeito.
        */
        let janela = fonte.slice(m.index! + m[0].length, m.index! + m[0].length + 500);
        const proxima = new RegExp(FROM.source).exec(janela);
        if (proxima) janela = janela.slice(0, proxima.index);
        janela = janela.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

        for (const f of janela.matchAll(FILTRO)) {
          const coluna = f[2];
          if (coluna.includes('.')) continue;         // coluna de uma tabela ligada
          if (colunas.has(coluna)) continue;
          const linha = fonte.slice(0, m.index!).split('\n').length;
          falhas.push(`${ficheiro.replace(/\\/g, '/')}:${linha} → ${tabela}.${coluna} (.${f[1]})`);
        }
      }
    }

    expect(
      falhas,
      'O PostgREST devolve 400 e a consulta fica vazia sem erro no ecrã. Se a coluna existir mesmo, o types.ts está velho.',
    ).toEqual([]);
  });
});
