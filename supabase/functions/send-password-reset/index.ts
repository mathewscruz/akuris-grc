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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
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

    console.log('=== INÍCIO: send-password-reset ===')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const body = await req.json()
    const { email, userId, companyLogoUrl }: PasswordResetRequest = body
    
    if (!email && !userId) {
      throw new Error('email ou userId é obrigatório')
    }
    
    let profile: any = null
    let targetUserId: string = userId || ''
    
    if (email) {
      const { data: profileByEmail, error: emailError } = await supabase
        .from('profiles')
        .select('user_id, nome, email, empresa:empresas(nome, logo_url)')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      
      if (emailError || !profileByEmail) {
        // Retorno silencioso para não revelar se email existe
        return new Response(JSON.stringify({ success: true, message: 'Se o email existir, um link de redefinição será enviado' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
      
      profile = profileByEmail
      targetUserId = profileByEmail.user_id
    } else {
      const { data: profileByUserId, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, nome, email, empresa:empresas(nome, logo_url)')
        .eq('user_id', userId)
        .single()
      
      if (profileError || !profileByUserId) {
        throw new Error('Usuário não encontrado')
      }
      
      profile = profileByUserId
      targetUserId = profileByUserId.user_id
    }
    
    // Gerar link de recovery via Supabase Auth
    const siteUrl = 'https://akuris.com.br'
    const redirectTo = `${siteUrl}/definir-senha`
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: {
        redirectTo,
      }
    })
    
    if (linkError || !linkData) {
      console.error('Erro ao gerar link de recovery:', linkError)
      throw new Error('Erro ao gerar link de redefinição')
    }
    
    // Construir URL de redefinição com token
    const resetUrl = `${siteUrl}/definir-senha?token_hash=${linkData.properties.hashed_token}&type=recovery`
    
    console.log('Link de recovery gerado para:', profile.email)
    
    const html = await renderAsync(
      React.createElement(PasswordResetEmail, {
        userName: profile.nome,
        userEmail: profile.email,
        resetUrl,
        companyName: profile.empresa?.nome,
        companyLogoUrl: companyLogoUrl || profile.empresa?.logo_url
      })
    )

    const { data, error } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [profile.email],
      subject: 'Akuris - Redefinição de Senha',
      html,
    })

    if (error) {
      console.error('Erro ao enviar e-mail:', error)
      throw error
    }

    console.log('E-mail de reset enviado com sucesso:', data)

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  } catch (error: any) {
    console.error('Erro na função send-password-reset:', error)
    return new Response(
      JSON.stringify({
        error: 'Erro ao processar redefinição de senha. Tente novamente.',
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    )
  }
})
