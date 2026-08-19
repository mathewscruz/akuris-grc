/**
 * Um raio de canto, e só um.
 *
 * O que se via no ecrã eram cinco: 9,325px nos cartões, 3,73px nos botões de
 * segmento, 4px nos campos, a pílula dos estados e 8px do tooltip do gráfico.
 * Dois deles não eram sequer decisão — eram deriva: `--radius` estava em `rem`
 * e passou a acompanhar a raiz tipográfica, que agora acompanha a resolução.
 * Logo o mesmo cartão tinha canto diferente em portátil e em monitor.
 *
 * Agora `--radius` é `8px` fixo e todos os degraus do Tailwind apontam para
 * lá, portanto `rounded-sm` e `rounded-2xl` dão o mesmo canto. `rounded-full`
 * fica reservado ao que é mesmo redondo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTsx, linhas } from './_fontes';
import { resolve } from 'node:path';

const CSS = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const TW = readFileSync(resolve(__dirname, '../../tailwind.config.ts'), 'utf8');

const arquivos = fontesTsx();

describe('raio de canto', () => {
  it('o token é fixo em px, não em rem', () => {
    const m = /--radius:\s*([^;]+);/.exec(CSS);
    expect(m, 'O token --radius tem de existir.').toBeTruthy();
    expect(
      m![1].trim(),
      'Em rem o raio acompanha a raiz tipográfica, que acompanha a resolução — o mesmo cartão fica com cantos diferentes em ecrãs diferentes.',
    ).toMatch(/^\d+px$/);
  });

  it('todos os degraus do Tailwind apontam para o mesmo token', () => {
    const i = TW.indexOf('borderRadius:');
    const bloco = TW.slice(i, TW.indexOf('},', i));
    for (const degrau of ['DEFAULT', 'sm', 'md', 'lg', 'xl']) {
      const re = new RegExp(`${degrau}:\\s*'var\\(--radius\\)'`);
      expect(re.test(bloco), `${degrau} tem de ser var(--radius) — senão volta a haver dois cantos.`).toBe(true);
    }
  });

  it('nenhum raio escrito à mão', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      const ls = linhas(f);
      ls.forEach((l, i) => {
        // rounded-[8px] e afins; `rounded-[inherit]` é herança, não um valor
        if (/rounded-\[(?!inherit)/.test(l)) infratores.push(`${f}:${i + 1}`);
      });
    }
    expect(infratores, 'Use rounded-md — o raio vem do token.').toEqual([]);
  });

  it('rounded-full só no que é mesmo redondo', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      const ls = linhas(f);
      ls.forEach((l, i) => {
        for (const m of l.matchAll(/className="([^"]*)"/g)) {
          const c = m[1].split(/\s+/).filter(Boolean);
          if (!c.includes('rounded-full')) continue;
          // círculo: largura e altura iguais · trilho de barra: baixo e largo
          const w = c.find((x) => /^w-[\d.]+$/.test(x));
          const h = c.find((x) => /^h-[\d.]+$/.test(x));
          if (w && h && w.slice(2) === h.slice(2)) continue;
          if (h && parseFloat(h.slice(2)) <= 2.5) continue;
          if (c.some((x) => ['absolute', 'inset-0', 'h-full', 'object-cover'].includes(x) || /^ring-/.test(x))) continue;
          // o que sobra com recuo horizontal é uma caixa de texto disfarçada de pílula
          if (c.some((x) => /^px-/.test(x)) || c.includes('p-0.5')) infratores.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(
      infratores,
      'Uma caixa de texto usa o raio do sistema; rounded-full é para avatar, ponto e barra de progresso.',
    ).toEqual([]);
  });
});
