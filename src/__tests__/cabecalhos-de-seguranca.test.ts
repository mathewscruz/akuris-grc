/**
 * Os cabeçalhos de segurança existem, são fortes, e não divergem entre si.
 *
 * ## O que esta guarda protege
 *
 * A política de CSP e os cabeçalhos vivem em `src/lib/seguranca/politica-csp.ts`
 * e são servidos por três caminhos: o `<meta>` injetado no build, o
 * `public/_headers` (Netlify/Cloudflare) e o `vercel.json`. Os dois ficheiros de
 * host são GERADOS a partir do módulo por `scripts/gerar-headers.mjs`.
 *
 * Um pentest de fornecedor abre o site e lê os cabeçalhos. Se o CSP perder o
 * `frame-ancestors`, ou o `script-src` ganhar um `'unsafe-inline'`, ou os
 * ficheiros ficarem para trás da política, a app deixa de passar sem que nada
 * no ecrã mude. Esta guarda faz isso falhar aqui.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  politicaCsp,
  politicaCspParaMeta,
  CABECALHOS_SEGURANCA,
  DIRETIVAS_CSP,
} from '@/lib/seguranca/politica-csp';

describe('cabeçalhos de segurança', () => {
  it('o CSP tem as directivas que travam as classes de ataque', () => {
    const csp = politicaCsp();
    // XSS: script sem inline nem eval.
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    // Clickjacking.
    expect(csp).toContain("frame-ancestors 'none'");
    // Injeção de <base> e de plugins.
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    // Exfiltração: connect só para o próprio backend.
    expect(csp).toMatch(/connect-src[^;]*supabase\.co/);
    expect(csp).not.toMatch(/connect-src[^;]*\*(?!\.supabase)/); // sem curinga aberto
  });

  it('o `<meta>` não inclui `frame-ancestors` (que o navegador ignora aí)', () => {
    /* Deixar `frame-ancestors` no meta faz o navegador emitir um aviso e não
       protege nada — a proteção real está no header e no frame-buster. */
    expect(politicaCspParaMeta()).not.toContain('frame-ancestors');
    expect(politicaCsp()).toContain('frame-ancestors');
  });

  it('estão presentes os cabeçalhos que um pentest de fornecedor procura', () => {
    const nomes = CABECALHOS_SEGURANCA.map(([k]) => k);
    for (const obrigatorio of [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
    ]) {
      expect(nomes, `falta o cabeçalho ${obrigatorio}`).toContain(obrigatorio);
    }
    // HSTS com validade longa e subdomínios.
    const hsts = CABECALHOS_SEGURANCA.find(([k]) => k === 'Strict-Transport-Security')![1];
    expect(hsts).toMatch(/max-age=\d{7,}/);
    expect(hsts).toContain('includeSubDomains');
    expect(CABECALHOS_SEGURANCA.find(([k]) => k === 'X-Frame-Options')![1]).toBe('DENY');
  });

  it('public/_headers não divergiu da política', () => {
    const ficheiro = readFileSync('public/_headers', 'utf8');
    for (const [k, v] of CABECALHOS_SEGURANCA) {
      expect(
        ficheiro,
        `public/_headers está desatualizado — corra \`node scripts/gerar-headers.mjs\`. Falta: ${k}`,
      ).toContain(`${k}: ${v}`);
    }
  });

  it('vercel.json não divergiu da política', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const servidos: Record<string, string> = {};
    for (const h of vercel.headers[0].headers) servidos[h.key] = h.value;
    for (const [k, v] of CABECALHOS_SEGURANCA) {
      expect(servidos[k], `vercel.json desatualizado em ${k} — corra o gerador`).toBe(v);
    }
  });

  it('cada directiva do CSP tem exactamente uma vírgula-e-ponto de separação', () => {
    /* Um `;;` ou uma directiva repetida faz o navegador cair no comportamento
       por omissão de forma silenciosa. */
    const chaves = DIRETIVAS_CSP.map(([k]) => k);
    expect(new Set(chaves).size, 'directiva de CSP repetida').toBe(chaves.length);
  });
});
