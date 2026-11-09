import { requireUserContext, requireValidMfa, AuthError, authErrorResponse } from '../_shared/auth.ts'
import { authCorsHeaders } from '../_shared/cors.ts'

interface ResendWelcomeEmailRequest {
  userId: string
  newEmail?: string
}

function jsonError(error: string, code: string, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify({ error, code }), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

// Domínio sem MX (nem A, como fallback do SMTP) nunca recebe e-mail.
async function dominioRecebeEmail(dominio: string): Promise<boolean> {
  try {
    const mx = await Deno.resolveDns(dominio, 'MX')
    if (mx.length) return true
  } catch { /* tenta A */ }
  try {
    return (await Deno.resolveDns(dominio, 'A')).length > 0
  } catch (e: any) {
    // Falha de rede do resolvedor não deve bloquear; só NXDOMAIN/sem registro.
    return !/NotFound|no record|NXDOMAIN/i.test(String(e?.name ?? '') + String(e?.message ?? ''))
  }
}

export async function handleResendWelcomeEmail(req: Request, dependencies = { requireUserContext, requireValidMfa }) {
  const corsHeaders = authCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    console.log('Recebendo requisição para reenviar e-mail de boas-vindas')

    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ctx = await dependencies.requireUserContext(req)
    await dependencies.requireValidMfa(ctx)
    const supabaseAdmin = ctx.supabase
    const currentUserProfile = { role: ctx.role, empresa_id: ctx.empresaId }

    const isSuperAdmin = currentUserProfile.role === 'super_admin'
    const isAdmin = currentUserProfile.role === 'admin' || isSuperAdmin

    if (!isAdmin) {
      throw new AuthError('Usuário não tem permissão para reenviar e-mails de boas-vindas', 403)
    }

    let body: ResendWelcomeEmailRequest
    try {
      body = await req.json()
    } catch {
      throw new AuthError('Solicitação inválida', 400)
    }
    const userId = body?.userId

    if (typeof userId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) {
      throw new AuthError('ID do usuário inválido', 400)
    }

    const { data: userProfile, error: userProfileError } = await supabaseAdmin
      .from('profiles')
      .select('nome, email, user_id, empresa_id, invitation_sent_at, empresa:empresas(nome, logo_url)')
      .eq('user_id', userId)
      .single()

    if (userProfileError || !userProfile) {
      throw new AuthError('Perfil do usuário não encontrado', 404)
    }

    if (!isSuperAdmin && userProfile.empresa_id !== currentUserProfile.empresa_id) {
      throw new AuthError('Você não tem permissão para gerenciar este usuário', 403)
    }

    // Correção de e-mail digitado errado: só antes do primeiro acesso.
    const rawNewEmail = (body as any)?.newEmail
    let emailCorrigido = false
    if (rawNewEmail !== undefined && rawNewEmail !== null && rawNewEmail !== '') {
      const novo = typeof rawNewEmail === 'string' ? rawNewEmail.trim().toLowerCase() : ''
      if (novo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(novo)) {
        return jsonError('E-mail inválido.', 'invalid_email', 400, corsHeaders)
      }
      if (userId === ctx.userId) throw new AuthError('Você não pode alterar o próprio e-mail por aqui.', 403)
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (!authUser?.user) throw new AuthError('Usuário não encontrado', 404)
      if (authUser.user.last_sign_in_at) {
        return jsonError('Este usuário já ativou a conta; o e-mail só pode ser alterado por ele.', 'already_active', 409, corsHeaders)
      }
      const { data: alvoRole } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId)
      if ((alvoRole ?? []).some((r: any) => r.role === 'super_admin') && !isSuperAdmin) {
        throw new AuthError('Não é possível alterar um super admin.', 403)
      }
      if (novo !== String(userProfile.email).toLowerCase()) {
        const { data: dup } = await supabaseAdmin.from('profiles').select('user_id').ilike('email', novo).neq('user_id', userId).limit(1)
        if (dup && dup.length) return jsonError('Este e-mail já está em uso por outro usuário.', 'email_in_use', 409, corsHeaders)
        if (!(await dominioRecebeEmail(novo.split('@')[1]))) {
          return jsonError('Este domínio não recebe e-mails. Confira o endereço.', 'domain_no_mail', 400, corsHeaders)
        }
        const emailAntigo = userProfile.email
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: novo, email_confirm: true })
        if (authErr) {
          const msg = /already|registered|exists/i.test(authErr.message ?? '')
          return jsonError(msg ? 'Este e-mail já está em uso por outro usuário.' : 'Não foi possível alterar o e-mail.', msg ? 'email_in_use' : 'update_failed', msg ? 409 : 500, corsHeaders)
        }
        const { error: profErr } = await supabaseAdmin.from('profiles').update({ email: novo }).eq('user_id', userId)
        if (profErr) {
          await supabaseAdmin.auth.admin.updateUserById(userId, { email: emailAntigo, email_confirm: true })
          return jsonError('Não foi possível alterar o e-mail.', 'update_failed', 500, corsHeaders)
        }
        ;(userProfile as any).email = novo
        emailCorrigido = true
      }
    }

    // Anti-abuso: no máximo um reenvio a cada 5 minutos por utilizador.
    const REENVIO_INTERVALO_MS = 5 * 60 * 1000
    if (!emailCorrigido && userProfile.invitation_sent_at) {
      const ultimo = new Date(userProfile.invitation_sent_at).getTime()
      if (Number.isFinite(ultimo) && Date.now() - ultimo < REENVIO_INTERVALO_MS) {
        const faltamMin = Math.max(1, Math.ceil((REENVIO_INTERVALO_MS - (Date.now() - ultimo)) / 60000))
        return new Response(
          JSON.stringify({
            error: `Convite reenviado há pouco. Tente novamente em ${faltamMin} min.`,
            code: 'rate_limited',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }
    }

    // Gerar novo link de recovery
    const siteUrl = (Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://akuris.pt').replace(/\/$/, '')
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: userProfile.email,
      options: {
        redirectTo: `${siteUrl}/definir-senha`,
      }
    })

    // Sem um token válido, não enviar um botão que apenas devolve ao login.
    // O vínculo também precisa ser da conta solicitada, não de um e-mail
    // desatualizado no perfil que porventura pertença a outra pessoa.
    if (linkError || !linkData?.properties?.hashed_token || linkData.user?.id !== userId) {
      console.error('resend-welcome-email: setup link unavailable')
      throw new AuthError('Não foi possível gerar o link de primeiro acesso. Tente novamente.', 503)
    }
    const setupPasswordUrl = `${siteUrl}/definir-senha?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`

    console.log(`Reenviando e-mail via send-welcome-email para: ${userProfile.email}`)

    const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: {
        userName: userProfile.nome,
        userEmail: userProfile.email,
        setupPasswordUrl,
        companyName: (userProfile.empresa as any)?.nome,
        companyLogoUrl: (userProfile.empresa as any)?.logo_url,
      },
    })

    if (emailError || emailData?.success !== true) {
      console.error('Erro ao invocar send-welcome-email:', emailError)
      throw new AuthError('Não foi possível enviar o e-mail de primeiro acesso. Tente novamente.', 502)
    }

    console.log('E-mail reenviado com sucesso')

    // O URL contém uma credencial de recuperação. Guardamos somente o instante
    // do envio; o administrador nunca recebe nem consulta o token.
    try {
      const { error: metadataError } = await supabaseAdmin
        .from('profiles')
        .update({ invitation_sent_at: new Date().toISOString(), invitation_error: null })
        .eq('user_id', userProfile.user_id)
      if (metadataError) console.error('resend-welcome-email: invitation timestamp update failed')
    } catch (e) {
      console.error('Falha ao atualizar invitation metadata:', e)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders)
    console.error('Erro na função resend-welcome-email:', error)
    return new Response(
      JSON.stringify({
        error: 'Falha ao reenviar e-mail de boas-vindas',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
}
