import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as Error | null, ranges: [] as number[][], tenants: [] as unknown[][], patterns: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  let start = 0; let end = 199;
  let selectedIds: string[] | undefined;
  const query = {
    select: () => query,
    in: (_field: string, ids: string[]) => { selectedIds = ids; return query; },
    eq: (...args: unknown[]) => { database.tenants.push(args); return query; },
    order: () => query,
    or: (pattern: string) => { database.patterns.push(pattern); return query; },
    range: (from: number, to: number) => { start = from; end = to; database.ranges.push([from, to]); return query; },
    abortSignal: () => query,
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: selectedIds ? database.rows.filter((row) => selectedIds?.includes(String(row.id))) : database.rows.slice(start, end + 1), error: database.error }).then(resolve),
  };
  return query;
} } }));

import { fetchEntitiesByIds, queryTokens, searchEntityRows, searchPattern } from '../entity-search';
import { isIncidenteCriticoEmCurso } from '../metrics/incidentes';
beforeEach(() => { database.rows = []; database.error = null; database.ranges = []; database.tenants = []; database.patterns = []; });

describe('busca paginada preserva escopo e acentos', () => {
  it('oferece navegação inicial apenas quando explicitamente solicitada pelo seletor', async () => {
    database.rows = Array.from({ length: 85 }, (_, index) => ({ id: String(index), nome: 'Controle', codigo: `CTRL-${index}` }));
    expect((await searchEntityRows('controle', 'tenant-a', [], 40)).rows).toHaveLength(0);
    const result = await searchEntityRows('controle', 'tenant-a', [], 40, undefined, true);
    expect(result.rows).toHaveLength(40);
    expect(result.hasMore).toBe(true);
    expect((await searchEntityRows('controle', 'tenant-a', [], 120, undefined, true)).rows).toHaveLength(85);
  });
  it('resolve seleções antigas fora da primeira página sem alterar ou preencher vínculos ausentes', async () => {
    database.rows = Array.from({ length: 505 }, (_, index) => ({ id: String(index), nome: 'Controle', codigo: `CTRL-${index}` }));
    const result = await fetchEntitiesByIds('controle', 'tenant-a', ['504', 'missing']);
    expect(result.map((row) => row.id)).toEqual(['504']);
    expect(database.tenants).toEqual([['empresa_id', 'tenant-a']]);
    await expect(fetchEntitiesByIds('controle', null, ['504'])).resolves.toEqual([]);
    database.error = new Error('Consulta falhou');
    await expect(fetchEntitiesByIds('controle', 'tenant-a', ['504'])).rejects.toThrow('Consulta falhou');
  });
  it('encontra um resultado além dos 400 primeiros candidatos', async () => {
    database.rows = Array.from({ length: 405 }, (_, index) => ({ id: String(index), nome: index === 404 ? 'Revisão de acessos' : 'Sem correspondência', codigo: `CTRL-${index}` }));
    const result = await searchEntityRows('controle', 'tenant-a', queryTokens('revisao acessos'));
    expect(result.rows.map((row) => row.id)).toEqual(['404']);
    expect(result.hasMore).toBe(false);
    expect(database.ranges).toEqual([[0, 199], [200, 399], [400, 599]]);
    expect(database.tenants).toEqual(Array.from({ length: 3 }, () => ['empresa_id', 'tenant-a']));
  });
  it('informa que há mais resultados sem inventar o total', async () => {
    database.rows = Array.from({ length: 8 }, (_, index) => ({ id: String(index), nome: 'Controle', codigo: `CTRL-${index}` }));
    const first = await searchEntityRows('controle', 'tenant-a', ['controle'], 5);
    expect(first.rows).toHaveLength(5); expect(first.hasMore).toBe(true);
    const next = await searchEntityRows('controle', 'tenant-a', ['controle'], 25);
    expect(next.rows).toHaveLength(8); expect(next.hasMore).toBe(false);
  });
  it('recusa consulta sem empresa e distingue erro de vazio', async () => {
    await expect(searchEntityRows('controle', null, ['controle'])).resolves.toEqual({ rows: [], hasMore: false });
    expect(database.ranges).toHaveLength(0);
    database.error = new Error('Backend indisponível');
    await expect(searchEntityRows('controle', 'tenant-a', ['controle'])).rejects.toThrow('Backend indisponível');
  });
  it('cancela consultas obsoletas antes de ler dados', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(searchEntityRows('controle', 'tenant-a', ['controle'], 5, controller.signal)).rejects.toThrow();
    expect(database.ranges).toHaveLength(0);
  });
  it('mantém caracteres de controle do filtro dentro de um literal delimitado', () => {
    const pattern = searchPattern('x,y)"_%');
    expect(pattern).toBe('"%x,y)\\"\\\\_\\\\%%"');
  });
});

it('alerta somente para incidentes críticos ainda em curso, aceitando variantes gravadas', () => {
  expect(isIncidenteCriticoEmCurso({ criticidade: 'Crítico', status: 'em_investigacao' })).toBe(true);
  expect(isIncidenteCriticoEmCurso({ criticidade: 'critico', status: 'resolvido' })).toBe(false);
  expect(isIncidenteCriticoEmCurso({ criticidade: 'alto', status: 'aberto' })).toBe(false);
});
