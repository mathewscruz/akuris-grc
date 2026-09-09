/** Complete ordered reads. Never present a partial page as a company total. */
export async function readAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const data: T[] = [];
  for (let from = 0; from < 50000; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) return { data: null, error: result.error };
    const rows = result.data || [];
    data.push(...rows);
    if (rows.length < 500) return { data, error: null };
  }
  return { data: null, error: new Error('context_too_large') };
}
