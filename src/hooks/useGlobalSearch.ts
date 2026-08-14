/**
 * Busca global de registos reais (Cmd+K).
 *
 * Carrega, uma única vez por sessão de pesquisa, um recorte recente de cada
 * entidade (respeitando RLS e `empresa_id`) e filtra no cliente, permitindo
 * comparação sem acentos, insensível a maiúsculas e com várias palavras em AND
 * por qualquer ordem, sobre identificador amigável e título.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import {
  ENTITY_DEFS,
  EntityKey,
  EntityRow,
  fetchEntityRows,
  matchesTokens,
  queryTokens,
} from '@/lib/entity-search';

export interface GlobalSearchGroup {
  key: EntityKey;
  rows: EntityRow[];
  total: number;
}

const MAX_POR_GRUPO = 5;

export function useGlobalSearch(query: string, enabled: boolean) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const tokens = useMemo(() => queryTokens(query), [query]);
  const ativo = enabled && tokens.join('').length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ['global-search-dataset', empresaId],
    queryFn: async () => {
      const resultados = await Promise.all(
        ENTITY_DEFS.map(async (def) => ({
          key: def.key,
          rows: await fetchEntityRows(def.key, empresaId),
        })),
      );
      return resultados;
    },
    enabled: ativo,
    staleTime: 2 * 60_000,
  });

  const groups = useMemo<GlobalSearchGroup[]>(() => {
    if (!ativo || !data) return [];
    return data
      .map(({ key, rows }) => {
        const filtradas = rows.filter((r) => matchesTokens(`${r.codigo} ${r.titulo}`, tokens));
        return { key, rows: filtradas.slice(0, MAX_POR_GRUPO), total: filtradas.length };
      })
      .filter((g) => g.total > 0);
  }, [data, tokens, ativo]);

  return { groups, isSearching: ativo && isFetching && !data, ativo };
}
