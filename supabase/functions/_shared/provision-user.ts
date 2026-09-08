import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export class RegistrationError extends Error {
  constructor(public code: string) { super(code) }
}

export interface RegistrationInput {
  actorId: string
  sessionId: string
  nome: string
  email: string
  role: 'super_admin' | 'admin' | 'user' | 'readonly'
  empresaId: string | null
  permissionProfileId: string | null
}

/** Never change an existing identity's password, email, metadata or MFA factors. */
export async function provisionUser(client: SupabaseClient, input: RegistrationInput) {
  const { data: existingId, error: lookupError } = await client.rpc('find_registration_auth_user', { p_email: input.email })
  if (lookupError) throw new RegistrationError('REGISTRATION_UNAVAILABLE')
  let userId: string = existingId
  const newAuth = !userId
  if (newAuth) {
    const { data, error } = await client.auth.admin.createUser({
      email: input.email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '') + 'Aa1!',
      email_confirm: true,
      user_metadata: { nome: input.nome, admin_created: 'true' },
    })
    if (error || !data.user) {
      // A concurrent signup is not permission to adopt that identity.
      throw new RegistrationError(error?.code === 'email_exists' || error?.code === 'email_conflict'
        ? 'DUPLICATE_USER' : 'REGISTRATION_UNAVAILABLE')
    }
    userId = data.user.id
  }
  const { data: result, error } = await client.rpc('provision_user_registration', {
    p_actor_id: input.actorId, p_session_id: input.sessionId, p_user_id: userId,
    p_email: input.email, p_nome: input.nome, p_role: input.role,
    p_empresa_id: input.empresaId, p_permission_profile_id: input.permissionProfileId,
    p_new_auth: newAuth,
  })
  if (error) {
    // Only the identity created by THIS request can be rolled back. Existing
    // identities and their history must survive any validation/permission error.
    // A SQLSTATE confirms transaction failure. A transport/ambiguous response
    // might follow a committed transaction, so do not delete its identity.
    if (newAuth && /^[0-9A-Z]{5}$/.test(error.code || '')) {
      const { error: cleanupError } = await client.auth.admin.deleteUser(userId)
      if (cleanupError) console.error('Could not roll back new Auth identity', cleanupError.code)
    }
    const known = ['DUPLICATE_USER', 'USER_ACCOUNT_REVIEW_REQUIRED', 'USER_LIMIT_REACHED',
      'INVALID_PERMISSION_PROFILE', 'INVALID_REGISTRATION', 'FORBIDDEN']
    throw new RegistrationError(known.includes(error.message) ? error.message : 'REGISTRATION_UNAVAILABLE')
  }
  if (!result?.user_id) throw new RegistrationError('REGISTRATION_UNAVAILABLE')
  return { id: userId, restored: result.restored === true }
}
