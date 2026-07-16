// Edge Function: analyze-evidence-against-requirement
// Recebe um arquivo de evidência (URL pública do storage) e um requisito,
// chama a Lovable AI para emitir um veredito de aderência.
// Consome 1 crédito de IA via consume_ai_credit. Retorna 402 quando esgotado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  requirementId: string;
  fileUrl: string;
  fileName?: string;
  empresaId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { requirementId, fileUrl, fileName } = body || ({} as RequestBody);

    if (!requirementId || !fileUrl) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: requirementId, fileUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // === AUTH: validate JWT and derive empresa_id from caller's profile ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;
    const { data: profile } = await supabase
      .from('profiles').select('empresa_id').eq('user_id', userId).maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: 'User profile missing empresa_id' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Consome crédito de IA
    const { data: creditOk, error: creditErr } = await supabase.rpc('consume_ai_credit', {
      p_empresa_id: empresaId,
      p_user_id: userId,
      p_funcionalidade: 'analyze_evidence_against_requirement',
      p_descricao: `Validação IA de evidência para requisito ${requirementId}`,
    });
    if (creditErr || creditOk === false) {
      return new Response(
        JSON.stringify({ error: 'Créditos de IA esgotados.', creditsExhausted: true }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Busca o requisito
    const { data: req_, error: reqErr } = await supabase
      .from('gap_analysis_requirements')
      .select('id, codigo, titulo, descricao, orientacao_implementacao, exemplos_evidencias, framework_id')
      .eq('id', requirementId)
      .single();
    if (reqErr || !req_) {
      return new Response(
        JSON.stringify({ error: 'Requisito não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // === SSRF guard: só aceita URLs do próprio Supabase Storage do projeto ===
    // Rejeita fileUrl arbitrária (loopback, metadata IMDS, hosts externos, etc.).
    let documentText = '';
    let allowedFetch = false;
    try {
      const target = new URL(fileUrl);
      const allowedHost = new URL(supabaseUrl).host;
      // Aceita apenas o host do projeto Supabase, HTTPS, e caminho de Storage.
      if (
        target.protocol === 'https:' &&
        target.host === allowedHost &&
        target.pathname.startsWith('/storage/v1/')
      ) {
        allowedFetch = true;
      } else {
        console.warn('SSRF guard: fileUrl rejeitada', { host: target.host, path: target.pathname });
      }
    } catch (_) {
      // URL inválida — mantém allowedFetch=false
    }

    if (allowedFetch) {
      try {
        const fileResp = await fetch(fileUrl);
        const ct = fileResp.headers.get('content-type') || '';
        if (ct.includes('text/') || (fileName || '').toLowerCase().endsWith('.txt')) {
          documentText = (await fileResp.text()).slice(0, 20000);
        } else {
          documentText = `[CONTEÚDO BINÁRIO - tipo ${ct || 'desconhecido'} - apenas metadados disponíveis: nome=${fileName || 'arquivo'}]`;
        }
      } catch (e) {
        documentText = '[Não foi possível baixar o arquivo para análise textual.]';
      }
    } else {
      documentText = `[URL de evidência recusada por política de segurança - apenas Storage do projeto é permitido. Nome=${fileName || 'arquivo'}]`;
    }

    const prompt = `Você é um auditor sênior de conformidade. Analise se a evidência fornecida atende ao requisito abaixo.

REQUISITO:
- Código: ${req_.codigo}
- Título: ${req_.titulo}
${req_.descricao ? `- Descrição: ${req_.descricao}` : ''}
${req_.orientacao_implementacao ? `- O que a norma exige: ${String(req_.orientacao_implementacao).slice(0, 1500)}` : ''}
${req_.exemplos_evidencias ? `- Evidências esperadas: ${String(req_.exemplos_evidencias).slice(0, 800)}` : ''}

EVIDÊNCIA APRESENTADA${fileName ? ` (arquivo: ${fileName})` : ''}:
---
${documentText}
---

Retorne APENAS JSON válido (sem markdown), neste formato:
{
  "verdict": "conforme" | "parcial" | "nao_conforme" | "indeterminado",
  "score": 0-100,
  "justification": "explique em até 400 caracteres por que a evidência atende, atende parcialmente ou não atende, citando trechos quando possível",
  "missing": ["pontos específicos que ainda faltam para conformidade total, se houver"],
  "next_steps": ["ações sugeridas, se aplicável"]
}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um auditor de conformidade rigoroso. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados.', creditsExhausted: true }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Muitas requisições, aguarde alguns segundos e tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const t = await aiResp.text();
      return new Response(
        JSON.stringify({ error: 'Erro no gateway de IA', detail: t.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiData = await aiResp.json();
    const raw: string = aiData?.choices?.[0]?.message?.content ?? '';

    // Extrai bloco JSON, removendo cercas de código se vierem
    const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      // tenta achar o primeiro { ... } válido
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (_) { /* noop */ }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Resposta da IA inválida', raw: raw.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        verdict: parsed.verdict || 'indeterminado',
        score: typeof parsed.score === 'number' ? parsed.score : 0,
        justification: parsed.justification || '',
        missing: Array.isArray(parsed.missing) ? parsed.missing : [],
        next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
        analyzed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('analyze-evidence-against-requirement error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
