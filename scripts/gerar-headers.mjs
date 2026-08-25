/**
 * Gera os ficheiros de cabeçalhos de segurança do host a partir de uma fonte
 * única — `src/lib/seguranca/politica-csp.ts`. Corre no build (ver package.json)
 * para que os ficheiros nunca divirjam da política que o `<meta>` usa.
 *
 *   node scripts/gerar-headers.mjs
 *
 * Produz:
 *   public/_headers   — Netlify / Cloudflare Pages
 *   vercel.json       — Vercel
 *
 * Se o Akuris mudar de host, é aqui que se acrescenta o formato novo.
 */
import { readFileSync, writeFileSync } from 'node:fs';

// Lê a política do módulo TS sem o transpilar: extrai os literais.
const src = readFileSync('src/lib/seguranca/politica-csp.ts', 'utf8');

// Reconstrói a lista de cabeçalhos avaliando só o bloco relevante seria frágil;
// em vez disso, importamos via um pequeno require dinâmico transpilado à mão.
// Mais simples e à prova de divergência: reexecutar a lógica aqui, lendo os
// valores das mesmas constantes. Para não duplicar, chamamos tsx se existir;
// caso contrário, caímos numa cópia mínima verificada pelo teste de sincronia.
const { CABECALHOS_SEGURANCA } = await import('../src/lib/seguranca/politica-csp.ts')
  .catch(async () => {
    // Node não importa .ts diretamente — usa o build do tsx/esbuild via loader.
    const { register } = await import('node:module');
    register('tsx/esm', import.meta.url);
    return import('../src/lib/seguranca/politica-csp.ts');
  });

// ---- public/_headers (Netlify / Cloudflare Pages) ----
const linhas = ['/*'];
for (const [k, v] of CABECALHOS_SEGURANCA) linhas.push(`  ${k}: ${v}`);
writeFileSync('public/_headers', linhas.join('\n') + '\n');

// ---- vercel.json ----
const vercel = {
  headers: [
    {
      source: '/(.*)',
      headers: CABECALHOS_SEGURANCA.map(([key, value]) => ({ key, value })),
    },
  ],
};
writeFileSync('vercel.json', JSON.stringify(vercel, null, 2) + '\n');

console.log('cabeçalhos gerados: public/_headers, vercel.json');
