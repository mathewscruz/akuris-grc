import React from 'npm:react@18.3.1'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { WelcomeEmail } from './_templates/welcome-email.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Domínios permitidos para setupPasswordUrl (previne phishing em cima do domínio Akuris).
// Adicione novos ambientes aqui se surgirem.
const ALLOWED_URL_HOSTS = new Set<string>([
  'akuris.com.br',
  'www.akuris.com.br',
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
    // ============ AUTH: caller precisa ser service-role interno OU usuário autenticado admin ============
    // Bloqueia disparo anônimo de e-mails pelo domínio Akuris (phishing/spam).
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

    let authorized = false
    // 1) Chamada de outra edge function (create-user, check-trial-expiration, resend-welcome-email) usa service-role.
    if (token && token === SERVICE_ROLE) {
      authorized = true
    } else if (token) {
      // 2) Chamada do frontend por um admin/super_admin autenticado.
      try {
        const verifier = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE)
        const { data: userData } = await verifier.auth.getUser(token)
        if (userData?.user) {
          const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
          const { data: prof } = await admin
            .from('profiles').select('role').eq('user_id', userData.user.id).maybeSingle()
          if (prof?.role === 'admin' || prof?.role === 'super_admin') authorized = true
        }
      } catch (e) {
        console.error('welcome-email auth check failed', e)
      }
    }

    if (!authorized) {
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
