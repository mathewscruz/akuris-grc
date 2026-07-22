/**
 * Helper para contornar o limite padrão de 1000 linhas do PostgREST.
 * Recebe um builder que devolve uma query já pronta (sem .range) e
 * pagina em lotes de 1000 até esgotar.
 *
 * Uso:
 *   const { data, error } = await fetchAllPaginated<Row>(() =>
 *     supabase.from('tabela').select('*').eq('empresa_id', id)
 *   );
 */
export async function fetchAllPaginated<T>(
  builder: () => any,
  pageSize = 1000,
): Promise<{ data: T[]; error: unknown }> {
  const acc: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await builder().range(from, from + pageSize - 1);
    if (error) return { data: acc, error };
    const batch = (data as T[]) || [];
    acc.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return { data: acc, error: null };
}
