import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token, x-webhook-signature, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BODY_BYTES = 256 * 1024;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function text(value: unknown, fallback = '', max = 10_000): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return (normalized || fallback).slice(0, max);
}

function scale(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : fallback;
}

function requestIp(req: Request): string | null {
  const candidate = req.headers.get('cf-connecting-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || '';
  return candidate.length <= 45 && /^[0-9a-f:.]+$/i.test(candidate) ? candidate : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const token = req.headers.get('x-webhook-token') || url.searchParams.get('token');

    if (!token || !/^wh_[A-Za-z0-9]{24,128}$/.test(token)) {
      return new Response(JSON.stringify({ error: 'Missing token parameter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const tokenHash = await sha256Hex(token);

    // Lookup webhook config by a one-way digest. The original token is shown
    // once at creation and is never stored or returned by the data API.
    const { data: webhook, error: whError } = await supabase
      .from('api_inbound_webhooks')
      .select('id,empresa_id,nome,tipo_evento,modulo_destino,signing_secret,ativo')
      .eq('webhook_token_hash', tokenHash)
      .eq('ativo', true)
      .single();

    if (whError || !webhook) {
      return new Response(JSON.stringify({ error: 'Invalid or inactive webhook token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: withinLimit, error: limitError } = await supabase.rpc('consume_security_rate_limit', {
      p_scope: 'api-inbound-webhook',
      p_fingerprint_hash: await sha256Hex(webhook.id),
      p_max_requests: 120,
      p_window_seconds: 60,
    });
    if (limitError) {
      console.error('Webhook rate limiter unavailable:', limitError);
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (withinLimit !== true) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // Ler body como texto para validação de assinatura antes de parsear JSON
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload exceeds 256 KB' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload exceeds 256 KB' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validação HMAC-SHA256 (opcional — só exige se signing_secret estiver configurado)
    if (webhook.signing_secret) {
      const sigHeader =
        req.headers.get('x-webhook-signature') ||
        req.headers.get('x-hub-signature-256') || '';
      const provided = sigHeader.replace(/^sha256=/i, '').trim().toLowerCase();

      if (!provided) {
        return new Response(JSON.stringify({ error: 'Assinatura HMAC ausente (header X-Webhook-Signature)' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          enc.encode(webhook.signing_secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
        const expected = Array.from(new Uint8Array(sigBuf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Comparação em tempo constante
        if (expected.length !== provided.length) {
          return new Response(JSON.stringify({ error: 'Assinatura inválida' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
          diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
        }
        if (diff !== 0) {
          return new Response(JSON.stringify({ error: 'Assinatura inválida' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (sigErr) {
        console.error('HMAC verification failed:', sigErr);
        return new Response(JSON.stringify({ error: 'Falha ao validar assinatura' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Body JSON inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: 'Body must be a JSON object' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route to appropriate module
    let insertError = null;
    const empresaId = webhook.empresa_id;

    switch (webhook.modulo_destino) {
      case 'incidentes': {
        const { error } = await supabase.from('incidentes').insert({
          empresa_id: empresaId,
          titulo: text(body.title || body.titulo || body.alert_name, `Alerta via ${webhook.nome}`, 240),
          descricao: text(body.description || body.descricao || body.message, JSON.stringify(body), 20_000),
          tipo_incidente: text(body.type || body.tipo, 'seguranca', 80),
          criticidade: mapCriticidade(body.severity || body.criticidade || body.priority),
          status: 'aberto',
          origem_deteccao: `webhook:${webhook.nome}`.slice(0, 160),
        });
        insertError = error;
        break;
      }
      case 'riscos': {
        /*
          Este insert nunca funcionou: `categoria`, `probabilidade` e `impacto`
          não são colunas de `riscos` (os nomes reais têm sufixo `_inicial`), e
          `nivel_risco_inicial` é escrito pelo trigger `trg_risco_calcular`.
          Todo risco que entrasse por webhook era recusado pelo PostgREST.

          Agora entram probabilidade e impacto na escala da matriz, e o nível
          sai do banco — a mesma regra de quem cria pelo formulário.
        */
        const posicao = mapEscala(body.severity || body.level);
        const { error } = await supabase.from('riscos').insert({
          empresa_id: empresaId,
          nome: text(body.title || body.nome || body.risk_name, `Risco via ${webhook.nome}`, 240),
          descricao: text(body.description || body.descricao, JSON.stringify(body), 20_000),
          probabilidade_inicial: scale(body.probability ?? body.probabilidade, posicao),
          impacto_inicial: scale(body.impact ?? body.impacto, posicao),
          status: 'identificado',
        });
        insertError = error;
        break;
      }
      case 'ativos': {
        const { error } = await supabase.from('ativos').insert({
          empresa_id: empresaId,
          nome: text(body.name || body.nome || body.hostname, `Ativo via ${webhook.nome}`, 240),
          tipo: text(body.type || body.tipo, 'Servidor', 80),
          descricao: text(body.description || body.descricao, JSON.stringify(body), 20_000),
          status: 'ativo',
        });
        insertError = error;
        break;
      }
      case 'controles': {
        const { error } = await supabase.from('controles').insert({
          empresa_id: empresaId,
          nome: text(body.title || body.nome || body.control_name, `Controle via ${webhook.nome}`, 240),
          descricao: text(body.description || body.descricao, JSON.stringify(body), 20_000),
          tipo: text(body.type || body.tipo, 'preventivo', 80),
          status: text(body.status, 'ativo', 40),
          criticidade: mapCriticidade(body.severity || body.criticidade || body.priority),
          frequencia: text(body.frequency || body.frequencia, 'mensal', 80),
        });
        insertError = error;
        break;
      }
      case 'denuncias': {
        const { error } = await supabase.from('denuncias').insert({
          empresa_id: empresaId,
          token_publico: crypto.randomUUID().replaceAll('-', ''),
          titulo: text(body.title || body.titulo, `Denúncia via ${webhook.nome}`, 240),
          descricao: text(body.description || body.descricao || body.message, JSON.stringify(body), 20_000),
          gravidade: mapCriticidade(body.severity || body.gravidade || body.priority),
          status: 'nova',
          anonima: body.anonymous !== undefined ? body.anonymous : true,
          protocolo: `DEN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 16).toUpperCase()}`,
          nivel_identificacao: 'anonima',
          politica_aceita: true,
        });
        insertError = error;
        break;
      }
      default: {
        return new Response(JSON.stringify({ error: 'Unsupported destination module' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to process event' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update webhook stats
    await supabase.rpc('touch_inbound_webhook_usage', { p_webhook_id: webhook.id });

    // Log the request
    await supabase.from('api_request_logs').insert({
      empresa_id: empresaId,
      metodo: req.method,
      endpoint: `/api-inbound-webhook/${webhook.tipo_evento}`,
      status_code: 200,
      ip_address: requestIp(req),
      request_body: body,
    });

    return new Response(JSON.stringify({ success: true, message: 'Event processed' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Severidade de quem chama → vocabulário canónico do produto.
 *
 * Devolvia o feminino ('critica'/'alta'/'media'/'baixa'), que a migration
 * `20260821110000` deixou de aceitar: o CHECK recusaria a linha inteira. Um
 * alerta legítimo de um SIEM passaria a ser rejeitado no webhook.
 */
function mapCriticidade(severity?: string): string {
  const s = (severity || '').toLowerCase().trim();
  if (['critical', 'critica', 'critico', 'p1', '1'].includes(s)) return 'critico';
  if (['high', 'alta', 'alto', 'p2', '2'].includes(s)) return 'alto';
  if (['low', 'baixa', 'baixo', 'p4', '4'].includes(s)) return 'baixo';
  return 'medio';
}

/**
 * Severidade de quem chama → posição na escala da matriz.
 *
 * `mapNivelRisco` devolvia o RÓTULO ("Crítico") para gravar directamente em
 * `nivel_risco_inicial`. O nível deixou de ser entrada; o que se pode dizer de
 * fora é onde o risco cai na escala, e o banco decide o resto.
 */
function mapEscala(severity?: string): number {
  switch (mapCriticidade(severity)) {
    case 'critico': return 5;
    case 'alto': return 4;
    case 'baixo': return 2;
    default: return 3;
  }
}
