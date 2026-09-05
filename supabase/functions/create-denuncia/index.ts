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

const MAX_BODY_BYTES = 128 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FILE_TYPES: Record<string, { extension: string; signature: number[] }> = {
  'application/pdf': { extension: 'pdf', signature: [0x25, 0x50, 0x44, 0x46] },
  'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'application/msword': { extension: 'doc', signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  'application/vnd.ms-excel': { extension: 'xls', signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', signature: [0x50, 0x4b, 0x03, 0x04] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: 'xlsx', signature: [0x50, 0x4b, 0x03, 0x04] },
};

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

function fileMatches(bytes: Uint8Array, mime: string): boolean {
  const expected = FILE_TYPES[mime]?.signature;
  return !!expected && expected.every((value, index) => bytes[index] === value);
}

function safeFileName(value: string): string {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? '_' : char;
    })
    .join('')
    .slice(0, 255);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'payload_too_large' }, 413);
    }
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      body = parsed;
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }
    const action = body.action ?? 'create';
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown';

    const rateFingerprint = action === 'consult'
      ? `${String(body.empresa_slug || '')}:${clientIp}`
      : `${String(body.denuncia_id || body.empresa_slug || '')}:${clientIp}`;
    const { data: withinLimit, error: rateError } = await supabase.rpc('consume_security_rate_limit', {
      p_scope: `create-denuncia:${String(action).slice(0, 80)}`,
      p_fingerprint_hash: await sha256(rateFingerprint),
      p_max_requests: action === 'create' ? 10 : action === 'consult' ? 30 : 120,
      p_window_seconds: action === 'create' ? 3600 : action === 'consult' ? 600 : 60,
    });
    if (rateError) return json({ error: 'service_unavailable' }, 503);
    if (withinLimit !== true) return json({ error: 'rate_limited' }, 429);

    if (action === 'consult') {
      const { empresa_slug, protocolo, codigo } = body;
      if (!empresa_slug || !protocolo) {
        return json({ error: 'missing_parameters' }, 400);
      }
      /* Denúncias anteriores ao código de acompanhamento não têm código
         nenhum para dar — a RPC aceita-as só com o protocolo. */
      const codigoLimpo = codigo ? String(codigo).trim() : '';
      const { data, error } = await supabase.rpc('consult_denuncia_publica', {
        p_empresa_slug: String(empresa_slug),
        p_protocolo: String(protocolo),
        p_tracking_hash: codigoLimpo ? await sha256(codigoLimpo) : '',
      });
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: 'not_found' }, 404);
      if (!codigoLimpo) {
        // Compatibilidade segura para denúncias antigas, que nunca receberam
        // código: mantém o acompanhamento básico sem expor relato, mensagens,
        // deliberações, identidade ou resultado a quem só adivinhou protocolo.
        return json({ denuncia: {
          protocolo: data.protocolo,
          status: data.status,
          created_at: data.created_at,
          prazo_acusacao: data.prazo_acusacao,
          prazo_retorno: data.prazo_retorno,
          data_acusacao_recebimento: data.data_acusacao_recebimento,
          data_conclusao: data.data_conclusao,
          categoria: data.categoria,
          acesso_legado_limitado: true,
        } });
      }
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
      const mime = typeof tipo === 'string' ? tipo.toLowerCase() : '';
      const fileType = FILE_TYPES[mime];
      if (!fileType) return json({ error: 'tipo_arquivo_invalido' }, 400);
      if (!Number.isFinite(Number(tamanho)) || Number(tamanho) <= 0 || Number(tamanho) > MAX_FILE_BYTES) {
        return json({ error: 'arquivo_grande' }, 413);
      }

      const ext = fileType.extension;
      const caminho = `${denuncia.empresa_id}/${denuncia.id}/${crypto.randomUUID()}.${ext}`;

      const { data: assinado, error: erroUrl } = await supabase.storage
        .from('denuncias-anexos')
        .createSignedUploadUrl(caminho);
      if (erroUrl) return json({ error: erroUrl.message }, 400);

      const { data: anexo, error: erroAnexo } = await supabase
        .from('denuncias_anexos')
        .insert({
          denuncia_id: denuncia.id,
          nome_arquivo: safeFileName(String(nome)),
          tipo_arquivo: mime,
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

      const { data: anexo } = await supabase
        .from('denuncias_anexos')
        .select('id,arquivo_url,tipo_arquivo,tamanho_arquivo')
        .eq('id', String(anexo_id))
        .eq('denuncia_id', denuncia.id)
        .eq('upload_status', 'pendente')
        .maybeSingle();
      if (!anexo?.arquivo_url) return json({ error: 'anexo_invalido' }, 400);

      const { data: arquivo, error: downloadError } = await supabase.storage
        .from('denuncias-anexos')
        .download(anexo.arquivo_url);
      if (downloadError || !arquivo || arquivo.size <= 0 || arquivo.size > MAX_FILE_BYTES) {
        await supabase.storage.from('denuncias-anexos').remove([anexo.arquivo_url]);
        await supabase.from('denuncias_anexos').delete().eq('id', anexo.id);
        return json({ error: 'arquivo_invalido' }, 400);
      }
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      if (!fileMatches(bytes, anexo.tipo_arquivo)) {
        await supabase.storage.from('denuncias-anexos').remove([anexo.arquivo_url]);
        await supabase.from('denuncias_anexos').delete().eq('id', anexo.id);
        return json({ error: 'conteudo_arquivo_invalido' }, 400);
      }

      const { error } = await supabase
        .from('denuncias_anexos')
        .update({ upload_status: 'concluido', tamanho_arquivo: arquivo.size })
        .eq('id', String(anexo_id))
        .eq('denuncia_id', denuncia.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    /*
      A reunião do art. 9.º/2.

      A Diretiva manda o canal permitir, a pedido, um encontro. O pedido tem
      de partir de quem denunciou — e quem denunciou não tem conta: a única
      credencial é o código de acompanhamento, o mesmo que já autentica as
      mensagens e os anexos.
    */
    if (action === 'reuniao_solicitar') {
      const { denuncia_id, codigo, modalidade, preferencia } = body;
      const denuncia = await denunciaPeloCodigo(String(denuncia_id ?? ''), String(codigo ?? ''));
      if (!denuncia) return json({ error: 'nao_autorizado' }, 403);

      const { data, error } = await supabase.rpc('solicitar_reuniao_denuncia', {
        p_denuncia_id: denuncia.id,
        p_tracking_hash: await sha256(String(codigo).trim()),
        p_modalidade: String(modalidade ?? 'presencial'),
        p_preferencia: String(preferencia ?? ''),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ reuniao: data });
    }

    /* A acta lida e aceite por quem esteve na reunião — art. 18.º/2. */
    if (action === 'reuniao_confirmar_ata') {
      const { reuniao_id, denuncia_id, codigo } = body;
      const denuncia = await denunciaPeloCodigo(String(denuncia_id ?? ''), String(codigo ?? ''));
      if (!denuncia) return json({ error: 'nao_autorizado' }, 403);

      const { data, error } = await supabase.rpc('confirmar_ata_reuniao', {
        p_reuniao_id: String(reuniao_id ?? ''),
        p_tracking_hash: await sha256(String(codigo).trim()),
      });
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: 'nao_autorizado' }, 403);
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
      nivel_identificacao,
    } = body;

    if (!empresa_slug || !titulo || !descricao) {
      return json({ error: 'missing_parameters' }, 400);
    }

    const codigo = randomCode();
    const trackingHash = await sha256(codigo);

    const fingerprintHash = await sha256(
      `${empresa_slug}|${clientIp}|${req.headers.get('user-agent') ?? 'sem-ua'}`,
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
      p_client_ip: clientIp === 'unknown' ? null : clientIp,
      p_user_agent: req.headers.get('user-agent') ?? null,
      /* Três níveis, não um booleano: identificar-se e pedir reserva são
         coisas diferentes, e a Diretiva trata-as em artigos diferentes. */
      p_nivel_identificacao: nivel_identificacao ?? null,
    });

    if (error) return json({ error: error.message }, 400);

    const result: any = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});

    /*
      Avisar quem tem de apurar.

      `send-denuncia-notification` existia, estava publicada, declarada no
      `config.toml` — e não era chamada de lado nenhum. Nem daqui, nem por
      gatilho, nem por webhook. Uma denúncia entrava às duas da manhã, o
      relógio de 7 dias começava a correr, e a descoberta dependia de alguém
      abrir o módulo por iniciativa própria.

      Falha em silêncio de propósito: a denúncia JÁ está registada e o
      protocolo tem de chegar a quem denunciou. Um erro de e-mail não pode
      transformar-se em «não foi possível registar».
    */
    const denunciaId = result.id ?? result.denuncia_id ?? null;
    const empresaId = result.empresa_id ?? null;
    if (denunciaId && empresaId) {
      try {
        const aviso = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-denuncia-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ denuncia_id: denunciaId, empresa_id: empresaId }),
        });
        if (!aviso.ok) {
          console.error('Aviso da denúncia falhou:', aviso.status, await aviso.text());
        }
      } catch (e) {
        console.error('Aviso da denúncia falhou:', e instanceof Error ? e.message : String(e));
      }

      /*
        E avisar as integrações que a empresa ligou.

        `denuncia_recebida` era o único evento do canal no catálogo e nunca
        disparava numa recepção: a única chamada estava na ficha, na mudança de
        estado. Quem ligasse «Denúncia recebida» ao Slack era avisado ao
        ARQUIVAR e ficava sem saber quando entrava uma.

        Vai o protocolo e mais nada. O título do relato não sai do perímetro
        por um webhook que a empresa configura livremente — num canal em que o
        sigilo é a promessa, quem tem de ler o caso abre o Akuris.
      */
      try {
        const evento = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/integration-webhook-dispatcher`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            empresa_id: empresaId,
            evento: 'denuncia_recebida',
            titulo: `Nova denúncia: ${result.protocolo ?? ''}`,
            descricao: 'Entrou uma denúncia no canal. Abra o Akuris para a ver.',
            link: `${Deno.env.get('SITE_URL') ?? 'https://akuris.pt'}/denuncia`,
            dados: { protocolo: result.protocolo ?? null, id: denunciaId },
            gravidade: 'alta',
            timestamp: new Date().toISOString(),
          }),
        });
        if (!evento.ok) {
          console.error('Evento de integração falhou:', evento.status, await evento.text());
        }
      } catch (e) {
        console.error('Evento de integração falhou:', e instanceof Error ? e.message : String(e));
      }
    }

    return json({
      id: denunciaId,
      protocolo: result.protocolo ?? result,
      codigo_acompanhamento: codigo,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
