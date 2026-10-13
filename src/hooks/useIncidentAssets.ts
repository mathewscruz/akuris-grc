import { useQuery } from '@tanstack/react-query';
import { fetchEntitiesByIds } from '@/lib/entity-search';

/** Resolve only the current incident's links; never reuse another tenant's data. */
export function useIncidentAssets(empresaId: string | null | undefined, assetIds: string[]) {
  const ids = [...new Set(assetIds)];
  return useQuery({
    queryKey: ['incidente-ativos', empresaId, ids],
    enabled: Boolean(empresaId && ids.length),
    queryFn: ({ signal }) => {
      if (!empresaId || !ids.length) return Promise.resolve([]);
      return fetchEntitiesByIds('ativo', empresaId, ids, signal);
    },
    staleTime: 60_000,
  });
}