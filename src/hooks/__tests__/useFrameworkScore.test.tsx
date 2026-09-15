import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFrameworkScore } from '../useFrameworkScore';
import { getFrameworkConfig } from '@/lib/framework-configs';

const mock = vi.hoisted(() => ({ empresaId: 'tenant-one', read: vi.fn(), catalogue: vi.fn() }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ profile: { empresa_id: mock.empresaId } }) }));
vi.mock('@/lib/i18n-global', () => ({ tGlobal: (key: string) => key }));
vi.mock('@/lib/framework-requirements', () => ({ fetchFrameworkRequirements: (...args: unknown[]) => mock.catalogue(...args) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const filters: Record<string, string> = {};
  const chain = {
    select: () => chain, order: () => chain, range: () => chain,
    eq: (key: string, value: string) => { filters[key] = value; return chain; },
    abortSignal: () => mock.read(table, filters),
  };
  return chain;
} } }));
const config = getFrameworkConfig('default')!;
const evaluations = [{ requirement_id: 'r1', conformity_status: 'conforme' }, { requirement_id: 'r2', conformity_status: 'parcial' }];
beforeEach(() => {
  mock.empresaId = 'tenant-one'; mock.read.mockReset(); mock.catalogue.mockReset();
  mock.catalogue.mockResolvedValue(['r1', 'r2'].map(id => ({ id, codigo: id, peso: 1, categoria: 'Gestão' })));
  mock.read.mockImplementation(async table => ({ data: table === 'gap_analysis_evaluations' ? evaluations : [], error: null }));
});
afterEach(cleanup);

describe('framework scores refresh without unmounting the workspace', () => {
  it('keeps the last score visible while refreshing and then updates it', async () => {
    const { result, rerender } = renderHook(({ refresh }) => useFrameworkScore('fw1', config, refresh), { initialProps: { refresh: 0 } });
    await waitFor(() => expect(result.current.overallScore).toBe(75));
    let release!: (value: unknown) => void;
    mock.read.mockImplementation(table => table === 'gap_analysis_evaluations'
      ? new Promise(resolve => { release = resolve; }) : Promise.resolve({ data: [], error: null }));
    rerender({ refresh: 1 });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.overallScore).toBe(75);
    await act(async () => { release({ data: evaluations.map(e => ({ ...e, conformity_status: 'conforme' })), error: null }); });
    await waitFor(() => expect(result.current.overallScore).toBe(100));
    expect(result.current.refreshing).toBe(false);
  });
  it('preserves existing data but reports a background read failure instead of zeroing the score', async () => {
    const { result, rerender } = renderHook(({ refresh }) => useFrameworkScore('fw1', config, refresh), { initialProps: { refresh: 0 } });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    mock.read.mockResolvedValue({ data: null, error: new Error('read failed') });
    rerender({ refresh: 1 });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current).toMatchObject({ overallScore: 75, hasData: true, loading: false, refreshing: false });
  });
  it('does not reuse one company’s score when the company changes', async () => {
    const { result, rerender } = renderHook(() => useFrameworkScore('fw1', config, 0));
    await waitFor(() => expect(result.current.overallScore).toBe(75));
    mock.empresaId = 'tenant-two'; mock.read.mockImplementation(() => new Promise(() => {}));
    rerender();
    expect(result.current).toMatchObject({ hasData: false, loading: true, overallScore: 0 });
    expect(mock.read).toHaveBeenCalledWith('gap_analysis_evaluations', { framework_id: 'fw1', empresa_id: 'tenant-two' });
  });
  it('ignores a late result for a framework that is no longer open', async () => {
    let release!: (value: unknown) => void;
    mock.read.mockImplementation((table, filters) => table === 'gap_analysis_evaluations' && filters.framework_id === 'old'
      ? new Promise(resolve => { release = resolve; }) : Promise.resolve({ data: [], error: null }));
    const { result, rerender } = renderHook(({ id }) => useFrameworkScore(id, config, 0), { initialProps: { id: 'old' } });
    rerender({ id: 'new' });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    await act(async () => { release({ data: evaluations, error: null }); });
    expect(result.current.overallScore).toBe(0);
  });
  it('distinguishes an initial read failure from a loaded empty catalogue', async () => {
    mock.read.mockResolvedValue({ data: null, error: new Error('unavailable') });
    const { result } = renderHook(() => useFrameworkScore('fw1', config, 0));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.hasData).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});
