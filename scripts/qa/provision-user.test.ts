import { provisionUser, RegistrationError, type RegistrationInput } from '../../supabase/functions/_shared/provision-user.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const input: RegistrationInput = { actorId: 'actor', sessionId: 'verified-session', nome: 'QA', email: 'qa@example.test', role: 'user', empresaId: 'company-a', permissionProfileId: null }
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message) }
function fixture(existing: string | null, failure?: string, lookupFailure = false, sqlState = 'P0001') {
  const calls: { method: string; args: any }[] = []
  const client = {
    rpc: (method: string, args: any) => {
      calls.push({ method, args })
      return Promise.resolve(method === 'find_registration_auth_user'
        ? { data: existing, error: lookupFailure ? { message: 'unavailable' } : null }
        : { data: failure ? null : { user_id: existing || 'new-id', restored: !!existing }, error: failure ? { message: failure, code: sqlState } : null })
    },
    auth: { admin: {
      createUser: (args: any) => { calls.push({ method: 'createUser', args }); return Promise.resolve({ data: { user: { id: 'new-id' } }, error: null }) },
      deleteUser: (args: any) => { calls.push({ method: 'deleteUser', args }); return Promise.resolve({ error: null }) },
      updateUserById: () => { throw new Error('An existing password/identity must never be changed') },
    } },
  } as unknown as SupabaseClient
  return { client, calls }
}

Deno.test('restores an Auth orphan through the guarded transaction without replacing credentials', async () => {
  const { client, calls } = fixture('previous-id')
  const result = await provisionUser(client, input)
  assert(result.id === 'previous-id' && result.restored)
  assert(calls.length === 2)
  assert(calls[1].args.p_new_auth === false && calls[1].args.p_actor_id === 'actor' && calls[1].args.p_session_id === 'verified-session')
})
for (const failure of ['DUPLICATE_USER', 'USER_ACCOUNT_REVIEW_REQUIRED', 'FORBIDDEN', 'USER_LIMIT_REACHED', 'INVALID_PERMISSION_PROFILE']) {
  Deno.test(`does not delete an existing identity when ${failure}`, async () => {
    const { client, calls } = fixture('previous-id', failure)
    try { await provisionUser(client, input); throw new Error('Should fail') } catch (error) {
      assert(error instanceof RegistrationError && error.code === failure)
    }
    assert(!calls.some(call => call.method === 'deleteUser' || call.method === 'createUser'))
  })
}
Deno.test('creates an internal credential only for a new identity and never returns it', async () => {
  const { client, calls } = fixture(null)
  const result = await provisionUser(client, input)
  const create = calls.find(call => call.method === 'createUser')!
  assert(create.args.password.length > 60 && create.args.password.length <= 72 && create.args.user_metadata.admin_created === 'true')
  assert(!JSON.stringify(result).includes(create.args.password))
  assert(result.id === 'new-id' && !result.restored)
})
Deno.test('rolls back only the identity created by this request if the SQL transaction fails', async () => {
  const { client, calls } = fixture(null, 'USER_LIMIT_REACHED')
  try { await provisionUser(client, input) } catch (error) { assert(error instanceof RegistrationError) }
  assert(calls.find(call => call.method === 'deleteUser')?.args === 'new-id')
})
Deno.test('fails closed on lookup errors instead of attempting duplicate creation', async () => {
  const { client, calls } = fixture(null, undefined, true)
  try { await provisionUser(client, input); throw new Error('Should fail') } catch (error) {
    assert(error instanceof RegistrationError && error.code === 'REGISTRATION_UNAVAILABLE')
  }
  assert(calls.length === 1)
})
Deno.test('does not delete a new identity after an ambiguous transport failure', async () => {
  const { client, calls } = fixture(null, 'network failure', false, '')
  try { await provisionUser(client, input); throw new Error('Should fail') } catch (error) {
    assert(error instanceof RegistrationError && error.code === 'REGISTRATION_UNAVAILABLE')
  }
  assert(!calls.some(call => call.method === 'deleteUser'))
})
