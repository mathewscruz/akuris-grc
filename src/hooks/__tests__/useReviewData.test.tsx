import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useReviewData } from '../useReviewData';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), toast: vi.fn(), invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, functions: { invoke: mocks.invoke } } }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ profile: { empresa_id: 'tenant-a' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/i18n-global', () => ({ tGlobal: (key: string) => key }));

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
beforeEach(() => {
  vi.clearAllMocks();
  const chain = { update: mocks.update, eq: mocks.eq, select: mocks.select };
  mocks.from.mockReturnValue(chain); mocks.update.mockReturnValue(chain); mocks.eq.mockReturnValue(chain);
  mocks.select.mockResolvedValue({ data: [{ id: 'saved' }], error: null });
  mocks.rpc.mockResolvedValue({ data: { id: 'review', success: true }, error: null });
});
afterEach(cleanup);
describe('review mutations', () => {
  it('creates through one tenant-scoped transaction instead of client-side partial inserts', async () => {
    const { result } = renderHook(useReviewData, { wrapper });
    await result.current.createReview({ nome_revisao: 'Campaign' });
    expect(mocks.rpc).toHaveBeenCalledWith('create_access_review', { p_empresa_id: 'tenant-a', p_data: { nome_revisao: 'Campaign' } });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('finalizes with caller RLS instead of a service-role loop', async () => {
    const { result } = renderHook(useReviewData, { wrapper });
    await result.current.finalizeReview('review');
    expect(mocks.rpc).toHaveBeenCalledWith('finalize_access_review', { p_review_id: 'review' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('metadata edits cannot change creator, system, tenant or reopen a closed campaign', async () => {
    const { result } = renderHook(useReviewData, { wrapper });
    await result.current.updateReview('review', { nome_revisao: 'Updated', sistema_id: 'other', empresa_id: 'other', created_by: 'other', status: 'em_andamento' });
    const payload = mocks.update.mock.calls[0][0];
    expect(payload.nome_revisao).toBe('Updated');
    for (const key of ['sistema_id', 'empresa_id', 'created_by', 'status']) expect(payload).not.toHaveProperty(key);
    expect(mocks.eq).toHaveBeenCalledWith('empresa_id', 'tenant-a');
  });
  it('sends decisions only; reviewer, timestamps and origin are enforced by the database', async () => {
    const { result } = renderHook(useReviewData, { wrapper });
    await result.current.updateReviewItem('item', { decisao: 'aprovar', justificativa_revisor: 'Valid reason', conta_id: 'other', revisado_por: 'spoof', nova_data_expiracao: '2030-01-01' });
    const payload = mocks.update.mock.calls[0][0];
    expect(payload.nova_data_expiracao).toBeNull();
    expect(payload).not.toHaveProperty('conta_id'); expect(payload).not.toHaveProperty('revisado_por');
  });
  it('a zero-row RLS write is failure, not success', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(useReviewData, { wrapper });
    await expect(result.current.updateReview('missing', { nome_revisao: 'No write' })).rejects.toThrow('REVIEW_NOT_AVAILABLE');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'experience.reviewUnavailable' }));
  });
  it('does not display SQL/internal details as a user-facing error', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'relation private_table denied for tenant-secret' } });
    const { result } = renderHook(useReviewData, { wrapper });
    await expect(result.current.createReview({})).rejects.toBeDefined();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'experience.reviewSaveFailed' }));
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain('tenant-secret');
  });
});
