/**
 * Toda coluna pedida ao PostgREST existe na base — e nenhuma leitura que
 * alimenta número na tela deita fora o erro.
 *
 * O caso: a aba "Análise de Documentos" pedia
 * `.select('id, score_aderencia')` a `gap_analysis_adherence_assessments`.
 * A coluna chama-se `percentual_conformidade`. O PostgREST respondia 400, o
 * `error` do supabase-js nunca era lido, `data` vinha `null`, e os dois
 * indicadores do topo — "documentos analisados" e "conformidade média" —
 * ficavam em `0` e `—` **para sempre**. Ao lado, na mesma aba, a lista de
 * "Avaliações Recentes" mostrava a análise concluída com 67%.
 *
 * A tela contradizia-se e ninguém via porquê: o typecheck passa (o cliente é
 * tipado como `any` nestes pontos), o teste passa, o log fica mudo. Só o
 * separador de rede do navegador dizia a verdade.
 *
 * São duas regras, e a segunda é a que importa:
 *
 *   1. os nomes de coluna citados nos `.select()` do módulo têm de existir no
 *      esquema versionado em `src/integrations/supabase/types.ts`;
 *   2. quem lê para desenhar número **tem de olhar para o `error`** — cair
 *      para `|| []` sem o inspecionar transforma consulta falhada em "não há
 *      nada", que é a mesma coisa que mentir com confiança.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes, ler } from './_fontes';

const TYPES = 'src/integrations/supabase/types.ts';

/** Todos os identificadores que aparecem como propriedade no esquema gerado. */
function colunasConhecidas(): Set<string> {
  const texto = readFileSync(TYPES, 'utf8');
  const nomes = new Set<string>();
  for (const m of texto.matchAll(/^\s{10,}([a-z][a-z0-9_]*)\??:/gm)) {
    nomes.add(m[1]);
  }
  return nomes;
}

/**
 * Nomes citados dentro de `.select('...')`.
 *
 * Só interessam os identificadores simples em `snake_case`. Embeds
 * (`evidence_library(valido_ate)`), apelidos (`req:tabela(...)`), `*` e
 * `count` ficam de fora — o objetivo é apanhar o erro de digitação numa
 * coluna, não validar a gramática inteira do PostgREST.
 */
function colunasCitadas(texto: string): Array<{ coluna: string; trecho: string }> {
  const achados: Array<{ coluna: string; trecho: string }> = [];
  for (const m of texto.matchAll(/\.select\(\s*(['"`])([^'"`]*)\1/g)) {
    const lista = m[2];
    if (lista.includes('*')) continue;
    for (const bruto of lista.split(',')) {
      const parte = bruto.trim();
      if (!parte || parte.includes('(') || parte.includes(':') || parte.includes('!')) continue;
      if (!/^[a-z][a-z0-9_]*$/.test(parte)) continue;
      achados.push({ coluna: parte, trecho: lista.slice(0, 70) });
    }
  }
  return achados;
}

function fontesDoGap(): string[] {
  return fontes().filter(
    (f) => f.includes('gap-analysis') || f.includes('GapAnalysis') || f.includes('useGapAnalysis'),
  );
}

describe('coluna que existe', () => {
  it('todo .select() do Gap Analysis cita coluna que existe no esquema', () => {
    const conhecidas = colunasConhecidas();
    // Se o esquema não pôde ser lido, a guarda não tem como julgar — e uma
    // guarda que passa por não conseguir ler é pior do que não existir.
    expect(conhecidas.size).toBeGreaterThan(200);

    const inventadas: string[] = [];
    for (const f of fontesDoGap()) {
      for (const { coluna, trecho } of colunasCitadas(ler(f))) {
        if (!conhecidas.has(coluna)) inventadas.push(`${f}: "${coluna}" em .select('${trecho}')`);
      }
    }

    expect(inventadas, `Coluna pedida ao PostgREST que não existe na base:\n${inventadas.join('\n')}`)
      .toEqual([]);
  });

  it('DocumentsHero não desenha indicador a partir de consulta cujo erro não olhou', () => {
    const f = 'src/components/gap-analysis/v2/DocumentsHero.tsx';
    const texto = ler(f);

    // Os três `Promise.all` desta tela alimentam KPIs. O erro tem de ser
    // inspecionado antes de qualquer `|| []`.
    expect(
      /\.error\b/.test(texto),
      `${f} lê para desenhar número e nunca inspeciona o error da consulta`,
    ).toBe(true);

    expect(
      /if\s*\(\s*erro\s*\)\s*throw\s+erro/.test(texto),
      `${f} tem de rebentar quando a leitura falha, em vez de desenhar zeros`,
    ).toBe(true);
  });
});
