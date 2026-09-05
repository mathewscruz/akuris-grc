import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ENTITY_DEFS, ENTITY_MODULE, type EntityKey, type EntityRow, searchEntityRows, queryTokens } from '@/lib/entity-search';

export interface GlobalSearchGroup {
  key: EntityKey;
  rows: EntityRow[];
  hasMore: boolean;
}

export function useGlobalSearch(query: string, enabled: boolean) {
  const { profile } = useAuth();
  const { canAccess } = usePermissions();
  const empresaId = profile?.empresa_id;
  const [settledQuery, setSettledQuery] = useState(query);
  const [limits, setLimits] = useState<Partial<Record<EntityKey, number>>>({});
  useEffect(() => {
    const timer = window.setTimeout(() => { setSettledQuery(query); setLimits({}); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const tokens = useMemo(() => queryTokens(settledQuery), [settledQuery]);
  const ativo = enabled && query.trim().length >= 2;
  const allowed = ENTITY_DEFS.filter((def) => canAccess(ENTITY_MODULE[def.key]));
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['global-search', empresaId, settledQuery, allowed.map((d) => d.key).join(','), limits],
    enabled: ativo && tokens.join('').length >= 2,
    queryFn: async ({ signal }) => {
      const results = await Promise.all(allowed.map(async (def) => {
        try {
          return { key: def.key, ...await searchEntityRows(def.key, empresaId, tokens, limits[def.key] ?? 5, signal), failed: false };
        } catch (error) {
          if (signal.aborted) throw error;
          return { key: def.key, rows: [] as EntityRow[], hasMore: false, failed: true };
        }
      }));
      return results;
    },
    staleTime: 60_000,
  });
  const waiting = query !== settledQuery;
  return {
    groups: ativo && !waiting ? (data ?? []).filter((group) => group.rows.length > 0) : [],
    isSearching: ativo && (waiting || isFetching),
    isError: isError || (!waiting && !!data?.some((group) => group.failed)),
    retry: () => void refetch(),
    showMore: (key: EntityKey) => setLimits((current) => ({ ...current, [key]: (current[key] ?? 5) + 20 })),
    ativo,
  };
}
