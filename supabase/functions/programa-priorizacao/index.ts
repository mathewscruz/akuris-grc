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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user_id = userData.user.id;
    const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('user_id', user_id).maybeSingle();
    const empresa_id = profile?.empresa_id;

    const { framework_nome, itens } = await req.json();
    const lista = Array.isArray(itens) ? itens.slice(0, 100) : [];

    // Consumo de crédito (best-effort — não bloqueia a sugestão)
    if (empresa_id && user_id) {
      try {
        await supabase.rpc('consume_ai_credit', {
          p_empresa_id: empresa_id, p_user_id: user_id,
          p_funcionalidade: 'programa_priorizacao',
          p_descricao: `Priorização IA do programa (${framework_nome || 'framework'})`,
        });
      } catch (_) { /* segue mesmo se o RPC não reconhecer a funcionalidade */ }
    }

    const controlesTxt = lista.map((i: any, idx: number) =>
      `${idx + 1}. ${i.titulo} | categoria: ${i.categoria || '-'} | impacto: ${i.impacto || '-'} | status: ${i.status || '-'}`
    ).join('\n');

    const prompt = `Você é um consultor sênior de GRC ajudando uma empresa a se adequar ao framework "${framework_nome || 'de compliance'}".
Abaixo estão os controles/requisitos que AINDA NÃO estão atendidos (pendentes ou em andamento):

${controlesTxt}

Sugira as 6 a 8 PRIORIDADES imediatas — o que a empresa deve atacar PRIMEIRO — considerando:
- fundamentais que destravam outros (ex.: avaliação de riscos antes de tratar; escopo/SoA antes de controles);
- maior redução de risco / criticidade;
- quick wins (baixo esforço, alto impacto).

Responda SOMENTE com JSON válido, sem texto fora do JSON, no formato:
{"prioridades":[{"titulo":"<controle exatamente como listado>","motivo":"<1 frase objetiva>","urgencia":"alta|media|baixa"}]}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um consultor de GRC. Responde de forma prática e devolve apenas JSON válido quando solicitado.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ success: false, error: 'Créditos do gateway de IA esgotados.', creditsExhausted: true }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const errorData = await response.text();
      console.error('AI Gateway error:', response.status, errorData);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '';
    let prioridades: any[] = [];
    try {
      const jsonStr = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = jsonStr.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : jsonStr);
      prioridades = Array.isArray(parsed?.prioridades) ? parsed.prioridades : [];
    } catch (e) {
      console.error('parse error', e, raw);
    }

    return new Response(JSON.stringify({ success: true, prioridades }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in programa-priorizacao:', error);
    return new Response(JSON.stringify({ success: false, error: (error instanceof Error ? error.message : String(error)) || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
