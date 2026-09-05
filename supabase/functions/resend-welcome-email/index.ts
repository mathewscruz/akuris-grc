import { requireUserContext, requireValidMfa, authErrorResponse } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResendWelcomeEmailRequest {
  userId: string
}

Deno.serve(async (req) => {
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
    const ctx = await requireUserContext(req)
    await requireValidMfa(ctx)
    const supabaseAdmin = ctx.supabase
    const currentUserProfile = { role: ctx.role, empresa_id: ctx.empresaId }

    const isSuperAdmin = currentUserProfile.role === 'super_admin'
    const isAdmin = currentUserProfile.role === 'admin' || isSuperAdmin

    if (!isAdmin) {
      throw new Error('Usuário não tem permissão para reenviar e-mails de boas-vindas')
    }

    const { userId }: ResendWelcomeEmailRequest = await req.json()

    if (!userId) {
      throw new Error('ID do usuário não fornecido')
    }

    const { data: userProfile, error: userProfileError } = await supabaseAdmin
      .from('profiles')
      .select('nome, email, user_id, empresa_id, invitation_sent_at, empresa:empresas(nome, logo_url)')
      .eq('user_id', userId)
      .single()

    if (userProfileError || !userProfile) {
      throw new Error('Perfil do usuário não encontrado')
    }

    if (!isSuperAdmin && userProfile.empresa_id !== currentUserProfile.empresa_id) {
      throw new Error('Você não tem permissão para gerenciar este usuário')
    }

    // Anti-abuso: no máximo um reenvio a cada 5 minutos por utilizador.
    const REENVIO_INTERVALO_MS = 5 * 60 * 1000
    if (userProfile.invitation_sent_at) {
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
    let setupPasswordUrl = `${siteUrl}/auth`

    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: userProfile.email,
        options: {
          redirectTo: `${siteUrl}/definir-senha`,
        }
      })

      if (!linkError && linkData) {
        setupPasswordUrl = `${siteUrl}/definir-senha?token_hash=${linkData.properties.hashed_token}&type=recovery`
      }
    } catch (linkGenError) {
      console.error('Erro ao gerar link:', linkGenError)
    }

    console.log(`Reenviando e-mail via send-welcome-email para: ${userProfile.email}`)

    const { error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
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

    if (emailError) {
      console.error('Erro ao invocar send-welcome-email:', emailError)
      throw emailError
    }

    console.log('E-mail reenviado com sucesso')

    // O URL contém uma credencial de recuperação. Guardamos somente o instante
    // do envio; o administrador nunca recebe nem consulta o token.
    try {
      await supabaseAdmin
        .from('profiles')
        .update({ invitation_sent_at: new Date().toISOString() })
        .eq('user_id', userProfile.user_id)
    } catch (e) {
      console.error('Falha ao atualizar invitation metadata:', e)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error, corsHeaders)
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
})
