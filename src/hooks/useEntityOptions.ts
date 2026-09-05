import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useDebounce } from '@/hooks/useDebounce';
import { type EntityKey, fetchEntitiesByIds, queryTokens, searchEntityRows } from '@/lib/entity-search';

export function useEntityOptions(entidade: EntityKey, open: boolean, selectedIds: string[]) {
  const { empresaId } = useEmpresaId();
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(40);
  const settledSearch = useDebounce(search, 250);
  const waiting = search !== settledSearch;
  const options = useQuery({
    queryKey: ['entity-options', entidade, empresaId, settledSearch, limit],
    queryFn: ({ signal }) => searchEntityRows(entidade, empresaId, queryTokens(settledSearch), limit, signal, true),
    enabled: open && !waiting,
    staleTime: 60_000,
  });
  const selected = useQuery({
    queryKey: ['entity-selection', entidade, empresaId, [...selectedIds].sort()],
    queryFn: ({ signal }) => fetchEntitiesByIds(entidade, empresaId, selectedIds, signal),
    enabled: selectedIds.length > 0,
    staleTime: 60_000,
  });
  return {
    search,
    setSearch: (value: string) => { setSearch(value); setLimit(40); },
    rows: waiting ? [] : options.data?.rows ?? [],
    hasMore: !waiting && !!options.data?.hasMore,
    isLoading: waiting || options.isLoading,
    isError: !waiting && options.isError,
    retry: () => void options.refetch(),
    showMore: () => setLimit((current) => current + 40),
    selectedRows: selected.data ?? [],
    selectionLoading: selectedIds.length > 0 && selected.isLoading,
    selectionError: selected.isError,
    retrySelection: () => void selected.refetch(),
  };
}
