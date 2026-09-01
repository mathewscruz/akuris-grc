/**
 * O score do fornecedor tem uma escala de cor só.
 *
 * ## O que estava
 *
 * Havia TRÊS, e nenhuma se via bem:
 *
 *  · lista de avaliações — quatro faixas (80/60/40), com `info` em 60–79;
 *  · lista de fornecedores — três faixas (80/60);
 *  · relatório do fornecedor — quatro, com o seu próprio mapa de classes.
 *
 * O mesmo fornecedor mudava de cor conforme o ecrã em que era visto.
 *
 * E a faixa mais comum saía CINZENTA. `StatusBadge` tem duas famílias: sem
 * `mark` desenha-se como ESTADO, e ali `info` mapeia para `rest` — o tom de
 * «nada a fazer». Medido no navegador: um score de 62,5% chegava ao ecrã com
 * `bg-state-rest-surface text-state-rest`, a mesma cor de um campo vazio.
 *
 * ## A regra
 *
 * A cor do score vem de `resolveScoreDueDiligenceTone`, e de mais lado nenhum.
 * Ele devolve `mark` — a letra A–D — que é o que põe o chip na família de
 * severidade, onde as quatro cores existem, e o que impede a cor de ser o
 * único sinal (WCAG 1.4.1), como já acontece no mapa de risco com C/A/M/B.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveScoreDueDiligenceTone } from '@/lib/status-tone';

describe('a escala do score', () => {
  it('tem as quatro faixas, e nenhuma cinzenta', () => {
    const faixas = [95, 70, 50, 20].map(resolveScoreDueDiligenceTone);
    expect(faixas.map((f) => f.tone)).toEqual(['success', 'warning', 'orange', 'destructive']);
    // `info` e `neutral` desenham-se cinzentos na família de estado.
    expect(faixas.some((f) => f.tone === 'info' || f.tone === 'neutral')).toBe(false);
  });

  it('leva sempre marca, que é o que dá cor ao chip', () => {
    /* Sem `mark`, o `StatusBadge` desenha-se como ESTADO e o tom passa pelo
       `STATE_FROM_TONE` — onde `info` vira `rest`, cinzento. A marca não é
       decoração: é o que escolhe a família certa. */
    for (const s of [95, 70, 50, 20]) {
      expect(resolveScoreDueDiligenceTone(s).mark, `score ${s}`).toBeTruthy();
    }
    expect([95, 70, 50, 20].map((s) => resolveScoreDueDiligenceTone(s).mark)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('as marcas distinguem-se entre si', () => {
    /* A inicial do rótulo não servia: «Regular» e «Ruim» começam ambas por R.
       A–D lê-se em qualquer língua e traz a ordem consigo. */
    const marcas = [95, 70, 50, 20].map((s) => resolveScoreDueDiligenceTone(s).mark);
    expect(new Set(marcas).size).toBe(marcas.length);
  });

  it('sem score não inventa cor', () => {
    for (const v of [null, undefined, NaN]) {
      expect(resolveScoreDueDiligenceTone(v as number | null).tone).toBe('neutral');
    }
  });

  it('a fronteira de cada faixa cai do lado certo', () => {
    expect(resolveScoreDueDiligenceTone(80).tone).toBe('success');
    expect(resolveScoreDueDiligenceTone(79.9).tone).toBe('warning');
    expect(resolveScoreDueDiligenceTone(60).tone).toBe('warning');
    expect(resolveScoreDueDiligenceTone(59.9).tone).toBe('orange');
    expect(resolveScoreDueDiligenceTone(40).tone).toBe('orange');
    expect(resolveScoreDueDiligenceTone(39.9).tone).toBe('destructive');
    // Zero É um score, e é o pior deles — não é «sem score».
    expect(resolveScoreDueDiligenceTone(0).tone).toBe('destructive');
  });
});

describe('ninguém volta a inventar a sua', () => {
  function ficheiros(dir: string): string[] {
    const achados: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name).replace(/\\/g, '/');
      if (e.isDirectory()) {
        if (e.name !== '__tests__') achados.push(...ficheiros(p));
      } else if (p.endsWith('.tsx') || p.endsWith('.ts')) achados.push(p);
    }
    return achados;
  }

  it('nenhum ecrã de due diligence compara o score com limiares à mão', () => {
    const falhas: string[] = [];
    const LIMIAR = /score[A-Za-z_]*\s*>=\s*(80|60|40)\b/;
    /*
       Só o que decide COR. Os mesmos limiares aparecem a decidir
       comportamento — `IntegrationSuggestions` usa-os para escolher o nível de
       risco a criar e que sugestão mostrar —, e isso é regra de negócio, não
       paleta. Uma guarda que reprovasse as duas obrigava a contorná-la.

       `getScoreBadge` fica de fora pela mesma razão: devolve o RÓTULO da
       faixa, não a cor, e os seus limiares mudam junto com os do resolvedor.
    */
    const DECIDE_COR = /\btone\b|text-|bg-|stroke-|border-/;
    const ISENTOS = ['getScoreBadge'];

    for (const f of ficheiros('src/components/due-diligence')) {
      const linhas = readFileSync(f, 'utf8').split('\n');
      linhas.forEach((linha, i) => {
        const t = linha.trimStart();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        if (!LIMIAR.test(linha) || !DECIDE_COR.test(linha)) return;
        // A que função pertence a linha, olhando para trás.
        const contexto = linhas.slice(Math.max(0, i - 12), i).join('\n');
        if (ISENTOS.some((nome) => contexto.includes(nome))) return;
        falhas.push(`${f}:${i + 1}`);
      });
    }

    expect(
      falhas,
      'A cor do score vem de `resolveScoreDueDiligenceTone` (src/lib/status-tone.tsx).',
    ).toEqual([]);
  });
});
