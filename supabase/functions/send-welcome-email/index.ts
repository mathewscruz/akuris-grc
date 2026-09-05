import React from 'npm:react@18.3.1'
import { Resend } from 'npm:resend@4.0.0'
import { htmlToText } from '../_shared/email.ts'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { WelcomeEmail } from './_templates/welcome-email.tsx'
import { authCorsHeaders } from '../_shared/cors.ts'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

// Domínios permitidos para setupPasswordUrl (previne phishing em cima do domínio Akuris).
// Adicione novos ambientes aqui se surgirem.
const ALLOWED_URL_HOSTS = new Set<string>([
  'akuris.com.br',
  'www.akuris.com.br',
  'akuris.pt',
  'www.akuris.pt',
  'akuris-grc.lovable.app',
  'localhost',
])

function isSafeSetupUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.hostname !== 'localhost') return false
    return ALLOWED_URL_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

interface WelcomeEmailRequest {
  userName: string
  userEmail: string
  setupPasswordUrl: string
  companyName?: string
  companyLogoUrl?: string
}

Deno.serve(async (req) => {
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
    // Esta função é um transportador interno. Autorização de admin, inquilino,
    // MFA e destinatário ocorre nas funções de negócio que a invocam.
    // Aceitar payload arbitrário de um admin faria do domínio Akuris um relay
    // de phishing contra qualquer endereço da internet.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!token || token !== SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { userName, userEmail, setupPasswordUrl, companyName, companyLogoUrl }: WelcomeEmailRequest = await req.json()

    if (!userEmail || !userName || !setupPasswordUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (userEmail.length > 254 || userName.length > 160 || (companyName?.length ?? 0) > 160) {
      return new Response(JSON.stringify({ error: 'Invalid field length' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (!isSafeSetupUrl(setupPasswordUrl)) {
      console.warn('welcome-email rejected: setupPasswordUrl outside allowlist', { host: (() => { try { return new URL(setupPasswordUrl).hostname } catch { return 'invalid' } })() })
      return new Response(JSON.stringify({ error: 'setupPasswordUrl inválida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    console.log(`Enviando e-mail de boas-vindas para: ${userEmail}`)

    const html = await renderAsync(
      React.createElement(WelcomeEmail, {
        userName,
        userEmail,
        setupPasswordUrl,
        companyName,
        companyLogoUrl,
      })
    )

    const { data, error } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [userEmail],
      subject: 'Bem-vindo ao Akuris - Defina sua senha',
      html,
      text: htmlToText(html),
    })

    if (error) {
      console.error('Erro ao enviar e-mail:', error)
      throw error
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: any) {
    console.error('Erro na função send-welcome-email:', error)
    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)),
        details: 'Falha ao enviar e-mail de boas-vindas',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
})
