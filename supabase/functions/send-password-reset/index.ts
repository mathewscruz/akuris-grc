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

// O limite vive na base, em `consume_password_reset_attempt`: bloqueio de
// advisory, janela de uma hora e limpeza das linhas com mais de 24 horas.
//
// O que estava aqui era um `Map` em memoria. Nao funciona neste ambiente: as
// Edge Functions correm em isolados do Deno, criados e destruidos a vontade e
// em paralelo, portanto cada um tinha o seu proprio contador. O teto efetivo
// era 5 vezes o numero de isolados vivos, e recomecava a cada arranque a frio.
// A funcao da base ja existia, pronta, e nunca tinha sido chamada.
const MAX_POR_HORA = 5

/** SHA-256 em hexadecimal — formato exigido por `consume_password_reset_attempt`. */
async function sha256Hex(valor: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    const { data: podeSeguir, error: limiteError } = await supabase.rpc(
      'consume_password_reset_attempt',
      { p_fingerprint_hash: await sha256Hex(clientIp), p_max_attempts: MAX_POR_HORA },
    )
    if (limiteError) {
      // Fail-closed: sem conseguir contar, nao se envia. O contrario deixava o
      // envio de e-mail sem tecto sempre que a base tivesse um soluco.
      console.error('send-password-reset: falha ao consultar limite', limiteError)
      return new Response(JSON.stringify({ error: 'Servico indisponivel. Tente novamente.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    if (podeSeguir !== true) {
      console.warn('send-password-reset rate limited', { ip: clientIp })
      return jsonResponse({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429)
    }

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
