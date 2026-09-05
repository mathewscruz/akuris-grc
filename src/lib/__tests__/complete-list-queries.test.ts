import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, calls: [] as any[], fail: '' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const filters: [string, unknown][] = []; const memberships: [string, string[]][] = [];
  let start = 0; let end = 999;
  const query: any = {
    select: () => query, order: () => query, abortSignal: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    in: (key: string, value: string[]) => { memberships.push([key, value]); return query; },
    range: (from: number, to: number) => { start = from; end = to; return query; },
    then: (resolve: any) => {
      state.calls.push({ table, start, end, filters, memberships });
      const rows = (state.rows[table] ?? []).filter(row => filters.every(([key, value]) => row[key] === value)
        && memberships.every(([key, values]) => values.includes(row[key])));
      return Promise.resolve({ data: rows.slice(start, end + 1), error: state.fail === table ? new Error('offline') : null }).then(resolve);
    },
  }; return query;
} } }));
import { loadControls } from '@/lib/queries/controls';
import { loadPrivilegedAccounts } from '@/lib/queries/privileged-accounts';

beforeEach(() => { state.rows = {}; state.calls = []; state.fail = ''; });
describe('complete operational lists', () => {
  it('loads 1001 controls and 1001 tests, preserving tenant filters on every page', async () => {
    state.rows.controles = Array.from({ length: 1001 }, (_, i) => ({ id: `c${i}`, empresa_id: 'a', responsavel_id: 'person' }));
    state.rows.controles.push({ id: 'foreign', empresa_id: 'b' });
    state.rows.profiles = [{ user_id: 'person', empresa_id: 'a', nome: 'Owner' }];
    state.rows.controles_testes = Array.from({ length: 1001 }, (_, i) => ({ id: `t${i}`, controle_id: 'c0', resultado: 'efetivo', data_teste: '2026-09-01' }));
    const result = await loadControls('a');
    expect(result).toHaveLength(1001);
    expect(result[0].testesCount).toBe(1001);
    expect(result[1000].responsavel_nome).toBe('Owner');
    expect(state.calls.filter(c => c.table === 'controles').map(c => c.start)).toEqual([0, 500, 1000]);
    for (const call of state.calls.filter(c => ['controles', 'profiles'].includes(c.table))) expect(call.filters).toContainEqual(['empresa_id', 'a']);
    expect(state.calls.every(c => c.memberships.every(([, ids]: any) => ids.length <= 100))).toBe(true);
  });
  it.each(['controles', 'controles_testes', 'profiles'])('rejects failed %s instead of reporting no records/owner/tests', async table => {
    state.rows.controles = [{ id: 'c', empresa_id: 'a', responsavel_id: 'person' }]; state.fail = table;
    await expect(loadControls('a')).rejects.toThrow('offline');
  });
  it('keeps absent relations distinct from a failed lookup', async () => {
    state.rows.controles = [{ id: 'c', empresa_id: 'a', responsavel_id: 'missing' }];
    expect((await loadControls('a'))[0]).toMatchObject({ testesCount: 0, responsavel_nome: null });
  });
  it('does not request unrelated tables for an empty organization', async () => {
    expect(await loadControls('a')).toEqual([]);
    expect(state.calls.map(c => c.table)).toEqual(['controles']);
  });
  it('loads all privileged accounts without mistaking a system campaign for account approval', async () => {
    state.rows.contas_privilegiadas = Array.from({ length: 1001 }, (_, i) => ({ id: `a${i}`, sistema_id: 's', empresa_id: 'a', sistemas_privilegiados: { responsavel_sistema: 'TI' } }));
    state.rows.access_reviews = [{ id: 'r', sistema_id: 's', empresa_id: 'a', nome_revisao: 'Review', status: 'em_andamento', data_limite: '2026-09-30', created_at: '2026-09-01' }];
    state.rows.access_review_items = [{ conta_id: 'a1000', review_id: 'r', decisao: 'aprovar', data_revisao: '2026-09-05' }];
    const result = await loadPrivilegedAccounts('a');
    expect(result).toHaveLength(1001);
    expect(result[0]).toMatchObject({ system_owner_name: 'TI', review_id: 'r', last_review_at: null });
    expect(result[1000].last_review_at).toBe('2026-09-05');
    expect(state.calls.filter(c => c.table === 'access_reviews').every(c => c.filters.some(([key, value]: any) => key === 'empresa_id' && value === 'a'))).toBe(true);
  });
  it('rejects a review lookup failure rather than displaying no campaign', async () => {
    state.rows.contas_privilegiadas = [{ id: 'a', empresa_id: 'a', sistema_id: 's' }];
    state.fail = 'access_reviews';
    await expect(loadPrivilegedAccounts('a')).rejects.toThrow('offline');
  });
});
