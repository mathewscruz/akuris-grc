import React from 'npm:react@18.3.1'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { MFACodeEmail } from './_templates/mfa-code-email.tsx'
import { createClient } from 'npm:@supabase/supabase-js@2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateOTP(): string {
  const arr = new Uint32Array(6)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((n) => n % 10).join('')
}

async function hashOTP(code: string, userId: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`${userId}:${code}`))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    // Verify caller JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const callerUserId = claimsData.claims.sub as string

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({})) as {
      force?: boolean;
      context?: 'fresh_login' | 'session_restore';
    }
    const force = !!body.force
    // Default mantém retrocompat (skip de 24h). 'fresh_login' nunca pula.
    const context = body.context === 'fresh_login' ? 'fresh_login' : 'session_restore'

    // Always operate on the caller's own identity. Body-supplied userId/email are ignored.
    const userId = callerUserId

    // Fetch the user's registered email from auth.users (server-side, trusted)
    const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authUserError || !authUserResult?.user?.email) {
      console.error('Falha ao recuperar e-mail do usuário:', authUserError)
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    const email = authUserResult.user.email

    // Pula envio se houver sessão MFA válida (até 24h), tanto em fresh_login
    // quanto em session_restore. Evita disparar e-mail desnecessário quando
    // o AuthProvider liberará o login direto via check-mfa-session.
    const { data: validSession } = await supabaseAdmin
      .from('mfa_sessions')
      .select('id, verified_at, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (validSession && !force) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        expires_at: validSession.expires_at,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Rate limit apenas em pedidos explícitos de reenvio (botão "Reenviar")
    if (force) {
      const { data: recentCode } = await supabaseAdmin
        .from('mfa_codes')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentCode) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Aguarde 1 minuto antes de solicitar um novo código'
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
    }

    // Buscar empresa_id do usuário
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('empresa_id, nome')
      .eq('user_id', userId)
      .single()

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: 'Perfil do usuário não encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Reusa código ativo se existir; caso contrário, gera novo
    const { data: activeCode } = await supabaseAdmin
      .from('mfa_codes')
      .select('id, code, expires_at')
      .eq('user_id', userId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let code: string
    if (activeCode && !force) {
      code = activeCode.code
      console.log('Reusando código MFA ativo para userId:', userId)
    } else {
      code = generateOTP()
      const { error: insertError } = await supabaseAdmin
        .from('mfa_codes')
        .insert({
          user_id: userId,
          empresa_id: profile.empresa_id,
          code,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })

      if (insertError) {
        console.error('Erro ao inserir código MFA:', insertError)
        throw new Error('Erro ao gerar código de verificação')
      }
    }

    const html = await renderAsync(
      React.createElement(MFACodeEmail, {
        userName: profile.nome || email.split('@')[0],
        code,
      })
    )

    const { error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [email],
      subject: `${code} - Código de Verificação Akuris`,
      html,
    })

    if (emailError) {
      console.error('Erro ao enviar e-mail MFA:', emailError)
      throw new Error('Erro ao enviar código por e-mail')
    }

    console.log('Código MFA enviado para userId:', userId)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: any) {
    console.error('Erro na função send-mfa-code:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar código MFA' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
