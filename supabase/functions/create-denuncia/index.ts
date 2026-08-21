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

    /*
      Autentica quem consulta/escreve sem sessão: o código de acompanhamento
      é a única credencial que o denunciante anónimo tem. Devolve a denúncia
      quando bate, `null` quando não — nunca diz QUAL das duas falhou, para
      não servir de oráculo de protocolos válidos.
    */
    async function denunciaPeloCodigo(denunciaId: string, codigo: string) {
      if (!denunciaId || !codigo) return null;
      const hash = await sha256(String(codigo).trim());
      const { data } = await supabase
        .from('denuncias')
        .select('id, empresa_id, protocolo')
        .eq('id', denunciaId)
        .eq('token_acompanhamento_hash', hash)
        .is('token_acompanhamento_revoked_at', null)
        .maybeSingle();
      return data ?? null;
    }

    /*
      Pedido de envio de evidência.

      O denunciante não escreve no bucket com a chave pública — abrir `INSERT`
      ao papel `anon` seria um balde aberto à internet. Aqui a função valida o
      código, regista a linha em `denuncias_anexos` e devolve uma URL assinada
      de curta duração para o ficheiro concreto.

      Era exactamente esta ponte que faltava: o formulário enviava direto para
      um bucket inexistente, engolia o erro e mostrava sucesso.
    */
    if (action === 'anexo_url') {
      const { denuncia_id, codigo, nome, tipo, tamanho } = body;
      const denuncia = await denunciaPeloCodigo(String(denuncia_id ?? ''), String(codigo ?? ''));
      if (!denuncia) return json({ error: 'nao_autorizado' }, 403);

      if (!nome || typeof nome !== 'string') return json({ error: 'nome_invalido' }, 400);
      if (Number(tamanho) > 10 * 1024 * 1024) return json({ error: 'arquivo_grande' }, 413);

      const ext = String(nome).split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
      const caminho = `${denuncia.empresa_id}/${denuncia.id}/${crypto.randomUUID()}.${ext}`;

      const { data: assinado, error: erroUrl } = await supabase.storage
        .from('denuncias-anexos')
        .createSignedUploadUrl(caminho);
      if (erroUrl) return json({ error: erroUrl.message }, 400);

      const { data: anexo, error: erroAnexo } = await supabase
        .from('denuncias_anexos')
        .insert({
          denuncia_id: denuncia.id,
          nome_arquivo: String(nome).slice(0, 255),
          tipo_arquivo: tipo ?? null,
          tamanho_arquivo: Number(tamanho) || null,
          arquivo_url: caminho,
          /* 'denuncia' = veio com o registo. Os outros valores do CHECK são
             'evidencia' e 'investigacao', que o comité usa depois. */
          tipo_anexo: 'denuncia',
          upload_status: 'pendente',
        })
        .select('id')
        .single();
      if (erroAnexo) return json({ error: erroAnexo.message }, 400);

      return json({ anexo_id: anexo.id, caminho, signed_url: assinado.signedUrl, token: assinado.token });
    }

    /* O ficheiro chegou mesmo ao armazenamento. Sem isto fica `pendente`, e a
       ficha do gestor mostra que houve tentativa — que é melhor do que fingir
       que não houve nada. */
    if (action === 'anexo_confirmar') {
      const { denuncia_id, codigo, anexo_id } = body;
      const denuncia = await denunciaPeloCodigo(String(denuncia_id ?? ''), String(codigo ?? ''));
      if (!denuncia) return json({ error: 'nao_autorizado' }, 403);

      const { error } = await supabase
        .from('denuncias_anexos')
        .update({ upload_status: 'concluido' })
        .eq('id', String(anexo_id))
        .eq('denuncia_id', denuncia.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    /* A resposta do denunciante. `autor_id` fica nulo de propósito: guardar um
       id aqui identificaria quem o canal promete não identificar. */
    if (action === 'mensagem') {
      const { denuncia_id, codigo, mensagem } = body;
      const denuncia = await denunciaPeloCodigo(String(denuncia_id ?? ''), String(codigo ?? ''));
      if (!denuncia) return json({ error: 'nao_autorizado' }, 403);

      const texto = String(mensagem ?? '').trim();
      if (!texto) return json({ error: 'mensagem_vazia' }, 400);
      if (texto.length > 5000) return json({ error: 'mensagem_longa' }, 413);

      const { error } = await supabase.from('denuncias_mensagens').insert({
        denuncia_id: denuncia.id,
        empresa_id: denuncia.empresa_id,
        autor_tipo: 'denunciante',
        autor_id: null,
        mensagem: texto,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
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
