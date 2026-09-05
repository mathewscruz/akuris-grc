/**
 * O ficheiro exportado é a lista que está no ecrã.
 *
 * Medido em Planos de Ação: com o filtro em «Crítica» a tabela mostrava uma
 * linha e o CSV trazia seis, de todas as prioridades. Quem filtra e exporta age
 * sobre a lista que exportou — mandar a auditoria, atribuir trabalho, cobrar
 * prazos. Receber outra lista é pior do que não ter botão nenhum, porque não há
 * sinal de que correu mal.
 *
 * O mesmo estava em Continuidade e em Contas Privilegiadas. Nesta última doía
 * mais: a coluna de estado mostra «Expirado» a quem passou da data, e o
 * ficheiro dizia «ativo» das mesmas contas — no campo que manda revogar acesso.
 *
 * A regra é simples de verificar e difícil de contornar por acidente: se um
 * ecrã dá `data={X}` à tabela, a sua exportação percorre `X`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function fontes(): string[] {
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__') andar(p);
      } else if (e.name.endsWith('.tsx')) achados.push(p.replace(/\\/g, '/'));
    }
  };
  andar('src/pages');
  andar('src/components');
  return achados;
}

/**
 * Ecrãs onde a exportação é DE PROPÓSITO mais larga do que a tabela, com o
 * motivo escrito ao lado. Vazio: por agora não há nenhum, e um acrescento aqui
 * tem de trazer a razão.
 */
const ISENTOS: string[] = [];

function exportMatchesShown(source: string, exported: string, shown: string[]): boolean {
  if (shown.includes(exported)) return true;
  // A screen with two table tabs can choose its export source with a ternary.
  // BOTH branches must be actual displayed datasets; this is not an exemption.
  const alias = source.match(new RegExp('const\\s+' + exported + '\\s*=\\s*[^;\\n?]+\\?\\s*(\\w+)\\s*:\\s*(\\w+)\\s*;'));
  return !!alias && shown.includes(alias[1]) && shown.includes(alias[2]);
}

describe('exportar o que está no ecrã', () => {
  it('a exportação percorre a mesma lista que a tabela mostra', () => {
    const falhas: string[] = [];

    for (const arquivo of fontes()) {
      if (ISENTOS.includes(arquivo)) continue;
      const fonte = readFileSync(arquivo, 'utf8');
      if (!fonte.includes('exportCSV(')) continue;

      // De que lista vive a tabela deste ecrã.
      const mostradas = [...fonte.matchAll(/<DataTable[^>]*?\bdata=\{([A-Za-z0-9_]+)\}/gs)].map((m) => m[1]);
      if (mostradas.length === 0) continue; // não é uma tabela: relatório, diálogo, resumo

      // Que lista cada `exportCSV` percorre. O segundo argumento é o corpo.
      const percorridas = [...fonte.matchAll(/exportCSV\(\s*\[[\s\S]*?\],\s*([A-Za-z0-9_]+)\s*\.map/g)].map(
        (m) => m[1],
      );

      for (const lista of percorridas) {
        if (!exportMatchesShown(fonte, lista, mostradas)) {
          falhas.push(`${arquivo}: exporta \`${lista}\`, mostra \`${mostradas.join('` ou `')}\``);
        }
      }
    }

    expect(
      falhas,
      'Exporte a lista já filtrada e ordenada — a mesma que a tabela recebe em `data`.',
    ).toEqual([]);
  });

  it('aceita seleção entre abas, mas rejeita um ramo que exporta dados fora da tela', () => {
    expect(exportMatchesShown("const selected = tab === 'history' ? history : active;", 'selected', ['history', 'active'])).toBe(true);
    expect(exportMatchesShown("const selected = tab === 'history' ? allRows : active;", 'selected', ['history', 'active'])).toBe(false);
  });

  it('o CSV não escreve valores crus onde o ecrã escreve rótulos', () => {
    /*
       O ficheiro dizia «em_andamento», «media», «frameworks» onde a tabela
       escreve «Em Andamento», «Média», «Frameworks». Quem abre o CSV no Excel
       lê o nome interno da coluna da base, e um estado com `_` no meio nem
       sequer é português.

       O sinal é o `_` numa palavra de vocabulário fechado: os rótulos do
       produto não o têm, os valores da base têm.
    */
    const suspeitos: string[] = [];
    const CRU = /\b(em_andamento|pendente_aprovacao|nao_conforme|nao_iniciado|em_revisao|nao_aplicavel)\b/;

    for (const arquivo of fontes()) {
      const fonte = readFileSync(arquivo, 'utf8');
      const blocos = [...fonte.matchAll(/exportCSV\([\s\S]{0,2000}?\n\s*\);/g)].map((m) => m[0]);
      for (const bloco of blocos) {
        const linhas = bloco.split('\n').filter((l) => {
          const t = l.trimStart();
          return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
        });
        const m = CRU.exec(linhas.join('\n'));
        if (m) suspeitos.push(`${arquivo} → ${m[0]}`);
      }
    }

    expect(
      suspeitos,
      'Escreva no CSV o rótulo que a tabela mostra, não o valor guardado.',
    ).toEqual([]);
  });
});
