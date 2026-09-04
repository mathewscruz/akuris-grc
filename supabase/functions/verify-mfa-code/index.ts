import { createClient } from 'npm:@supabase/supabase-js@2'
import { authCorsHeaders } from '../_shared/cors.ts'

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

    const body = await req.json().catch(() => ({})) as { code?: unknown }
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^\d{6}$/.test(code)) return json({ success: false, error_code: 'invalid_code', remaining_attempts: 5 })

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
    const codeHash = await hashOTP(code, userId, sessionId, serviceKey)
    const { data: rows, error } = await supabaseAdmin.rpc('verify_session_mfa_code_attempt', {
      p_user_id: userId,
      p_auth_session_id: sessionId,
      p_code_hash: codeHash,
    })
    if (error) {
      console.error('verify-mfa-code: transaction failed', error)
      return json({ success: false, error_code: 'verification_unavailable' }, 503)
    }

    const result = Array.isArray(rows) ? rows[0] : rows
    if (!result) return json({ success: false, error_code: 'verification_unavailable' }, 503)
    if (result.status !== 'verified') {
      return json({
        success: false,
        error_code: result.status,
        remaining_attempts: result.remaining_attempts ?? 0,
      })
    }

    return json({
      success: true,
      expires_at: result.session_expires_at,
    })
  } catch (error) {
    console.error('verify-mfa-code: unexpected failure', error)
    return json({ success: false, error_code: 'verification_unavailable' }, 500)
  }
})
