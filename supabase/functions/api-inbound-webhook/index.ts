import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token parameter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lookup webhook config
    const { data: webhook, error: whError } = await supabase
      .from('api_inbound_webhooks')
      .select('*')
      .eq('webhook_token', token)
      .eq('ativo', true)
      .single();

    if (whError || !webhook) {
      return new Response(JSON.stringify({ error: 'Invalid or inactive webhook token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Ler body como texto para validação de assinatura antes de parsear JSON
    const rawBody = await req.text();

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

    // Route to appropriate module
    let insertError = null;
    const empresaId = webhook.empresa_id;

    switch (webhook.modulo_destino) {
      case 'incidentes': {
        const { error } = await supabase.from('incidentes').insert({
          empresa_id: empresaId,
          titulo: body.title || body.titulo || body.alert_name || `Alerta via ${webhook.nome}`,
          descricao: body.description || body.descricao || body.message || JSON.stringify(body),
          tipo: body.type || body.tipo || 'seguranca',
          criticidade: mapCriticidade(body.severity || body.criticidade || body.priority),
          status: 'aberto',
          origem: `webhook:${webhook.nome}`,
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
          nome: body.title || body.nome || body.risk_name || `Risco via ${webhook.nome}`,
          descricao: body.description || body.descricao || JSON.stringify(body),
          probabilidade_inicial: Number(body.probability ?? body.probabilidade) || posicao,
          impacto_inicial: Number(body.impact ?? body.impacto) || posicao,
          status: 'identificado',
        });
        insertError = error;
        break;
      }
      case 'ativos': {
        const { error } = await supabase.from('ativos').insert({
          empresa_id: empresaId,
          nome: body.name || body.nome || body.hostname || `Ativo via ${webhook.nome}`,
          tipo: body.type || body.tipo || 'Servidor',
          descricao: body.description || body.descricao || JSON.stringify(body),
          status: 'ativo',
        });
        insertError = error;
        break;
      }
      case 'controles': {
        const { error } = await supabase.from('controles').insert({
          empresa_id: empresaId,
          nome: body.title || body.nome || body.control_name || `Controle via ${webhook.nome}`,
          descricao: body.description || body.descricao || JSON.stringify(body),
          tipo: body.type || body.tipo || 'preventivo',
          status: body.status || 'ativo',
          criticidade: mapCriticidade(body.severity || body.criticidade || body.priority),
          frequencia_teste: body.frequency || body.frequencia || 'mensal',
        });
        insertError = error;
        break;
      }
      case 'denuncias': {
        const { error } = await supabase.from('denuncias').insert({
          empresa_id: empresaId,
          titulo: body.title || body.titulo || `Denúncia via ${webhook.nome}`,
          descricao: body.description || body.descricao || body.message || JSON.stringify(body),
          gravidade: mapCriticidade(body.severity || body.gravidade || body.priority),
          status: 'nova',
          anonima: body.anonymous !== undefined ? body.anonymous : true,
          origem: body.source || body.origem || `webhook:${webhook.nome}`,
          protocolo: `DEN${Date.now().toString().slice(-10)}`,
        });
        insertError = error;
        break;
      }
      default: {
        console.log(`Unsupported module: ${webhook.modulo_destino}, logging event only`);
      }
    }

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to process event' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update webhook stats
    await supabase.from('api_inbound_webhooks').update({
      ultimo_recebimento: new Date().toISOString(),
      total_recebidos: (webhook.total_recebidos || 0) + 1,
    }).eq('id', webhook.id);

    // Log the request
    await supabase.from('api_request_logs').insert({
      empresa_id: empresaId,
      metodo: req.method,
      endpoint: `/api-inbound-webhook/${webhook.tipo_evento}`,
      status_code: 200,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      request_body: body,
    });

    return new Response(JSON.stringify({ success: true, message: 'Event processed' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) || 'Internal error' }), {
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
