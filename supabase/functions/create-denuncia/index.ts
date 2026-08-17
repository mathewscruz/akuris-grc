import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const action = body.action ?? 'create';

    if (action === 'consult') {
      const { empresa_slug, protocolo, codigo } = body;
      if (!empresa_slug || !protocolo || !codigo) {
        return json({ error: 'missing_parameters' }, 400);
      }
      const { data, error } = await supabase.rpc('consult_denuncia_publica', {
        p_empresa_slug: String(empresa_slug),
        p_protocolo: String(protocolo),
        p_tracking_hash: await sha256(String(codigo).trim()),
      });
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: 'not_found' }, 404);
      return json({ denuncia: data });
    }

    const {
      empresa_slug,
      categoria_id,
      titulo,
      descricao,
      anonima,
      politica_aceita,
      denunciante_nome,
      denunciante_email,
      denunciante_telefone,
      local_ocorrencia,
      data_ocorrencia,
      testemunhas,
      evidencias_descricao,
    } = body;

    if (!empresa_slug || !titulo || !descricao) {
      return json({ error: 'missing_parameters' }, 400);
    }

    const codigo = randomCode();
    const trackingHash = await sha256(codigo);

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    const fingerprintHash = await sha256(
      `${empresa_slug}|${clientIp ?? 'sem-ip'}|${req.headers.get('user-agent') ?? 'sem-ua'}`,
    );

    const { data, error } = await supabase.rpc('create_denuncia_publica', {
      p_empresa_slug: String(empresa_slug),
      p_categoria_id: categoria_id ?? null,
      p_titulo: String(titulo),
      p_descricao: String(descricao),
      p_anonima: anonima ?? true,
      p_politica_aceita: politica_aceita ?? true,
      p_denunciante_nome: denunciante_nome ?? null,
      p_denunciante_email: denunciante_email ?? null,
      p_denunciante_telefone: denunciante_telefone ?? null,
      p_local_ocorrencia: local_ocorrencia ?? null,
      p_data_ocorrencia: data_ocorrencia ?? null,
      p_testemunhas: testemunhas ?? null,
      p_evidencias_descricao: evidencias_descricao ?? null,
      p_tracking_hash: trackingHash,
      p_fingerprint_hash: fingerprintHash,
      p_client_ip: clientIp,
      p_user_agent: req.headers.get('user-agent') ?? null,
    });

    if (error) return json({ error: error.message }, 400);

    const result: any = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
    return json({
      id: result.id ?? result.denuncia_id ?? null,
      protocolo: result.protocolo ?? result,
      codigo_acompanhamento: codigo,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
