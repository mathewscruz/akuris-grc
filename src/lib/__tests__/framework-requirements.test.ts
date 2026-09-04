import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));

import {
  clearFrameworkRequirementsCache,
  fetchFrameworkRequirements,
} from '@/lib/framework-requirements';

describe('fetchFrameworkRequirements', () => {
  beforeEach(() => {
    clearFrameworkRequirementsCache();
    from.mockReset();
    from.mockImplementation(() => {
      type QueryMock = {
        select: ReturnType<typeof vi.fn>;
        eq: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        range: ReturnType<typeof vi.fn>;
      };
      const query = {} as QueryMock;
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.order = vi.fn(() => query);
      query.range = vi.fn().mockResolvedValue({
        data: [{ id: 'req-1', codigo: 'A.1' }],
        error: null,
      });
      return query;
    });
  });

  it('compartilha a consulta simultânea entre os painéis do framework', async () => {
    const [header, score, table] = await Promise.all([
      fetchFrameworkRequirements('fw-1'),
      fetchFrameworkRequirements('fw-1'),
      fetchFrameworkRequirements('fw-1'),
    ]);

    expect(header).toEqual([{ id: 'req-1', codigo: 'A.1' }]);
    expect(score).toBe(header);
    expect(table).toBe(header);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('não compartilha catálogos de frameworks diferentes', async () => {
    await Promise.all([
      fetchFrameworkRequirements('fw-1'),
      fetchFrameworkRequirements('fw-2'),
    ]);

    expect(from).toHaveBeenCalledTimes(2);
  });
});
