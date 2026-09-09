import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEvidenceLibrary } from '@/hooks/useEvidenceLibrary';
const db = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, fail: '', ranges: [] as string[] }));
vi.mock('@/lib/i18n-global', () => ({ tGlobal: (s:string) => s }));
vi.mock('@/lib/toast', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/akuris-toast', () => ({ akurisToast: vi.fn() }));
vi.mock('@/lib/edge-function-utils', () => ({ invokeEdgeFunction: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table:string) => {
  let allowed: string[] | null = null;
  const q:any = {};
  for (const m of ['select','eq','order']) q[m] = () => q;
  q.in = (_:string, ids:string[]) => { allowed = ids; return q; };
  q.range = async (from:number,to:number) => {
    db.ranges.push(table);
    const all = (db.rows[table] || []).filter(r => !allowed || allowed.includes(r.evidence_id));
    return { data: db.fail === table ? null : all.slice(from,to+1), error: db.fail === table ? new Error('offline') : null };
  };
  return q;
} } }));
beforeEach(() => {
  db.fail = ''; db.ranges = [];
  db.rows = {
    evidence_library: Array.from({length:1101}, (_,i) => ({id:`e${i}`,nome:`Evidence ${i}`})),
    evidence_library_links: Array.from({length:1101}, (_,i) => ({id:`l${i}`,evidence_id:`e${i}`,vinculo_tipo:'manual'})),
  };
  // A single evidence can have more than one API page of links.
  db.rows.evidence_library_links.push(...Array.from({length:1001},(_,i) => ({id:`extra${i}`,evidence_id:'e1100',vinculo_tipo:'manual'})));
});
describe('complete evidence counts', () => {
  it('loads every evidence and every batched link, including >1000 rows', async () => {
    const { result } = renderHook(() => useEvidenceLibrary('tenant'));
    await waitFor(() => expect(result.current.items).toHaveLength(1101));
    expect(result.current.items.at(-1)?.total_links).toBe(1002);
    expect(result.current.stats.com_links).toBe(1101);
    expect(db.ranges.filter(t => t==='evidence_library')).toHaveLength(3);
  });
  it('exposes failed link reads, never publishing zero-link counts as successful data', async () => {
    db.fail = 'evidence_library_links';
    const { result } = renderHook(() => useEvidenceLibrary('tenant'));
    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([]);
  });
});
