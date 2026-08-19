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
  companyLogoUrl?: string
}

// Resposta uniforme para evitar enumeração
const uniformSuccess = () => new Response(
  JSON.stringify({ success: true, message: 'Se o email existir, um link de redefinição será enviado' }),
  { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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
      return new Response(JSON.stringify({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const body = await req.json().catch(() => ({}))
    const { email, companyLogoUrl }: PasswordResetRequest = body

    if (!email || typeof email !== 'string') {
      // Resposta uniforme para não vazar sinais
      return uniformSuccess()
    }

    // A comparação tem de ignorar maiúsculas: create-user grava o e-mail tal
    // como foi digitado, sem normalizar, portanto um perfil gravado como
    // "Joao.Silva@Empresa.com.br" nunca era encontrado por uma busca em minúsculas
    // e o utilizador ficava permanentemente sem conseguir redefinir a senha —
    // sem erro visível, porque a resposta é sempre uniforme.
    const alvo = email.trim().toLowerCase()
    // Escapa os curingas do LIKE: "_" é carácter legítimo em endereços de e-mail.
    const padrao = alvo.replace(/([%_\\])/g, '\\$1')

    const { data: candidatos } = await supabase
      .from('profiles')
      .select('user_id, nome, email, empresa:empresas(nome, logo_url)')
      .ilike('email', padrao)
      .limit(10)

    const profile = (candidatos ?? []).find(
      (p: any) => (p.email ?? '').trim().toLowerCase() === alvo
    ) ?? null

    if (!profile) {
      // A resposta ao cliente continua uniforme para não revelar se o e-mail
      // existe, mas sem este registo uma falha real fica indistinguível de um
      // pedido para um endereço inexistente.
      console.warn('send-password-reset: nenhum perfil corresponde ao e-mail pedido')
      return uniformSuccess()
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
      // Ainda assim retorna sucesso genérico
      return uniformSuccess()
    }

    const resetUrl = `${siteUrl}/definir-senha?token_hash=${linkData.properties.hashed_token}&type=recovery`

    const html = await renderAsync(
      React.createElement(PasswordResetEmail, {
        userName: profile.nome,
        userEmail: profile.email,
        resetUrl,
        companyName: (profile as any).empresa?.nome,
        companyLogoUrl: companyLogoUrl || (profile as any).empresa?.logo_url
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
    }

    return uniformSuccess()
  } catch (error: any) {
    console.error('Erro na função send-password-reset:', error)
    // Sempre resposta uniforme
    return uniformSuccess()
  }
})
