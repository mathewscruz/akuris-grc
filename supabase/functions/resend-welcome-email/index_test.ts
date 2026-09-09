import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { AuthError, type AuthContext } from '../_shared/auth.ts';
import { handleResendWelcomeEmail } from './handler.ts';

const userId = '00000000-0000-4000-8000-000000000001';
function fixture(options: {
  role?: string; tenant?: string; invitationSentAt?: string;
  linkError?: boolean; missingToken?: boolean; wrongAccount?: boolean;
  delivery?: unknown; deliveryError?: boolean; profileMissing?: boolean; mfaError?: boolean;
} = {}) {
  const calls = { link: 0, send: 0, update: 0, mfa: 0, payload: null as Record<string, unknown> | null };
  const profile = { user_id: userId, nome: 'QA local', email: 'first-access@example.test',
    empresa_id: options.tenant ?? 'tenant-a', empresa: { nome: 'Empresa QA' }, invitation_sent_at: options.invitationSentAt };
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: options.profileMissing ? null : profile, error: null }) }) }),
      update: () => ({ eq: async () => { calls.update++; return { error: null }; } }),
    }),
    auth: { admin: { generateLink: async () => {
      calls.link++;
      return { error: options.linkError ? new Error('unavailable') : null, data: {
        properties: { hashed_token: options.missingToken ? '' : 'qa-token' },
        user: { id: options.wrongAccount ? 'other-account' : userId },
      } };
    } } },
    functions: { invoke: async (_name: string, request: { body: Record<string, unknown> }) => {
      calls.send++; calls.payload = request.body;
      return { data: options.delivery === undefined ? { success: true } : options.delivery,
        error: options.deliveryError ? new Error('provider unavailable') : null };
    } },
  };
  const dependencies = {
    requireUserContext: async () => ({ userId: 'admin', sessionId: 'session', empresaId: 'tenant-a',
      role: options.role ?? 'admin', supabase: db } as unknown as AuthContext),
    requireValidMfa: async () => { calls.mfa++; if (options.mfaError) throw new AuthError('MFA verification required', 403); },
  };
  const run = (body: unknown = { userId }) => handleResendWelcomeEmail(new Request('http://localhost/resend', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }), dependencies);
  return { calls, run };
}

Deno.test('sends a real setup route and timestamps only after confirmed delivery', async () => {
  const { run, calls } = fixture();
  const response = await run();
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { success: true });
  assertEquals(calls.mfa, 1);
  assertEquals(calls.send, 1);
  assertEquals(calls.update, 1);
  assertMatch(String(calls.payload?.setupPasswordUrl), /\/definir-senha\?token_hash=qa-token&type=recovery$/);
});

for (const option of [{ linkError: true }, { missingToken: true }, { wrongAccount: true }]) {
  Deno.test(`never sends a broken setup link: ${JSON.stringify(option)}`, async () => {
    const { run, calls } = fixture(option);
    assertEquals((await run()).status, 503);
    assertEquals(calls.send, 0); assertEquals(calls.update, 0);
  });
}
for (const option of [{ deliveryError: true }, { delivery: null }, { delivery: { success: false } }]) {
  Deno.test(`does not report or timestamp failed delivery: ${JSON.stringify(option)}`, async () => {
    const { run, calls } = fixture(option);
    assertEquals((await run()).status, 502);
    assertEquals(calls.update, 0);
  });
}
Deno.test('keeps the five-minute cooldown and does not generate/send another link', async () => {
  const { run, calls } = fixture({ invitationSentAt: new Date().toISOString() });
  const response = await run();
  assertEquals(response.status, 429);
  assertMatch((await response.json()).error, /Tente novamente em 5 min/);
  assertEquals(calls.link, 0); assertEquals(calls.send, 0);
});
for (const option of [{ role: 'user' }, { tenant: 'other-tenant' }, { mfaError: true }]) {
  Deno.test(`preserves admin/tenant/MFA gates: ${JSON.stringify(option)}`, async () => {
    const { run, calls } = fixture(option);
    assertEquals((await run()).status, 403);
    assertEquals(calls.link, 0); assertEquals(calls.send, 0);
  });
}
Deno.test('super-admin can resend across tenants', async () => {
  const { run, calls } = fixture({ role: 'super_admin', tenant: 'other-tenant' });
  assertEquals((await run()).status, 200); assertEquals(calls.send, 1);
});
Deno.test('invalid target is rejected before data access', async () => {
  const { run, calls } = fixture();
  assertEquals((await run({ userId: 'invalid' })).status, 400);
  assertEquals(calls.send, 0);
});
Deno.test('unknown profile is not reported as an email sent', async () => {
  const { run } = fixture({ profileMissing: true });
  assertEquals((await run()).status, 404);
});
Deno.test('unauthenticated HTTP request remains blocked by the real auth guard', async () => {
  const response = await handleResendWelcomeEmail(new Request('http://localhost/resend', { method: 'POST', body: '{}' }));
  assertEquals(response.status, 401);
});
