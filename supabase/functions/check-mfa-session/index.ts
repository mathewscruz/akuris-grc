import { createClient } from 'npm:@supabase/supabase-js@2'
import { authCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = authCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ verified: false, error_code: 'unauthorized' }, 401)

    const token = authHeader.slice('Bearer '.length)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
    const sessionId = typeof claimsData?.claims?.session_id === 'string' ? claimsData.claims.session_id : null
    if (claimsError || !userId || !sessionId) {
      return json({ verified: false, error_code: 'session_context_missing' }, 401)
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: validSession, error } = await supabaseAdmin
      .from('mfa_sessions')
      .select('verified_at, expires_at')
      .eq('user_id', userId)
      .eq('auth_session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('check-mfa-session: query failed', error)
      return json({ verified: false, error_code: 'verification_unavailable' }, 503)
    }

    return validSession
      ? json({ verified: true, expires_at: validSession.expires_at })
      : json({ verified: false })
  } catch (error) {
    console.error('check-mfa-session: unexpected failure', error)
    return json({ verified: false, error_code: 'verification_unavailable' }, 500)
  }
})
