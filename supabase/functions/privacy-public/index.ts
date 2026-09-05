import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const MAX_BODY_BYTES = 64 * 1024;
const RIGHTS = new Set([
  'confirmacao', 'acesso', 'correcao', 'retificacao', 'anonimizacao',
  'apagamento', 'limitacao', 'portabilidade', 'eliminacao', 'informacao',
  'revogacao', 'oposicao', 'decisaoAutomatizada',
]);

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const clientIp = (req: Request) =>
  req.headers.get('cf-connecting-ip')?.trim()
  || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || req.headers.get('x-real-ip')?.trim()
  || 'unknown';

const validSlug = (value: unknown): value is string =>
  typeof value === 'string'
  && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);

const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const action = body.action;
  if (action !== 'create' && action !== 'consult') return json({ error: 'invalid_action' }, 400);
  if (!validSlug(body.slug)) return json({ error: 'invalid_request' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: withinLimit, error: rateError } = await admin.rpc('consume_security_rate_limit', {
    p_scope: `privacy-public:${action}:${body.slug}`,
    p_fingerprint_hash: await sha256(clientIp(req)),
    p_max_requests: action === 'create' ? 10 : 30,
    p_window_seconds: action === 'create' ? 3600 : 600,
  });
  if (rateError) return json({ error: 'service_unavailable' }, 503);
  if (withinLimit !== true) return json({ error: 'rate_limited' }, 429);

  if (action === 'consult') {
    const protocolo = typeof body.protocolo === 'string' ? body.protocolo.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(protocolo)
      || !validEmail(email)) {
      return json({ error: 'invalid_request' }, 400);
    }

    const { data, error } = await admin.rpc('consultar_solicitacao_privacidade_publica', {
      p_slug: body.slug,
      p_protocolo: protocolo,
      p_email: email,
    });
    if (error) return json({ error: 'request_failed' }, 400);
    return json({ solicitacao: data?.[0] || null });
  }

  const tipo = typeof body.tipo === 'string' ? body.tipo : '';
  const titular = body.dadosTitular && typeof body.dadosTitular === 'object' && !Array.isArray(body.dadosTitular)
    ? body.dadosTitular as Record<string, unknown>
    : {};
  const nome = typeof titular.nome === 'string' ? titular.nome.trim() : '';
  const email = typeof titular.email === 'string' ? titular.email.trim().toLowerCase() : '';
  const telefone = typeof titular.telefone === 'string' ? titular.telefone.trim() : '';
  const documento = typeof titular.documento === 'string' ? titular.documento.trim() : '';
  const dadosSolicitados = typeof body.dadosSolicitados === 'string' ? body.dadosSolicitados.trim() : '';
  const justificativa = typeof body.justificativa === 'string' ? body.justificativa.trim() : '';

  if (!RIGHTS.has(tipo)
    || nome.length < 2 || nome.length > 160
    || !validEmail(email)
    || telefone.length > 40 || documento.length > 80
    || dadosSolicitados.length < 3 || dadosSolicitados.length > 5000
    || justificativa.length > 5000) {
    return json({ error: 'invalid_request' }, 400);
  }

  const { data, error } = await admin.rpc('criar_solicitacao_privacidade_publica', {
    p_slug: body.slug,
    p_tipo: tipo,
    p_dados_titular: {
      nome,
      email,
      ...(telefone ? { telefone } : {}),
      ...(documento ? { documento } : {}),
    },
    p_dados_solicitados: dadosSolicitados,
    p_justificativa: justificativa || null,
  });
  if (error) {
    const limited = error.message?.includes('Limite temporário');
    return json({ error: limited ? 'rate_limited' : 'request_failed' }, limited ? 429 : 400);
  }
  return json({ protocolo: data }, 201);
});
