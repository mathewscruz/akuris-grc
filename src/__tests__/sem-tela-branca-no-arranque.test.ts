import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');

describe('arranque sem tela branca', () => {
  it('define o fundo escuro do loader antes de o sistema carregar', () => {
    expect(html).toMatch(/html,body\{background:#06060e/);
  });
  it('mostra o loader estático dentro do root', () => {
    expect(html).toMatch(/<div id="root"><div id="boot-loader"/);
  });
});
