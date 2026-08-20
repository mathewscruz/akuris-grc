/**
 * O que o ecrã vazio promete tem de existir no código.
 *
 * O caso que originou esta guarda: a aba "Biblioteca de Evidências" dizia, no
 * seu estado vazio,
 *
 *     "Faça upload de evidências dentro de qualquer requisito do Gap Analysis.
 *      Elas aparecerão aqui automaticamente para reuso."
 *
 * e não apareciam. O anexo do requisito ia para
 * `gap_analysis_evaluations.evidence_files`, no bucket `documentos`; a
 * Biblioteca lê `evidence_library`, escrita apenas pelo módulo Controles,
 * noutro bucket. Na base de desenvolvimento: o requisito A.5.1 tinha 1
 * ficheiro anexado e a `evidence_library` tinha **zero** linhas. A função que
 * criaria a entrada, `uploadAndCreate`, estava escrita no hook e não era
 * chamada de lado nenhum.
 *
 * Um estado vazio que dá uma instrução falsa é pior do que um ecrã em branco:
 * a pessoa faz o que ele manda, volta, não vê nada, e conclui que perdeu o
 * ficheiro.
 *
 * O mesmo padrão apanhou a herança entre frameworks:
 * `HerancaCrossFramework` faz `if (propostas.length === 0) return null` e a
 * tabela que a alimenta estava vazia porque o seed casava `GV.OC` com
 * `GV.OC-01` e `Art.46` com `Art. 46`. A funcionalidade mais valiosa do
 * módulo estava desligada e invisível ao mesmo tempo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { ler } from './_fontes';

const MIGRATIONS = 'supabase/migrations';

function migrations(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => `${MIGRATIONS}/${f}`);
}

describe('promessa do ecrã vazio', () => {
  it('a evidência anexada num requisito chega mesmo à biblioteca', () => {
    const gatilho = migrations()
      .map((f) => readFileSync(f, 'utf8'))
      .find((sql) => /espelhar_evidencia_na_biblioteca/.test(sql));

    expect(
      gatilho,
      'A Biblioteca promete que o anexo do requisito aparece nela. Sem o gatilho que espelha evidence_files em evidence_library, a promessa é falsa.',
    ).toBeDefined();

    expect(
      /CREATE TRIGGER[\s\S]{0,200}gap_analysis_evaluations/i.test(gatilho ?? ''),
      'O gatilho tem de estar ligado a gap_analysis_evaluations — é lá que o anexo cai.',
    ).toBe(true);
  });

  it('a biblioteca tem por onde acrescentar prova', () => {
    const hub = ler('src/components/gap-analysis/EvidenceLibraryHub.tsx');
    expect(
      /uploadAndCreate/.test(hub),
      'EvidenceLibraryHub não chama uploadAndCreate: a biblioteca só pode ser lida, nunca alimentada.',
    ).toBe(true);
  });

  it('o cruzamento entre frameworks é semeado com códigos que existem', () => {
    const seeds = migrations()
      .map((f) => ({ f, sql: readFileSync(f, 'utf8') }))
      .filter(({ sql }) => /gap_analysis_requirement_crosswalk/i.test(sql))
      .filter(({ sql }) => /INSERT INTO/i.test(sql))
      // Migration já aplicada que se declara substituída fica no histórico,
      // não na regra: o que interessa é o que está em vigor.
      .filter(({ sql }) => !/SUPERSEDED-BY:/.test(sql))
      // Os comentários citam os códigos errados de propósito, para explicar o
      // defeito. Sem os apagar, a guarda acusa a própria documentação.
      .map(({ f, sql }) => ({ f, sql: sql.replace(/^\s*--.*$/gm, '') }));

    expect(seeds.length, 'Nenhuma migration semeia o crosswalk.').toBeGreaterThan(0);

    /*
      Os códigos que falharam: categoria do NIST em vez de subcategoria
      (`'GV.OC'` sem o `-01`) e artigo da LGPD sem o espaço (`'Art.46'`).
      Ambos passam num INSERT ... SELECT sem erro nenhum — só não casam.
    */
    const errados: string[] = [];
    for (const { f, sql } of seeds) {
      for (const m of sql.matchAll(/'((?:GV|ID|PR|DE|RS|RC)\.[A-Z]{2})'/g)) {
        errados.push(`${f}: '${m[1]}' é função/categoria do NIST, não subcategoria (falta o -NN)`);
      }
      for (const m of sql.matchAll(/'(Art\.\d)/g)) {
        errados.push(`${f}: '${m[1]}...' — a LGPD do catálogo usa "Art. N", com espaço`);
      }
    }

    expect(errados, `Código de seed que não casa com o catálogo:\n${errados.join('\n')}`).toEqual([]);
  });

  it('a migration do cruzamento acusa quando um par não casa', () => {
    const sql = migrations()
      .map((f) => readFileSync(f, 'utf8'))
      .find((s) => /heranca|crosswalk/i.test(s) && /RAISE EXCEPTION/i.test(s));

    expect(
      sql,
      'O seed do crosswalk tem de rebentar quando o número de linhas não bate com o de pares — foi o silêncio que escondeu isto durante dois dias.',
    ).toBeDefined();
  });
});
