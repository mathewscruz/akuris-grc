import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('rowOpenProps não apaga o estilo do elemento', () => {
  it('nenhum elemento declara className antes de espalhar rowOpenProps', () => {
    const bad: string[] = [];
    for (const f of files('src')) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/<\w+([^<>]*?)>/gs)) {
        const a = m[1];
        const ri = a.indexOf('...rowOpenProps(');
        const ci = a.indexOf('className=');
        if (ri !== -1 && ci !== -1 && ci < ri) bad.push(f);
      }
    }
    expect(bad).toEqual([]);
  });
});
