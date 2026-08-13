import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline, runsToPlain, type ListNode, type TableNode, type HeadingNode } from '../docgen-render';

/**
 * O parser é o contrato único entre preview, DOCX e PDF. Se ele quebrar ou
 * perder conteúdo, o documento exportado sai errado sem nenhum sinal em tela.
 */
describe('docgen-render — parseInline', () => {
  it('marca negrito, itálico e código', () => {
    const runs = parseInline('Texto **forte**, *ênfase* e `codigo`.');
    expect(runs.find((r) => r.bold)?.text).toBe('forte');
    expect(runs.find((r) => r.italic)?.text).toBe('ênfase');
    expect(runs.find((r) => r.code)?.text).toBe('codigo');
    expect(runsToPlain(runs)).toBe('Texto forte, ênfase e codigo.');
  });

  it('não perde texto com ** desbalanceado', () => {
    const runs = parseInline('Retenção de **12 meses');
    expect(runsToPlain(runs)).toBe('Retenção de **12 meses');
  });

  it('preserva códigos de requisito entre colchetes', () => {
    const runs = parseInline('[A.8.13] O backup deve ser **diário**.');
    expect(runsToPlain(runs)).toContain('[A.8.13]');
  });

  it('devolve pelo menos um run para string vazia', () => {
    expect(parseInline('')).toHaveLength(1);
  });
});

describe('docgen-render — parseMarkdown', () => {
  it('reconhece títulos de nível 2 e 3 e limita o nível máximo a 4', () => {
    const nodes = parseMarkdown('## Escopo\n### Detalhe\n##### Fundo');
    const headings = nodes.filter((n): n is HeadingNode => n.type === 'heading');
    expect(headings.map((h) => h.level)).toEqual([2, 3, 4]);
    expect(runsToPlain(headings[0].runs)).toBe('Escopo');
  });

  it('agrupa listas com marcador incluindo sub-itens indentados', () => {
    const nodes = parseMarkdown('- Primeiro\n  - Sub item\n- Segundo');
    const list = nodes.find((n): n is ListNode => n.type === 'list')!;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(3);
    expect(list.items[1].level).toBe(1);
  });

  it('agrupa listas numeradas separadamente das com marcador', () => {
    const nodes = parseMarkdown('1. Um\n2. Dois\n\n- Bullet');
    const lists = nodes.filter((n): n is ListNode => n.type === 'list');
    expect(lists).toHaveLength(2);
    expect(lists[0].ordered).toBe(true);
    expect(lists[1].ordered).toBe(false);
  });

  it('converte tabela GFM em header + linhas', () => {
    const md = [
      '| Atividade | CISO | DPO |',
      '| --- | --- | --- |',
      '| Aprovar a política | A | C |',
      '| Revisar anualmente | R | I |',
    ].join('\n');
    const table = parseMarkdown(md).find((n): n is TableNode => n.type === 'table')!;
    expect(table.header.map(runsToPlain)).toEqual(['Atividade', 'CISO', 'DPO']);
    expect(table.rows).toHaveLength(2);
    expect(runsToPlain(table.rows[0][0])).toBe('Aprovar a política');
  });

  it('mantém como parágrafo a "tabela" sem linha separadora (não perde conteúdo)', () => {
    const md = '| Atividade | CISO |\n| Aprovar | A |';
    const nodes = parseMarkdown(md);
    expect(nodes.every((n) => n.type !== 'table')).toBe(true);
    const plain = nodes.map((n) => ('runs' in n ? runsToPlain(n.runs) : '')).join(' ');
    expect(plain).toContain('Aprovar');
  });

  it('tolera linha de tabela com número de colunas diferente do cabeçalho', () => {
    const md = '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 |\n';
    const table = parseMarkdown(md).find((n): n is TableNode => n.type === 'table')!;
    expect(table.header).toHaveLength(3);
    expect(table.rows[0]).toHaveLength(2);
  });

  it('trata citação em múltiplas linhas como um único bloco', () => {
    const nodes = parseMarkdown('> Regra geral\n> aplicável a todos');
    const quotes = nodes.filter((n) => n.type === 'quote');
    expect(quotes).toHaveLength(1);
  });

  it('separa parágrafos por linha em branco e junta linhas quebradas', () => {
    const nodes = parseMarkdown('Linha um\nainda o mesmo parágrafo\n\nOutro parágrafo');
    const paras = nodes.filter((n) => n.type === 'paragraph');
    expect(paras).toHaveLength(2);
    expect(runsToPlain((paras[0] as any).runs)).toBe('Linha um ainda o mesmo parágrafo');
  });

  it('não lança e devolve vazio para entradas nulas', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(undefined as unknown as string)).toEqual([]);
    expect(() => parseMarkdown('-sem espaço\n|||\n**')).not.toThrow();
  });

  it('não perde nenhum caractere visível de um conteúdo realista', () => {
    const md = [
      '## Objetivo',
      'Definir **regras** de backup.',
      '',
      '- Backup diário',
      '- Retenção de 12 meses',
      '',
      '| Papel | R |',
      '| --- | --- |',
      '| CISO | X |',
    ].join('\n');
    const nodes = parseMarkdown(md);
    const plain = nodes
      .map((n) => {
        if (n.type === 'table') return [...n.header, ...n.rows.flat()].map(runsToPlain).join(' ');
        if (n.type === 'list') return n.items.map((i) => runsToPlain(i.runs)).join(' ');
        return runsToPlain((n as any).runs);
      })
      .join(' ');
    ['Objetivo', 'regras', 'Backup diário', 'Retenção de 12 meses', 'CISO'].forEach((frag) => {
      expect(plain).toContain(frag);
    });
  });
});
