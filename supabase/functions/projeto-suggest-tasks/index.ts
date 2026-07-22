// Edge Function: projeto-suggest-tasks
// Sugere quebra de tarefas para um objetivo dentro de um projeto.
// Consome 1 crédito via consume_ai_credit. 402 quando esgotado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  projetoId: string;
  objetivo: string;
  contextoExtra?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { projetoId, objetivo, contextoExtra } = (await req.json()) as RequestBody;
    if (!projetoId || !objetivo || objetivo.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Parâmetros: projetoId, objetivo (min 5 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

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

    const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('user_id', userId).maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Confirma que projeto pertence à empresa
    const { data: proj } = await supabase
      .from('projetos').select('id, nome, descricao').eq('id', projetoId).eq('empresa_id', empresaId).maybeSingle();
    if (!proj) {
      return new Response(JSON.stringify({ error: 'Projeto não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Crédito consumido só após sucesso da IA (ver bloco pós-response).


    const prompt = `Você é um gerente de projetos sênior em GRC.
Projeto: ${proj.nome}
${proj.descricao ? `Descrição: ${String(proj.descricao).slice(0, 600)}` : ''}
Objetivo a quebrar: ${objetivo}
${contextoExtra ? `Contexto extra: ${String(contextoExtra).slice(0, 600)}` : ''}

Gere de 4 a 8 tarefas concretas, na ordem de execução, com prioridade adequada.
Sem saudações. Retorne APENAS JSON válido (sem markdown):
{
  "tarefas": [
    {"titulo":"curto e acionável","descricao":"1-2 frases","prioridade":"baixa|media|alta|critica","estimativa_horas":number}
  ]
}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um gerente de projetos sênior. Responda APENAS JSON válido.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: 'Créditos esgotados', creditsExhausted: true }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'Falha na IA', detail: await aiResp.text() }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const aiJson = await aiResp.json();
    try {
      await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId, p_user_id: userId,
        p_funcionalidade: 'projeto_suggest_tasks',
        p_descricao: `Quebra de tarefas IA — ${proj.nome}`,
      });
    } catch (e) { console.warn('consume_ai_credit falhou:', e); }
    let content: string = aiJson?.choices?.[0]?.message?.content ?? '{}';
    content = content.replace(/```json|```/g, '').trim();
    const idx = content.indexOf('{');
    if (idx > 0) content = content.slice(idx);
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { tarefas: [] }; }

    return new Response(JSON.stringify({ tarefas: parsed.tarefas ?? [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro interno', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
