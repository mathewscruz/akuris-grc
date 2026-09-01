/**
 * Uma classe mal escrita não pinta nada, e ninguém dá por isso.
 *
 * O Tailwind só emite CSS para as classes que reconhece. Uma que não encaixe
 * fica no HTML a não fazer absolutamente nada — é a mesma família do `max-w`
 * que o diálogo ignorava: está lá, e não vale.
 *
 * Encontradas comparando TODAS as classes do código com o CSS compilado
 * (`dist/assets/*.css`): de 1208, quatro não geravam regra nenhuma. Esta
 * guarda fica com as duas formas que são erradas por construção e se podem
 * ver sem compilar nada:
 *
 *  · **Opacidade a dobrar** — `bg-warning/10/50`, `dark:bg-success/10/20`. O
 *    primeiro deixava uma linha da barra lateral sem fundo nenhum; o segundo
 *    tirava o fundo do bloco em modo escuro, e só lá.
 *  · **Opacidade sobre `current`** — `border-current/40`, `text-current/90`.
 *    O `currentColor` não se compõe com alfa desta maneira: a etiqueta do
 *    estado activo ficava com a cor genérica da borda em vez da sua.
 *
 * A varredura completa precisa do `npm run build`; correr de vez em quando
 * `scripts` à parte é o complemento disto, não o substituto.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTsx } from './_fontes';

/** `bg-warning/10/50` — duas barras num só utilitário. */
const OPACIDADE_DOBRADA = /\b[a-z-]+-[a-z0-9-]+\/\d{1,3}\/\d{1,3}\b/;
/** `border-current/40` — `currentColor` não aceita alfa por esta via. */
const CURRENT_COM_ALFA = /\b(?:text|border|bg|ring|fill|stroke|divide|outline|shadow)-current\/\d{1,3}\b/;

describe('as classes escritas produzem regra', () => {
  it('nenhuma tem opacidade a dobrar nem alfa sobre `current`', () => {
    const falhas: string[] = [];

    for (const ficheiro of fontesTsx()) {
      const fonte = readFileSync(ficheiro, 'utf8');
      fonte.split('\n').forEach((linha, i) => {
        const t = linha.trim();
        // Um comentário a EXPLICAR o defeito não é o defeito.
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;

        for (const padrao of [OPACIDADE_DOBRADA, CURRENT_COM_ALFA]) {
          const m = padrao.exec(linha);
          if (m) falhas.push(`${ficheiro.replace(/\\/g, '/')}:${i + 1} → ${m[0]}`);
        }
      });
    }

    expect(
      falhas,
      'O Tailwind não gera regra para estas: a classe fica no HTML sem efeito nenhum.',
    ).toEqual([]);
  });
});
