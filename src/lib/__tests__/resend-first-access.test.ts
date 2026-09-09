import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resendFirstAccessEmail } from '../resend-first-access';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
beforeEach(() => mocks.invoke.mockReset());

describe('first-access resend confirmation', () => {
  it('confirms only explicit success', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    await expect(resendFirstAccessEmail('target-id', 'Falha no envio')).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledWith('resend-welcome-email', { body: { userId: 'target-id' } });
  });
  it.each([null, {}, { success: false }])('does not count a non-confirmed response as sent: %j', async (data) => {
    mocks.invoke.mockResolvedValue({ data, error: null });
    await expect(resendFirstAccessEmail('target-id', 'Falha no envio')).rejects.toThrow('Falha no envio');
  });
  it('shows the server cooldown instead of the generic Edge Function error', async () => {
    const response = new Response(JSON.stringify({ error: 'Convite reenviado há pouco. Tente novamente em 4 min.' }), { status: 429 });
    mocks.invoke.mockResolvedValue({ data: null, error: { context: response } });
    await expect(resendFirstAccessEmail('target-id', 'Falha no envio')).rejects.toThrow('Tente novamente em 4 min.');
    expect(response.bodyUsed).toBe(false);
  });
  it('uses readable fallback for proxy/network errors', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { context: new Response('Bad gateway', { status: 502 }) } });
    await expect(resendFirstAccessEmail('target-id', 'Falha no envio')).rejects.toThrow('Falha no envio');
  });
});
