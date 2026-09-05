/** Read a complete, deterministically ordered query without silently accepting the server row cap.
 * The factory must retain the tenant/permission filters on every page. Partial failures throw.
 */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  signal?: AbortSignal,
): Promise<{ data: T[]; error: null }> {
  const data: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    signal?.throwIfAborted();
    const result = await page(from, from + size - 1);
    signal?.throwIfAborted();
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    data.push(...rows);
    if (rows.length < size) return { data, error: null };
  }
}

/** Related tables without a PostgREST FK: scope by already authorized parent IDs in short batches. */
export async function readAllPagesByIds<T>(
  parentIds: readonly string[],
  page: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  signal?: AbortSignal,
): Promise<{ data: T[]; error: null }> {
  const ids = [...new Set(parentIds)];
  const data: T[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const batch = ids.slice(index, index + 100);
    const result = await readAllPages((from, to) => page(batch, from, to), signal);
    data.push(...result.data);
  }
  return { data, error: null };
}
