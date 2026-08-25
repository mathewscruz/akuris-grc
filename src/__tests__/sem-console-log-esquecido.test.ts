/**
 * Nada de `console.log`/`console.debug` esquecido no código de produção.
 *
 * ## Porque importa, para além da limpeza
 *
 * Um `console.log` de debug não é só ruído no DevTools: os que aqui estavam
 * despejavam **dados de terceiros** — nome e e-mail do fornecedor a quem se
 * envia uma avaliação de due diligence — na consola de qualquer pessoa com a
 * aplicação aberta. Isso é uma fuga de dados pessoais em produção, por descuido.
 *
 * O produto tem um `logger` estruturado: `logger.debug()` só imprime em
 * desenvolvimento (`import.meta.env.DEV`), `logger.error()` sempre. Debug passa
 * por lá; a consola do navegador fica para o que o utilizador não devia ver.
 *
 * `console.error` e `console.warn` continuam permitidos — um erro tem de
 * aparecer.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes } from './_fontes';

describe('sem console.log esquecido', () => {
  it('nenhum ficheiro de produção usa console.log/console.debug', () => {
    const proibido = /\bconsole\.(log|debug)\s*\(/;

    const infratores: string[] = [];
    for (const ficheiro of fontes()) {
      // O logger é quem pode falar com a consola.
      if (ficheiro.endsWith('lib/logger.ts')) continue;
      const texto = readFileSync(ficheiro, 'utf8');
      texto.split('\n').forEach((linha, i) => {
        const semComentario = linha.replace(/\/\/.*$/, '');
        if (proibido.test(semComentario)) {
          infratores.push(`${ficheiro}:${i + 1} → ${linha.trim().slice(0, 70)}`);
        }
      });
    }

    expect(
      infratores,
      'console.log/debug no código de produção. Use `logger.debug()` de ' +
        '`@/lib/logger` (silencia em produção) — e nunca despeje dados pessoais ' +
        'na consola do navegador.',
    ).toEqual([]);
  });
});
