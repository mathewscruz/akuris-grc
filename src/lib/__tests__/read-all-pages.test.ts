import { describe, expect, it, vi } from 'vitest';
import { readAllPages, readAllPagesByIds } from '../read-all-pages';

describe('complete scoped reads', () => {
  it.each([0, 1, 499, 500, 501, 1001])('returns every one of %i rows, without overlap', async size => {
    const records = Array.from({ length: size }, (_, id) => ({ id }));
    const page = vi.fn(async (from: number, to: number) => ({ data: records.slice(from, to + 1), error: null }));
    expect(await readAllPages(page)).toEqual({ data: records, error: null });
    expect(page).toHaveBeenCalledTimes(Math.floor(size / 500) + 1);
    page.mock.calls.forEach(([from, to], index) => expect([from, to]).toEqual([index * 500, index * 500 + 499]));
  });
  it('does not publish a partial total when a later page fails', async () => {
    const failure = new Error('network');
    const page = vi.fn().mockResolvedValueOnce({ data: Array(500).fill(1), error: null }).mockResolvedValueOnce({ data: null, error: failure });
    await expect(readAllPages(page)).rejects.toBe(failure);
  });
  it('does not start an aborted request', async () => {
    const controller = new AbortController(); controller.abort();
    const page = vi.fn();
    await expect(readAllPages(page, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(page).not.toHaveBeenCalled();
  });
  it('discards a response that arrives after cancellation', async () => {
    const controller = new AbortController();
    const page = vi.fn(async () => { controller.abort(); return { data: [1], error: null }; });
    await expect(readAllPages(page, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('related reads with authorized parent IDs', () => {
  it('never reads an unscoped table when there are no authorized parents', async () => {
    const page = vi.fn();
    expect(await readAllPagesByIds([], page)).toEqual({ data: [], error: null });
    expect(page).not.toHaveBeenCalled();
  });
  it('deduplicates and limits each ID batch, retaining every authorized parent', async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `id-${index}`);
    const page = vi.fn(async (batch: string[]) => ({ data: batch, error: null }));
    expect((await readAllPagesByIds([...ids, ids[0]], page)).data).toEqual(ids);
    expect(page.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
  });
  it('does not return partial totals if a later ID batch fails', async () => {
    const page = vi.fn().mockResolvedValueOnce({ data: ['first'], error: null }).mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await expect(readAllPagesByIds(Array.from({ length: 101 }, (_, i) => String(i)), page)).rejects.toThrow('offline');
  });
});
