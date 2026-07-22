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
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    if (!checkRateLimit(clientIp)) {
      console.warn('send-password-reset rate limited', { ip: clientIp })
      return new Response(JSON.stringify({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const { email, companyLogoUrl }: PasswordResetRequest = body

    if (!email || typeof email !== 'string') {
      // Resposta uniforme para não vazar sinais
      return uniformSuccess()
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, nome, email, empresa:empresas(nome, logo_url)')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (!profile) {
      // Não revela se email existe
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
