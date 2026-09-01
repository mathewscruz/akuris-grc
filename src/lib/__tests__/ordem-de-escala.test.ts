/**
 * Ordenar por criticidade tem de dar a ordem da criticidade.
 *
 * Nove tabelas deixavam ordenar por uma escala e ordenavam por alfabeto. Em
 * Controles, «do mais crítico para o menos» devolvia «Médio, Crítico, Crítico,
 * Alto»: M > C > A > B. Estava certo como texto e errado como resposta.
 *
 * O segundo bloco é o que impede a recaída: procura, no código das tabelas,
 * quem ordene uma coluna de escala sem passar por aqui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { postoDeEscala, compararEscala } from '../ordem-de-escala';

/** As grafias que existem mesmo na base, contadas em 2026-09-01. */
const GRAFIAS = [
  ['critico', 'critica', 'Crítico', 'CRÍTICA', 'crítico'],
  ['muito_alto', 'muito alto', 'Muito Alto'],
  ['alto', 'alta', 'Alto', 'ALTA'],
  ['medio', 'media', 'Médio', 'Média'],
  ['baixo', 'baixa', 'Baixo'],
];

describe('ordem de escala', () => {
  it('cada patamar vale o mesmo em qualquer grafia', () => {
    for (const grafias of GRAFIAS) {
      const postos = grafias.map(postoDeEscala);
      expect(new Set(postos).size, `${grafias.join(', ')} → ${postos.join(', ')}`).toBe(1);
      expect(postos[0]).not.toBeNull();
    }
  });

  it('mais grave vale mais', () => {
    const ordem = GRAFIAS.map((g) => postoDeEscala(g[0]) as number);
    for (let i = 1; i < ordem.length; i++) {
      expect(ordem[i - 1], `${GRAFIAS[i - 1][0]} devia valer mais que ${GRAFIAS[i][0]}`).toBeGreaterThan(ordem[i]);
    }
  });

  it('«os piores primeiro» põe o crítico à frente', () => {
    const linhas = ['medio', 'baixo', 'critico', 'alto', 'critico'];
    const desc = [...linhas].sort((a, b) => -(compararEscala(a, b) as number));
    expect(desc).toEqual(['critico', 'critico', 'alto', 'medio', 'baixo']);
  });

  it('o que não é escala continua a não ser', () => {
    for (const v of ['Contrato de serviço', 'ISO 27001', '', null, undefined, 42, 'altíssimo']) {
      expect(postoDeEscala(v), String(v)).toBeNull();
    }
    // Duas colunas de texto normal não mudam de comportamento por isto existir.
    expect(compararEscala('Ana', 'Bruno')).toBeNull();
  });

  it('sem valor fica no fundo do «mais grave primeiro»', () => {
    const desc = ['baixo', '', 'critico'].sort((a, b) => {
      const e = compararEscala(a, b);
      return e === null ? 0 : -e;
    });
    expect(desc[0]).toBe('critico');
    expect(desc[2]).toBe('');
  });
});

/*
   A recaída seria escrever a próxima tabela com `localeCompare` e uma coluna
   de criticidade. Este bloco lê o código das tabelas e obriga quem ordena uma
   escala a passar pelo comparador — directamente, ou pela `DataTable`, que já
   o tem lá dentro.
*/
const ESCALAS = /\b(criticidade|prioridade|severidade|nivel_risco|urgencia|impacto)\b/i;

function ficheirosDeEcra(): string[] {
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== 'node_modules') andar(p);
      } else if (e.name.endsWith('.tsx')) achados.push(p.replace(/\\/g, '/'));
    }
  };
  andar('src/pages');
  andar('src/components');
  return achados;
}

describe('quem ordena uma escala usa a ordem da escala', () => {
  it('nenhuma tabela ordena criticidade por alfabeto por conta própria', () => {
    const falhas: string[] = [];
    for (const p of ficheirosDeEcra()) {
      const fonte = readFileSync(p, 'utf8');
      // Só interessa quem TEM coluna de escala e ordena POR CONTA PRÓPRIA.
      const temColunaDeEscala = new RegExp(`key:\\s*'(?:${ESCALAS.source.slice(3, -3)})`, 'i').test(fonte);
      if (!temColunaDeEscala) continue;
      const ordenaSozinho = /sortField|sortDirection/.test(fonte) && /\.sort\(/.test(fonte);
      if (!ordenaSozinho) continue; // ordena pela DataTable, que já sabe
      if (!fonte.includes('compararEscala') && !fonte.includes('postoDaSeveridade')) {
        falhas.push(p);
      }
    }
    expect(
      falhas,
      'Chame `compararEscala` antes de comparar como texto (src/lib/ordem-de-escala.ts).',
    ).toEqual([]);
  });

  it('a DataTable continua a saber ordenar escalas', () => {
    const fonte = readFileSync('src/components/ui/data-table.tsx', 'utf8');
    expect(fonte.includes('compararEscala')).toBe(true);
    // Antes do `localeCompare`, ou não serve de nada.
    expect(fonte.indexOf('compararEscala(a, b)')).toBeLessThan(fonte.indexOf('localeCompare'));
  });
});
