import React from 'npm:react@18.3.1'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { PasswordResetEmail } from './_templates/password-reset-email.tsx'
import { createClient } from 'npm:@supabase/supabase-js@2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit: máx 5 requisições por IP a cada 10 minutos
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

interface PasswordResetRequest {
  email?: string
  userId?: string
  companyLogoUrl?: string
}

// Resposta uniforme para evitar enumeração (fluxo público "Esqueci a senha")
const uniformSuccess = () => new Response(
  JSON.stringify({ success: true, message: 'Se o email existir, um link de redefinição será enviado' }),
  { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
)

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    if (!checkRateLimit(clientIp)) {
      console.warn('send-password-reset rate limited', { ip: clientIp })
      return jsonResponse({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const { email, userId, companyLogoUrl }: PasswordResetRequest = body

    // ── Identifica se o pedido vem de um administrador autenticado.
    // Nesse caso devolvemos o resultado real (enviado/falhou), em vez da
    // resposta uniforme — o admin precisa de ver o erro quando existe.
    let adminProfile: { user_id: string; role: string; empresa_id: string | null } | null = null
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data: authData } = await supabase.auth.getUser(token)
      if (authData?.user) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('user_id, role, empresa_id')
          .eq('user_id', authData.user.id)
          .maybeSingle()
        if (perfil && (perfil.role === 'admin' || perfil.role === 'super_admin')) {
          adminProfile = perfil as any
        }
      }
    }

    const isAdminRequest = !!adminProfile
    const failure = (mensagem: string, status = 400) =>
      isAdminRequest ? jsonResponse({ success: false, error: mensagem }, status) : uniformSuccess()

    if (!email && !userId) {
      return failure('Informe o e-mail ou o utilizador para redefinir a senha.')
    }

    let profile: any = null

    if (userId) {
      // Fluxo administrativo: resolvemos o e-mail a partir do perfil.
      if (!isAdminRequest) {
        return failure('Sem permissão para redefinir a senha deste utilizador.', 403)
      }
      const { data } = await supabase
        .from('profiles')
        .select('user_id, nome, email, empresa_id, empresa:empresas(nome, logo_url)')
        .eq('user_id', userId)
        .maybeSingle()
      profile = data ?? null

      if (profile && adminProfile!.role !== 'super_admin' && profile.empresa_id !== adminProfile!.empresa_id) {
        return failure('Sem permissão para gerir este utilizador.', 403)
      }
    } else {
      // A comparação tem de ignorar maiúsculas: create-user grava o e-mail tal
      // como foi digitado, sem normalizar.
      const alvo = (email as string).trim().toLowerCase()
      const padrao = alvo.replace(/([%_\\])/g, '\\$1')

      const { data: candidatos } = await supabase
        .from('profiles')
        .select('user_id, nome, email, empresa_id, empresa:empresas(nome, logo_url)')
        .ilike('email', padrao)
        .limit(10)

      profile = (candidatos ?? []).find(
        (p: any) => (p.email ?? '').trim().toLowerCase() === alvo
      ) ?? null
    }

    if (!profile) {
      console.warn('send-password-reset: nenhum perfil corresponde ao pedido')
      return failure('Utilizador não encontrado.', 404)
    }

    const siteUrl = 'https://akuris.com.br'
    const redirectTo = `${siteUrl}/definir-senha`

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo }
    })

    if (linkError || !linkData) {
      console.error('Erro ao gerar link de recovery:', linkError)
      return failure('Não foi possível gerar o link de redefinição.', 500)
    }

    const resetUrl = `${siteUrl}/definir-senha?token_hash=${linkData.properties.hashed_token}&type=recovery`

    const html = await renderAsync(
      React.createElement(PasswordResetEmail, {
        userName: profile.nome,
        userEmail: profile.email,
        resetUrl,
        companyName: profile.empresa?.nome,
        companyLogoUrl: companyLogoUrl || profile.empresa?.logo_url
      })
    )

    const { error: sendError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [profile.email],
      subject: 'Akuris - Redefinição de Senha',
      html,
    })

    if (sendError) {
      console.error('Erro ao enviar e-mail:', sendError)
      return failure(`Falha no envio do e-mail: ${sendError.message ?? String(sendError)}`, 502)
    }

    // Regista no histórico quem disparou a redefinição.
    if (isAdminRequest) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: adminProfile!.user_id,
          empresa_id: profile.empresa_id,
          action: 'password_reset_requested',
          table_name: 'profiles',
          record_id: profile.user_id,
          new_values: { email: profile.email },
        })
      } catch (e) {
        console.error('Falha ao registar audit log de reset de senha:', e)
      }
      return jsonResponse({ success: true, email: profile.email })
    }

    return uniformSuccess()
  } catch (error: any) {
    console.error('Erro na função send-password-reset:', error)
    return uniformSuccess()
  }
})
