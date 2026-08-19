/**
 * Superfícies: uma cor nunca assenta sobre uma superfície sem cor.
 *
 * O casco do diálogo no tema claro é branco puro (`--card` e `--popover` a
 * 0% de saturação). Quando `--muted` valia `200 14% 92%` — rgb(232,236,237) —
 * os blocos recuados dentro dos diálogos apareciam azulados sobre esse branco:
 * o utilizador não lia "sombra", lia "cor". O mesmo aconteceria com qualquer
 * matiz nova que alguém introduzisse numa superfície.
 *
 * A regra que este teste fixa é a que evita a classe inteira do problema:
 * **se a superfície de fora é neutra, a de dentro também tem de ser.** No tema
 * escuro nada é neutro (toda a paleta partilha a matiz navy 216), por isso a
 * regra não dispara lá — e é isso que se quer, porque no escuro não há choque.
 *
 * A medida é a amplitude: a distância entre o canal RGB mais alto e o mais
 * baixo. Conta a cor como ela chega ao olho, já descontada a luminosidade —
 * `210 20% 98%` tem 20% de saturação mas só 2 de amplitude, e ninguém vê azul.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes, ler } from './_fontes';
import { resolve } from 'node:path';

const CSS = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

/** Superfícies: tudo o que serve de fundo a um plano inteiro. */
const SUPERFICIES = ['--background', '--card', '--popover', '--muted', '--secondary'] as const;

/** Pares (exterior, interior) que de facto se empilham na aplicação. */
const EMPILHAMENTOS: Array<[string, string]> = [
  ['--popover', '--muted'],
  ['--popover', '--secondary'],
  ['--popover', '--card'],
  ['--card', '--muted'],
  ['--card', '--secondary'],
  ['--background', '--card'],
  ['--background', '--muted'],
];

/** Abaixo disto a matiz não se distingue de cinzento. */
const LIMIAR_NEUTRO = 2;
/** Folga dada ao interior antes de se considerar que introduziu cor. */
const TOLERANCIA = 1;

function bloco(seletor: string): string {
  // `:root { … }` e `.dark { … }` — o primeiro bloco de cada, que é onde a
  // paleta base vive.
  const i = CSS.indexOf(seletor);
  expect(i, `bloco ${seletor} não encontrado em index.css`).toBeGreaterThan(-1);
  return CSS.slice(i, CSS.indexOf('}', i));
}

function hsl(seletor: string, token: string): [number, number, number] {
  const m = new RegExp(`${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(bloco(seletor));
  expect(m, `${token} não definido em ${seletor}`).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

function rgb([h, s, l]: [number, number, number]): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const canal = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [canal(0), canal(8), canal(4)];
}

/** Quanta cor a superfície carrega, já descontada a luminosidade. */
const amplitude = (seletor: string, token: string): number => {
  const c = rgb(hsl(seletor, token));
  return Math.max(...c) - Math.min(...c);
};

describe('realce de interação', () => {
  it('o hover é um roxo da marca, não um cinzento', () => {
    const [matiz, , luz] = hsl(':root', '--accent');
    // Família violeta da marca (--primary vive em 252).
    expect(Math.abs(matiz - 252), `--accent saiu da família da marca: matiz ${matiz}`).toBeLessThanOrEqual(20);
    // "Bem de leve": realce, não bloco de cor.
    expect(luz, '--accent escureceu demais para um realce de passagem').toBeGreaterThanOrEqual(94);
  });

  it('a linha da tabela e o resto da aplicação partilham o mesmo realce', () => {
    // Dois realces diferentes davam dois roxos ligeiramente distintos no
    // mesmo ecrã — a tabela por um lado, cartões e menus pelo outro.
    for (const seletor of [':root', '.dark']) {
      expect(hsl(seletor, '--table-row-hover'), `realces divergentes em ${seletor}`).toEqual(
        hsl(seletor, '--accent'),
      );
    }
  });

  it('nenhum realce de passagem sobrou em cinzento', () => {
    // `hover:bg-muted` reaparece com facilidade em código novo; o realce da
    // aplicação é um só e vem de --accent.
    const arquivos = fontes();
    const infratores = arquivos.filter((f) =>
      /\b(hover|focus|focus-visible|group-hover):bg-muted(\/\d+)?\b/.test(ler(f)),
    );
    expect(infratores, 'Troque por hover:bg-accent — o realce é o roxo leve da marca.').toEqual([]);
  });
});

describe('superfícies do tema', () => {
  it.each([':root', '.dark'])(
    'em %s, nenhuma superfície introduz cor sobre uma superfície neutra',
    (seletor) => {
      const violacoes = EMPILHAMENTOS.filter(([fora, dentro]) => {
        const ampFora = amplitude(seletor, fora);
        const ampDentro = amplitude(seletor, dentro);
        return ampFora <= LIMIAR_NEUTRO && ampDentro > LIMIAR_NEUTRO + TOLERANCIA;
      }).map(([fora, dentro]) =>
        `${dentro} (amplitude ${amplitude(seletor, dentro)}) sobre ${fora} (amplitude ${amplitude(seletor, fora)})`,
      );

      expect(
        violacoes,
        `Superfície com matiz assente sobre superfície neutra em ${seletor}. ` +
          'Baixe a saturação do token de dentro até a amplitude cair para <= 3, ' +
          'ou dê matiz ao token de fora. A profundidade vem da luminosidade, não da cor.',
      ).toEqual([]);
    },
  );

  it('no tema claro as superfícies são cinzentos, não cores', () => {
    const coloridas = SUPERFICIES.filter((t) => amplitude(':root', t) > LIMIAR_NEUTRO + TOLERANCIA);
    expect(
      coloridas,
      'O casco claro é branco puro; qualquer plano com matiz destoa dele.',
    ).toEqual([]);
  });

  it('cada superfície é um degrau de luminosidade distinto dentro do diálogo', () => {
    // `--muted` chegou a ter exactamente a luminosidade de `--popover` no tema
    // escuro, e o painel recuado desaparecia dentro do diálogo.
    for (const seletor of [':root', '.dark']) {
      const [, , luzPopover] = hsl(seletor, '--popover');
      const [, , luzMuted] = hsl(seletor, '--muted');
      expect(
        Math.abs(luzPopover - luzMuted),
        `--muted e --popover têm a mesma luminosidade em ${seletor}: o plano recuado não se lê.`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
