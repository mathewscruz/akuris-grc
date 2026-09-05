import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTemplateData } from './generateTemplatePDF';

const state = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, failAt: -1, requests: [] as { table: string; from: number; filters: [string, unknown][] }[] }));
vi.mock('@/lib/i18n-locale', () => ({ getAppLocale: () => 'pt' }));
vi.mock('@/lib/pdf-utils', () => ({ loadAkurisLogo: vi.fn(), addAkurisCover: vi.fn(), addAkurisFooter: vi.fn(), addSectionTitle: vi.fn(), drawTableHeader: vi.fn(), formatLabel: (x: string) => x, AKURIS_COLORS: {} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  let start = 0; let end = 499; const filters: [string, unknown][] = [];
  const query = {
    select() { return query; }, order() { return query; },
    eq(key: string, value: unknown) { filters.push([key, value]); return query; },
    range(from: number, to: number) { start = from; end = to; return query; },
    then(resolve: (result: unknown) => unknown) {
      state.requests.push({ table, from: start, filters });
      return Promise.resolve(start === state.failAt ? { data: null, error: new Error('offline') } : { data: (state.rows[table] ?? []).slice(start, end + 1), error: null }).then(resolve);
    },
  }; return query;
} } }));
beforeEach(() => { state.rows = {}; state.requests = []; state.failAt = -1; });

describe('report preview and export data', () => {
  it('does not silently truncate records at the API cap or the old 50-row display limit', async () => {
    state.rows.documentos = Array.from({ length: 1001 }, (_, id) => ({ id, nome: `Document ${id}`, status: 'ativo', tipo: 'politica' }));
    const result = await fetchTemplateData('documentos_governanca', 'tenant-a');
    expect(result.sections.find(s => s.title === 'Documentos')?.tableRows).toHaveLength(1001);
    expect(state.requests.map(r => r.from)).toEqual([0, 500, 1000]);
    expect(state.requests.every(r => r.filters.some(([key, value]) => key === 'empresa_id' && value === 'tenant-a'))).toBe(true);
  });
  it('fails instead of exporting a partial or zero-valued report', async () => {
    state.rows.documentos = Array(500).fill({ nome: 'Example' }); state.failAt = 500;
    await expect(fetchTemplateData('documentos_governanca', 'tenant-a')).rejects.toThrow('offline');
  });
  it('uses the actual 0–100 scale, preserves zero, and excludes missing scores', async () => {
    state.rows.due_diligence_assessments = [0, 20, 100, null].map((score_final, id) => ({ id, status: 'concluido', score_final }));
    const result = await fetchTemplateData('due_diligence_fornecedores', 'tenant-a');
    const metrics = result.sections[0].metrics!;
    expect(metrics.find(m => m.label === 'Score Medio (0-100)')?.value).toBe('40.0');
    expect(metrics.find(m => m.label === 'Avaliacoes com score de 80 ou mais')?.value).toBe(1);
  });
  it('does not translate absence of completed scores into a measured zero', async () => {
    state.rows.due_diligence_assessments = [{ id: 'draft', status: 'pendente', score_final: null }];
    const result = await fetchTemplateData('due_diligence_fornecedores', 'tenant-a');
    expect(result.sections[0].metrics!.find(m => m.label === 'Score Medio (0-100)')?.value).toBe('—');
  });
});
