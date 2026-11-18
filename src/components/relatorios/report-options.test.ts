import { describe, it, expect } from 'vitest';
import { filtrarPeriodo, aplicarOpcoes } from './generateTemplatePDF';
import { parseDestinatarios } from './RelatorioDialog';

const agora = new Date('2026-11-18T12:00:00Z');

describe('opções de relatório', () => {
  it('período de 30 dias exclui registos mais antigos', () => {
    const rows = [{ created_at: '2026-11-10' }, { created_at: '2026-09-01' }];
    expect(filtrarPeriodo(rows, 30, 'created_at', agora)).toHaveLength(1);
  });
  it('todo o histórico mantém tudo', () => {
    expect(filtrarPeriodo([{ created_at: '2020-01-01' }], null, 'created_at', agora)).toHaveLength(1);
  });
  it('sem detalhes remove tabelas e mantém indicadores', () => {
    const out = aplicarOpcoes([{ title: 'A', metrics: [{ label: 'x', value: 1 }], tableHeaders: ['h'], tableRows: [['1']], colWidths: [10] }] as any, { incluirDetalhes: false });
    expect(out[0].tableRows).toBeUndefined();
    expect(out[0].metrics).toHaveLength(1);
  });
  it('diretoria vê no máximo 10 linhas', () => {
    const rows = Array.from({ length: 25 }, (_, i) => [String(i)]);
    const out = aplicarOpcoes([{ title: 'A', tableHeaders: ['h'], tableRows: rows, colWidths: [10] }] as any, { publico: 'diretoria' });
    expect(out[0].tableRows).toHaveLength(10);
  });
  it('e-mails inválidos são detetados', () => {
    expect(parseDestinatarios('a@b.com, errado')).toEqual({ validos: ['a@b.com'], invalidos: ['errado'] });
  });
});
