import { requireUserContext, requireValidMfa, authErrorResponse, AuthError } from '../_shared/auth.ts'
import { provisionUser, RegistrationError, type RegistrationInput } from '../_shared/provision-user.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const ctx = await requireUserContext(req)
    await requireValidMfa(ctx)
    if (!['admin', 'super_admin'].includes(ctx.role || '')) throw new AuthError('FORBIDDEN', 403)
    const raw = await req.text()
    if (new TextEncoder().encode(raw).length > 32 * 1024) return json({ error: 'INVALID_REGISTRATION' }, 400)
    let body: Record<string, unknown>
    try { body = JSON.parse(raw) } catch { return json({ error: 'INVALID_REGISTRATION' }, 400) }
    if (!body || typeof body !== 'object') return json({ error: 'INVALID_REGISTRATION' }, 400)
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = body.role as RegistrationInput['role']
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!nome || nome.length > 160 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !['super_admin', 'admin', 'user', 'readonly'].includes(role)
      || (body.empresa_id && (typeof body.empresa_id !== 'string' || !uuid.test(body.empresa_id)))
      || (body.permission_profile_id && (typeof body.permission_profile_id !== 'string' || !uuid.test(body.permission_profile_id)))) {
      return json({ error: 'INVALID_REGISTRATION' }, 400)
    }
    const empresaId = ctx.role === 'super_admin' ? (body.empresa_id as string || null) : ctx.empresaId
    if ((role !== 'super_admin' && !empresaId) || (role === 'super_admin' && ctx.role !== 'super_admin')) {
      return json({ error: 'FORBIDDEN' }, 403)
    }
    const client = ctx.supabase
    const user = await provisionUser(client, {
      actorId: ctx.userId, sessionId: ctx.sessionId, nome, email, role, empresaId,
      permissionProfileId: body.permission_profile_id as string || null,
    })

    // Links are sent only to the owner of the address, never returned to admins.
    // Existing passwords and MFA factors remain unchanged until the owner acts.
    const siteUrl = (Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://akuris.pt').replace(/\/$/, '')
    let setupPasswordUrl: string | null = null
    try {
      let linkType: 'invite' | 'recovery' = user.restored ? 'recovery' : 'invite'
      let link = await client.auth.admin.generateLink({ type: linkType, email, options: { redirectTo: `${siteUrl}/definir-senha` } })
      if (link.error && linkType === 'invite') {
        linkType = 'recovery'
        link = await client.auth.admin.generateLink({ type: linkType, email, options: { redirectTo: `${siteUrl}/definir-senha` } })
      }
      if (!link.error && link.data?.properties?.hashed_token) {
        setupPasswordUrl = `${siteUrl}/definir-senha?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=${linkType}`
      }
    } catch { console.error('Could not generate registration email link') }

    let emailSent = false
    if (setupPasswordUrl) {
      try {
        const company = empresaId ? await client.from('empresas').select('nome').eq('id', empresaId).maybeSingle() : null
        const { data, error } = await client.functions.invoke('send-welcome-email', {
          headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: { userName: nome, userEmail: email, setupPasswordUrl, companyName: company?.data?.nome || 'Akuris' },
        })
        emailSent = !error && data?.success !== false
        if (emailSent) {
          let update = client.from('profiles').update({ invitation_sent_at: new Date().toISOString() }).eq('user_id', user.id)
          update = empresaId ? update.eq('empresa_id', empresaId) : update.is('empresa_id', null)
          const { error: updateError } = await update
          if (updateError) console.error('Could not save invitation timestamp', updateError.code)
        }
      } catch { console.error('Could not send registration email') }
    }
    return json({ success: true, user: { id: user.id, email, nome }, restored: user.restored, emailSent })
  } catch (error) {
    if (error instanceof RegistrationError) {
      const status = error.code === 'REGISTRATION_UNAVAILABLE' ? 503
        : ['FORBIDDEN', 'USER_LIMIT_REACHED'].includes(error.code) ? 403
        : error.code.startsWith('INVALID_') ? 400 : 409
      return json({ error: error.code }, status)
    }
    return authErrorResponse(error, corsHeaders)
  }
})
