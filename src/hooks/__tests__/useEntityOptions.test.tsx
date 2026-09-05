import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntityOptions } from '../useEntityOptions';

const tenant = vi.hoisted(() => ({ empresaId: 'tenant-a' }));
const api = vi.hoisted(() => ({ search: vi.fn(), selected: vi.fn() }));
vi.mock('@/hooks/useEmpresaId', () => ({ useEmpresaId: () => tenant }));
vi.mock('@/lib/entity-search', () => ({ searchEntityRows: api.search, fetchEntitiesByIds: api.selected, queryTokens: (q: string) => q.split(/\s+/).filter(Boolean) }));
afterEach(cleanup);
beforeEach(() => {
  tenant.empresaId = 'tenant-a';
  api.search.mockReset().mockResolvedValue({ rows: [], hasMore: false });
  api.selected.mockReset().mockResolvedValue([{ id: 'old', titulo: 'Vínculo antigo' }]);
});
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('opções de vínculo', () => {
  it('carrega o vínculo salvo com o seletor fechado e não consulta opções sem necessidade', async () => {
    const { result } = renderHook(() => useEntityOptions('controle', false, ['old']), { wrapper });
    await waitFor(() => expect(result.current.selectedRows).toHaveLength(1));
    expect(api.search).not.toHaveBeenCalled();
    expect(api.selected.mock.calls[0].slice(0, 3)).toEqual(['controle', 'tenant-a', ['old']]);
  });
  it('carrega mais resultados e reinicia a paginação em uma nova busca', async () => {
    const { result } = renderHook(() => useEntityOptions('controle', true, []), { wrapper });
    await waitFor(() => expect(api.search).toHaveBeenCalled());
    act(() => result.current.showMore());
    await waitFor(() => expect(api.search.mock.calls.at(-1)?.[3]).toBe(80));
    act(() => result.current.setSearch('acesso'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows).toEqual([]);
    await waitFor(() => expect(api.search.mock.calls.at(-1)?.slice(0, 4)).toEqual(['controle', 'tenant-a', ['acesso'], 40]));
  });
  it('não apresenta os registros da empresa anterior durante a troca', async () => {
    api.search.mockResolvedValue({ rows: [{ id: 'a' }], hasMore: false });
    const { result, rerender } = renderHook(() => useEntityOptions('controle', true, []), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    api.search.mockImplementation(() => new Promise(() => {}));
    tenant.empresaId = 'tenant-b';
    rerender();
    expect(result.current.rows).toEqual([]);
    await waitFor(() => expect(api.search.mock.calls.at(-1)?.[1]).toBe('tenant-b'));
  });
  it('distingue falha de consulta de lista vazia', async () => {
    api.search.mockRejectedValue(new Error('Falha'));
    const { result } = renderHook(() => useEntityOptions('controle', true, []), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasMore).toBe(false);
  });
});
