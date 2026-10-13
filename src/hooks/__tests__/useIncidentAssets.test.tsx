import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIncidentAssets } from '../useIncidentAssets';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/entity-search', () => ({ fetchEntitiesByIds: api.fetch }));
afterEach(cleanup);
beforeEach(() => api.fetch.mockReset().mockResolvedValue([{ id: 'asset-a', titulo: 'Servidor ERP' }]));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('incident asset resolution', () => {
  it('resolves only linked assets in the current company', async () => {
    const { result } = renderHook(() => useIncidentAssets('company-a', ['asset-a', 'asset-a']), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.fetch.mock.calls[0].slice(0, 3)).toEqual(['ativo', 'company-a', ['asset-a']]);
    expect(result.current.data?.[0].id).toBe('asset-a');
  });

  it('does not fetch without company context or without links', () => {
    renderHook(() => useIncidentAssets(undefined, ['asset-a']), { wrapper });
    renderHook(() => useIncidentAssets('company-a', []), { wrapper });
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('does not reuse assets when switching companies', async () => {
    const { result, rerender } = renderHook(({ company }) => useIncidentAssets(company, ['asset-a']), {
      wrapper, initialProps: { company: 'company-a' },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    api.fetch.mockImplementation(() => new Promise(() => {}));
    rerender({ company: 'company-b' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(api.fetch.mock.calls.at(-1)?.[1]).toBe('company-b'));
  });

  it('distinguishes unresolved assets from query failure', async () => {
    api.fetch.mockResolvedValue([]);
    const missing = renderHook(() => useIncidentAssets('company-a', ['missing']), { wrapper });
    await waitFor(() => expect(missing.result.current.isSuccess).toBe(true));
    expect(missing.result.current.data).toEqual([]);
    api.fetch.mockRejectedValue(new Error('Network failure'));
    const failed = renderHook(() => useIncidentAssets('company-a', ['failed']), { wrapper });
    await waitFor(() => expect(failed.result.current.isError).toBe(true));
    expect(failed.result.current.data).toBeUndefined();
  });
});