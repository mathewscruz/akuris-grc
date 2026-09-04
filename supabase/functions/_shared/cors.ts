const canonicalOrigin = 'https://akuris.pt'
const defaultOrigins = [
  canonicalOrigin,
  'https://www.akuris.pt',
  'https://akuris.com.br',
  'https://www.akuris.com.br',
]

const configuredOrigins = () => new Set(
  (Deno.env.get('AUTH_ALLOWED_ORIGINS') ?? defaultOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
)

const isLocalDevelopmentOrigin = (origin: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/i.test(supabaseUrl)) return false
  try {
    const url = new URL(origin)
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

/** CORS estrito para os fluxos de autenticação, com exceção apenas no stack local. */
export const authCorsHeaders = (req: Request): Record<string, string> => {
  const origin = (req.headers.get('Origin') ?? '').replace(/\/$/, '')
  const allowed = configuredOrigins().has(origin) || isLocalDevelopmentOrigin(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : canonicalOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
