/**
 * Todo estado do sistema tem a mesma forma.
 *
 * O que o dono do produto apanhou numa coluna da tabela de riscos: quatro
 * chips "Em Tratamento" com um ponto cheio de 6px e um "Identificado" com um
 * ícone de contorno de 11px. Não eram duas bolinhas diferentes — era uma
 * bolinha e um ícone.
 *
 * Vinha de três sítios ao mesmo tempo:
 *   1. `status-tone.tsx` devolvia um ícone em 59 dos 157 estados e nada nos
 *      outros 98, portanto a mesma coluna alternava conforme a linha;
 *   2. 19 chamadas passavam `icon=` à mão a um chip de estado;
 *   3. o `Chip` tinha dois tamanhos com pontos de 6px e 8px — e como 238 dos
 *      246 usos pediam `sm` e o resto caía no `md` por omissão, as duas
 *      bolinhas apareciam lado a lado sem ninguém ter decidido isso.
 *
 * As regras abaixo fecham as três portas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTsx, ler, linhas } from './_fontes';
import { resolve } from 'node:path';

const arquivos = fontesTsx();

const CHIP = readFileSync(resolve(__dirname, '../components/ui/chip.tsx'), 'utf8');
const TONE = readFileSync(resolve(__dirname, '../lib/status-tone.tsx'), 'utf8');

describe('estado tem sempre a mesma forma', () => {
  it('o mapa de estados não devolve ícones', () => {
    expect(
      /icon\s*:/.test(TONE),
      'O estado é ponto e cor. Um ícone por estado põe a mesma coluna a alternar entre ponto e glifo.',
    ).toBe(false);
  });

  it('o chip tem um tamanho só', () => {
    expect(/ChipSize/.test(CHIP), 'Dois tamanhos de chip dão dois tamanhos de ponto na mesma tela.').toBe(false);
    expect(CHIP, 'O tamanho do chip vive num só sítio.').toContain('CHIP_SIZING');
  });

  it('nenhuma chamada passa size a um chip', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      const ls = linhas(f);
      ls.forEach((l, i) => {
        if (/<(Chip|StatusBadge)\b[^>]*\ssize=/.test(l)) infratores.push(`${f}:${i + 1}`);
      });
    }
    expect(infratores, 'O chip não tem escala — retire o size.').toEqual([]);
  });

  it('nenhum chip de estado recebe ícone no lugar do ponto', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      const src = ler(f);
      // chamada que resolve o tom pelo mapa de estados E ainda passa um ícone
      for (const m of src.matchAll(/<StatusBadge\b[^>]*>/g)) {
        if (!/resolve\w*Tone|tone=\{info\.tone\}/.test(m[0])) continue;
        if (!/\sicon=/.test(m[0])) continue;
        infratores.push(`${f}: ${m[0].slice(0, 70)}`);
      }
    }
    expect(infratores, 'Deixe o ponto: a distinção vem da cor e do rótulo.').toEqual([]);
  });

  it('nenhum chip tem o corpo de letra reescrito por fora', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      const ls = linhas(f);
      ls.forEach((l, i) => {
        if (/<(Chip|StatusBadge)\b[^>]*className="[^"]*\btext-(micro|xs|sm|base|lg)\b/.test(l)) {
          infratores.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(infratores, 'O corpo de letra do chip é o do componente — um chip menor que os outros lê-se como defeito.').toEqual([]);
  });
});
