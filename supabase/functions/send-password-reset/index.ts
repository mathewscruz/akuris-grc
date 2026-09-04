import React from 'npm:react@18.3.1'
import { Resend } from 'npm:resend@4.0.0'
import { htmlToText } from '../_shared/email.ts'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PasswordResetEmail } from './_templates/password-reset-email.tsx'
import { authCorsHeaders } from '../_shared/cors.ts'

const DEFAULT_APP_URL = 'https://akuris.pt'

const MAX_PUBLIC_TARGET_PER_HOUR = 5
const MAX_PUBLIC_IP_PER_HOUR = 20
const MAX_ADMIN_PER_HOUR = 30

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

interface PasswordResetRequest {
  email?: unknown
  userId?: unknown
}

const applicationUrl = (): string => {
  const candidate = (Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || DEFAULT_APP_URL).replace(/\/$/, '')
  try {
    const parsed = new URL(candidate)
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return DEFAULT_APP_URL
    return parsed.origin
  } catch {
    return DEFAULT_APP_URL
  }
}

Deno.serve(async (req) => {
  const corsHeaders = authCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
  const uniformSuccess = () => json({
    success: true,
    message_code: 'recovery_requested',
  })
  let adminRequest = false

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const body = await req.json().catch(() => ({})) as PasswordResetRequest
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const userId = typeof body.userId === 'string' ? body.userId : ''

    let adminProfile: { user_id: string; role: string; empresa_id: string | null } | null = null
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const { data: authData } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, role, empresa_id')
          .eq('user_id', authData.user.id)
          .maybeSingle()
        if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) adminProfile = profile
      }
    }

    const isAdminRequest = Boolean(adminProfile)
    adminRequest = isAdminRequest
    const failure = (errorCode: string, status = 400) =>
      isAdminRequest ? json({ success: false, error_code: errorCode }, status) : uniformSuccess()

    if ((!email && !userId) || (userId && !isAdminRequest)) {
      return failure(userId ? 'forbidden' : 'invalid_request', userId ? 403 : 400)
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const fingerprints = isAdminRequest
      ? [{ value: `admin:${adminProfile!.user_id}`, limit: MAX_ADMIN_PER_HOUR }]
      : [
          { value: `public-ip:${clientIp}`, limit: MAX_PUBLIC_IP_PER_HOUR },
          { value: `public-target:${email}`, limit: MAX_PUBLIC_TARGET_PER_HOUR },
        ]

    for (const fingerprint of fingerprints) {
      const { data: allowed, error: limitError } = await supabase.rpc('consume_password_reset_attempt', {
        p_fingerprint_hash: await sha256Hex(fingerprint.value),
        p_max_attempts: fingerprint.limit,
      })
      if (limitError) {
        console.error('send-password-reset: limiter unavailable', limitError)
        return json({ success: false, error_code: 'service_unavailable' }, 503)
      }
      if (allowed !== true) {
        return json({ success: false, error_code: 'rate_limited', retry_after: 3600 }, 429)
      }
    }

    let profile: {
      user_id: string
      nome: string
      email: string
      empresa_id: string | null
      empresa?: { nome?: string; logo_url?: string | null } | null
    } | null = null

    if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, nome, email, empresa_id, empresa:empresas(nome, logo_url)')
        .eq('user_id', userId)
        .maybeSingle()
      profile = data as typeof profile
      if (profile && adminProfile!.role !== 'super_admin' && profile.empresa_id !== adminProfile!.empresa_id) {
        return failure('forbidden', 403)
      }
    } else {
      const pattern = email.replace(/([%_\\])/g, '\\$1')
      const { data: candidates } = await supabase
        .from('profiles')
        .select('user_id, nome, email, empresa_id, empresa:empresas(nome, logo_url)')
        .ilike('email', pattern)
        .limit(10)
      profile = (candidates ?? []).find(
        (candidate) => (candidate.email ?? '').trim().toLowerCase() === email,
      ) as typeof profile
    }

    if (!profile) return failure('profile_missing', 404)

    const siteUrl = applicationUrl()
    const redirectTo = `${siteUrl}/definir-senha`
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo },
    })
    if (linkError || !linkData) {
      console.error('send-password-reset: link generation failed', linkError)
      return failure('link_generation_failed', 500)
    }

    const resetUrl = `${redirectTo}?token_hash=${linkData.properties.hashed_token}&type=recovery`
    const html = await renderAsync(React.createElement(PasswordResetEmail, {
      userName: profile.nome,
      resetUrl,
      companyName: profile.empresa?.nome,
      // A personalização vem exclusivamente do registo confiável da empresa.
      companyLogoUrl: profile.empresa?.logo_url,
    }))

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return failure('delivery_unavailable', 503)
    const resend = new Resend(resendApiKey)
    const { error: sendError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [profile.email],
      subject: 'Redefinição de senha — Akuris',
      html,
      text: htmlToText(html),
    })
    if (sendError) {
      console.error('send-password-reset: delivery failed', sendError)
      return failure('delivery_unavailable', 502)
    }

    if (isAdminRequest) {
      await supabase.from('audit_logs').insert({
        user_id: adminProfile!.user_id,
        empresa_id: profile.empresa_id,
        action: 'password_reset_requested',
        table_name: 'profiles',
        record_id: profile.user_id,
        new_values: { channel: 'email' },
      })
      return json({ success: true, email: profile.email })
    }

    return uniformSuccess()
  } catch (error) {
    console.error('send-password-reset: unexpected failure', error)
    // O fluxo público continua uniforme para não revelar se o email existe.
    return adminRequest
      ? json({ success: false, error_code: 'service_unavailable' }, 503)
      : uniformSuccess()
  }
})
