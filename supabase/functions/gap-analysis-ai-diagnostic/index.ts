// Edge Function: gap-analysis-ai-diagnostic
// Diagnóstico editorial rápido de um requisito específico.
// Recebe contexto da empresa + dados do requisito, retorna veredito IA com
// pontos avaliados, gaps e justificativa pronta para colar.
// Consome 1 crédito via consume_ai_credit. 402 quando esgotado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  requirementId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { requirementId } = body || ({} as RequestBody);

    if (!requirementId) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro obrigatório: requirementId' }),
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

    // === AUTH ===
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

    // Consome crédito
    const { data: creditOk, error: creditErr } = await supabase.rpc('consume_ai_credit', {
      p_empresa_id: empresaId,
      p_user_id: userId,
      p_funcionalidade: 'gap_analysis_ai_diagnostic',
      p_descricao: `Diagnóstico IA do requisito ${requirementId}`,
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
      .select('id, codigo, titulo, descricao, categoria, orientacao_implementacao, exemplos_evidencias, framework_id')
      .eq('id', requirementId)
      .single();
    if (reqErr || !req_) {
      return new Response(
        JSON.stringify({ error: 'Requisito não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Busca contexto da empresa (organization_context) — opcional
    let orgContext = '';
    try {
      const { data: ctx } = await supabase
        .from('organization_context')
        .select('descricao_negocio, setor, porte, escopo_compliance')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (ctx) {
        orgContext = [
          ctx.setor ? `Setor: ${ctx.setor}` : '',
          ctx.porte ? `Porte: ${ctx.porte}` : '',
          ctx.escopo_compliance ? `Escopo: ${ctx.escopo_compliance}` : '',
          ctx.descricao_negocio ? `Negócio: ${String(ctx.descricao_negocio).slice(0, 600)}` : '',
        ].filter(Boolean).join('\n');
      }
    } catch (_) { /* contexto é opcional */ }

    // Avaliação atual (se houver)
    const { data: currentEval } = await supabase
      .from('gap_analysis_evaluations')
      .select('conformity_status, observacoes, plano_acao')
      .eq('requirement_id', requirementId)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    const prompt = `Você é um auditor sênior de compliance. Gere um diagnóstico editorial estruturado para o requisito abaixo, considerando o contexto da empresa.

REQUISITO:
- Código: ${req_.codigo}
- Título: ${req_.titulo}
${req_.categoria ? `- Categoria: ${req_.categoria}` : ''}
${req_.descricao ? `- Descrição: ${String(req_.descricao).slice(0, 1500)}` : ''}
${req_.orientacao_implementacao ? `- O que a norma exige: ${String(req_.orientacao_implementacao).slice(0, 2000)}` : ''}
${req_.exemplos_evidencias ? `- Evidências esperadas: ${String(req_.exemplos_evidencias).slice(0, 800)}` : ''}

${orgContext ? `CONTEXTO DA EMPRESA:\n${orgContext}\n` : ''}

${currentEval?.conformity_status ? `STATUS ATUAL DA EMPRESA: ${currentEval.conformity_status}` : 'STATUS ATUAL: não avaliado'}
${currentEval?.observacoes ? `OBSERVAÇÕES ATUAIS: ${String(currentEval.observacoes).slice(0, 500)}` : ''}

Sem saudações ou introduções. Retorne APENAS JSON válido (sem markdown), neste formato:
{
  "suggested_status": "conforme" | "parcial" | "nao_conforme" | "nao_aplicavel",
  "confidence": 0-100,
  "summary": "diagnóstico em 2-3 frases editoriais, sem clichês",
  "evaluated_points": [
    {"label": "ponto avaliado curto", "status": "ok" | "partial" | "missing"}
  ],
  "gaps": ["o que ainda precisa ser feito, items curtos"],
  "justification": "texto pronto para colar no campo de justificativa do avaliador (máx 600 chars, factual, sem saudação)"
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
          { role: 'system', content: 'Você é um auditor de compliance sênior. Responda APENAS com JSON válido, sem saudações.' },
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
          JSON.stringify({ error: 'Muitas requisições, aguarde alguns segundos.' }),
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
    const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();
    let parsed: any = null;
    try { parsed = JSON.parse(cleaned); }
    catch (_) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (_) { /* noop */ } }
    }

    if (!parsed || typeof parsed !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Resposta da IA inválida', raw: raw.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        suggested_status: parsed.suggested_status || 'nao_avaliado',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        summary: parsed.summary || '',
        evaluated_points: Array.isArray(parsed.evaluated_points) ? parsed.evaluated_points : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
        justification: parsed.justification || '',
        analyzed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('gap-analysis-ai-diagnostic error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
