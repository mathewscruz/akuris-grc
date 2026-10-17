import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

/**
 * Ícone não ganha caixa colorida em volta: uma <div>/<span> com fundo tonal,
 * centralizada e com um único ícone dentro é proibida — mostra-se só o ícone.
 */
const ficheiros = (globSync as unknown as (p: string) => string[])('src/**/*.tsx');
const padrao = /<(div|span) className="([^"]*)">\s*<[A-Z]\w*Icon\b[^<>]*\/>\s*<\/\1>|<(div|span) className="([^"]*)">\s*<Icon[A-Z]\w*\b[^<>]*\/>\s*<\/\3>/g;

describe('ícone sem aura', () => {
// Configurações: quadrado tonal pedido explicitamente pelo modelo aprovado.
const EXCECOES = new Set(['src/components/configuracoes/ConfiguracoesVisaoGeral.tsx']);
  it('nenhum ícone sozinho dentro de caixa com fundo tonal', () => {
    const infratores: string[] = [];
    for (const f of ficheiros.filter((x) => !EXCECOES.has(x))) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(padrao)) {
        const cls = m[2] ?? m[4] ?? '';
        if (/\bbg-(primary|muted|accent|success|warning|destructive|info)\S*/.test(cls) && /justify-center|place-items-center/.test(cls) && !/border-dashed/.test(cls)) {
          infratores.push(f);
        }
      }
    }
    expect(infratores).toEqual([]);
  });
});
