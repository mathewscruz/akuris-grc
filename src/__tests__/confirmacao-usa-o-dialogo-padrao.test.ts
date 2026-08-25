/**
 * Confirmação de acção destrutiva usa o ConfirmDialog, nunca o `confirm()` nativo.
 *
 * ## Porque isto é um padrão, não um capricho
 *
 * O `window.confirm()` abre uma caixa cinzenta do navegador: sem o tema do
 * Akuris, sem o botão vermelho de acção destrutiva, sem tradução (o texto é do
 * SO), e bloqueia o event loop. Num produto que tem 53 ficheiros a usar o
 * `ConfirmDialog` estilizado, os 3 que usavam `confirm()` eram um degrau que
 * saltava à vista.
 *
 * Esta guarda existe porque o `confirm()` é fácil de escrever num `onClick`
 * apressado — e ninguém repara numa revisão até ver a caixa cinzenta em produção.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes } from './_fontes';

describe('confirmação usa o diálogo padrão', () => {
  it('nenhum ficheiro chama o confirm()/alert() nativo do navegador', () => {
    /*
      O padrão proibido: `confirm(` ou `alert(` ou `window.confirm(` como
      chamada — não como parte de um identificador (`confirmText`, `onConfirm`,
      `confirmarAta`). A borda `[^.\w]` antes do nome exclui `algo.confirm(` e
      `xconfirm(`; exige um `(` a seguir para não apanhar a palavra solta.
    */
    const proibido = /(^|[^.\w])(confirm|alert)\s*\(/;
    const permitido = /confirmText|onConfirm|confirmDiscard|confirmClose|showConfirm|setConfirm|ConfirmDialog|confirmar[A-Z]|confirmacao|window\.alert === undefined/;

    const infratores: string[] = [];
    for (const ficheiro of fontes()) {
      // O próprio ConfirmDialog e este teste são a excepção óbvia.
      if (ficheiro.endsWith('ConfirmDialog.tsx')) continue;
      const texto = readFileSync(ficheiro, 'utf8');
      texto.split('\n').forEach((linha, i) => {
        // ignora comentários
        const semComentario = linha.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (proibido.test(semComentario) && !permitido.test(semComentario)) {
          infratores.push(`${ficheiro}:${i + 1} → ${linha.trim().slice(0, 80)}`);
        }
      });
    }

    expect(
      infratores,
      'Confirmação/aviso com o diálogo nativo do navegador. Use o ' +
        '`ConfirmDialog` de `@/components/ConfirmDialog` — tem o tema, o botão ' +
        'destrutivo e a tradução.',
    ).toEqual([]);
  });
});
