import React from 'npm:react@18.3.1'
import { Resend } from 'npm:resend@4.0.0'
import { htmlToText } from '../_shared/email.ts'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { MFACodeEmail } from './_templates/mfa-code-email.tsx'
import { authCorsHeaders } from '../_shared/cors.ts'

const uniformDigit = (): number => {
  const byte = new Uint8Array(1)
  do crypto.getRandomValues(byte)
  while (byte[0] >= 250)
  return byte[0] % 10
}

const generateOTP = (): string =>
  Array.from({ length: 6 }, () => uniformDigit()).join('')

async function hashOTP(code: string, userId: string, sessionId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${userId}:${sessionId}:${code}`),
  )
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  const corsHeaders = authCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error_code: 'unauthorized' }, 401)

    const token = authHeader.slice('Bearer '.length)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAuth = createClient(supabaseUrl, anonKey)
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
    const sessionId = typeof claimsData?.claims?.session_id === 'string' ? claimsData.claims.session_id : null
    if (claimsError || !userId || !sessionId || !serviceKey) {
      return json({ success: false, error_code: 'session_context_missing' }, 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // Confiança só pode ser reutilizada pela mesma sessão do JWT.
    const { data: validSession, error: sessionError } = await supabaseAdmin
      .from('mfa_sessions')
      .select('verified_at, expires_at')
      .eq('user_id', userId)
      .eq('auth_session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sessionError) return json({ success: false, error_code: 'verification_unavailable' }, 503)
    if (validSession) {
      return json({ success: true, skipped: true, expires_at: validSession.expires_at })
    }

    const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = authUserResult?.user?.email
    if (authUserError || !email) return json({ success: false, error_code: 'profile_missing' }, 404)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('nome')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle()
    if (profileError || !profile) return json({ success: false, error_code: 'profile_missing' }, 403)

    const code = generateOTP()
    const codeHash = await hashOTP(code, userId, sessionId, serviceKey)
    const { data: issueRows, error: issueError } = await supabaseAdmin.rpc('issue_session_mfa_code', {
      p_user_id: userId,
      p_auth_session_id: sessionId,
      p_code_hash: codeHash,
    })
    if (issueError) {
      console.error('send-mfa-code: issue failed', issueError)
      return json({ success: false, error_code: 'verification_unavailable' }, 503)
    }

    const issue = Array.isArray(issueRows) ? issueRows[0] : issueRows
    if (!issue) return json({ success: false, error_code: 'verification_unavailable' }, 503)
    if (issue.status === 'rate_limited') {
      return json({ success: false, error_code: 'rate_limited', retry_after: issue.retry_after })
    }
    if (issue.status === 'cooldown') {
      return json({
        success: true,
        reused: true,
        expires_at: issue.expires_at,
        resend_after: issue.retry_after,
      })
    }
    if (issue.status !== 'issued' || !issue.code_id) {
      return json({ success: false, error_code: issue.status ?? 'verification_unavailable' }, 503)
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      await supabaseAdmin.from('mfa_codes').update({ used: true }).eq('id', issue.code_id)
      return json({ success: false, error_code: 'delivery_unavailable' }, 503)
    }

    const html = await renderAsync(React.createElement(MFACodeEmail, {
      userName: profile.nome,
      code,
    }))
    const resend = new Resend(resendApiKey)
    const { error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [email],
      subject: `${code} — Código de verificação Akuris`,
      html,
      text: htmlToText(html),
    })

    if (emailError) {
      await supabaseAdmin.from('mfa_codes').update({ used: true }).eq('id', issue.code_id)
      console.error('send-mfa-code: delivery failed', emailError)
      return json({ success: false, error_code: 'delivery_unavailable' }, 502)
    }

    await supabaseAdmin
      .from('mfa_codes')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', issue.code_id)

    return json({
      success: true,
      expires_at: issue.expires_at,
      resend_after: 60,
    })
  } catch (error) {
    console.error('send-mfa-code: unexpected failure', error)
    return json({ success: false, error_code: 'verification_unavailable' }, 500)
  }
})
