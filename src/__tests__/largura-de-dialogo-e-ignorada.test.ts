/**
 * A largura que um diálogo declara tem de ser a largura que ele tem.
 *
 * O `DialogContent` traz `sm:max-w-lg` na base. Um `max-w-3xl` escrito sem
 * prefixo NÃO entra em conflito com ele para o `tailwind-merge` — são
 * variantes diferentes — por isso os dois sobrevivem no elemento, e a partir
 * de `sm` manda o da base. O resultado é silencioso: a classe está lá, ninguém
 * a apaga, e o diálogo desenha à largura de outro.
 *
 * Custou dezasseis diálogos. O assistente de escopo do Gap Analysis pedia
 * `max-w-3xl` e media 482 px a 1366×768, com 2258 px de conteúdo a rolar
 * dentro de 737 e 880 px de ecrã vazio de cada lado. Havia importadores e
 * trilhas de auditoria a pedir `max-w-6xl` — 1152 px — e a desenhar na mesma
 * coluna estreita.
 *
 * A regra é só uma: quem passa uma largura ao `DialogContent` escreve-a com o
 * prefixo `sm:`. O `max-w-full` sozinho continua certo — é o telemóvel, onde a
 * base já põe o diálogo a ocupar o ecrã todo.
 *
 * ## O PREENCHIMENTO tem a mesma armadilha
 *
 * A base também traz `p-4` e **`sm:p-6`**. Sete diálogos de sangria completa
 * passavam `p-0` para colar o cabeçalho e o rodapé ao casco, e a partir de
 * `sm` recebiam 24px de volta. Media-se: o `MatrizDialog` pedia `p-0` e tinha
 * 22,3px em cima e em baixo, o que deixava uma faixa morta por baixo da barra
 * de «Cancelar / Atualizar matriz».
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTodas } from './_fontes';

/** Larguras nomeadas do Tailwind que a base sobrepõe a partir de `sm`. */
const TAMANHOS = /(?:^|\s)(max-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl))(?=\s|$)/;

function classesDoDialogContent(fonte: string): string[] {
  const encontradas: string[] = [];
  const tags = fonte.matchAll(/<DialogContent\b[\s\S]*?>/g);
  for (const tag of tags) {
    const cls = /className="([^"]*)"/.exec(tag[0]);
    if (cls) encontradas.push(cls[1]);
  }
  return encontradas;
}

describe('a largura declarada no diálogo é a largura que ele tem', () => {
  it('nenhum DialogContent passa uma largura sem o prefixo sm:', () => {
    const falhas: string[] = [];

    for (const ficheiro of fontesTodas()) {
      if (!ficheiro.endsWith('.tsx')) continue;
      const fonte = readFileSync(ficheiro, 'utf8');
      if (!fonte.includes('<DialogContent')) continue;

      for (const cls of classesDoDialogContent(fonte)) {
        // Já traz uma largura para desktop: o resto da linha é para o telemóvel.
        if (/sm:max-w-/.test(cls)) continue;
        const semPrefixo = TAMANHOS.exec(cls);
        if (semPrefixo) {
          falhas.push(`${ficheiro.replace(/\\/g, '/')} → ${semPrefixo[1]}`);
        }
      }
    }

    expect(
      falhas,
      'Estas larguras não chegam ao ecrã: a base do DialogContent tem `sm:max-w-lg` e ganha a partir de `sm`. ' +
        'Escreva-as como `sm:max-w-…` (o `max-w-full` sem prefixo, para o telemóvel, pode ficar).',
    ).toEqual([]);
  });

  it('nenhum DialogContent passa um preenchimento sem o prefixo sm:', () => {
    /*
       Mesma armadilha, outra propriedade: a base tem `p-4 sm:p-6`, e o `p-0`
       de quem chama só vence o primeiro. Um diálogo de sangria completa
       precisa de `p-0 sm:p-0`.
    */
    const falhas: string[] = [];
    const PREENCHIMENTO = /(?:^|\s)(p-\d+(?:\.\d+)?)(?=\s|$)/;

    for (const ficheiro of fontesTodas()) {
      if (!ficheiro.endsWith('.tsx')) continue;
      const fonte = readFileSync(ficheiro, 'utf8');
      if (!fonte.includes('<DialogContent')) continue;

      for (const cls of classesDoDialogContent(fonte)) {
        if (/sm:p-\d/.test(cls)) continue;
        const semPrefixo = PREENCHIMENTO.exec(cls);
        if (semPrefixo) {
          falhas.push(`${ficheiro.split('\\').join('/')} → ${semPrefixo[1]}`);
        }
      }
    }

    expect(
      falhas,
      'Este preenchimento não chega ao ecrã: a base do DialogContent tem `sm:p-6` e ganha a partir de `sm`. ' +
        'Escreva-o também como `sm:p-…`.',
    ).toEqual([]);
  });

  it('a base continua a ser a razão da regra', () => {
    const dialog = readFileSync('src/components/ui/dialog.tsx', 'utf8');
    expect(
      /sm:max-w-lg/.test(dialog),
      'Se a base deixar de impor uma largura em `sm`, esta guarda deixa de fazer sentido — apague-a em vez de a contornar.',
    ).toBe(true);
    expect(/sm:p-6/.test(dialog), 'O mesmo para o preenchimento.').toBe(true);
  });
});
