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
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // === AUTH: validate JWT and derive empresa_id from caller's profile ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user_id = userData.user.id;
    const { data: profile } = await supabase
      .from('profiles').select('empresa_id').eq('user_id', user_id).maybeSingle();
    const empresa_id = profile?.empresa_id;

    const { nome, descricao, categoria, nivel_risco } = await req.json();

    // Crédito consumido só APÓS resposta bem-sucedida da IA (ver bloco pós-response).


    const prompt = `Você é um especialista em gestão de riscos corporativos. Analise o seguinte risco e forneça sugestões de tratamento:

RISCO: ${nome}
DESCRIÇÃO: ${descricao}
CATEGORIA: ${categoria || 'Não especificada'}
NÍVEL: ${nivel_risco || 'Não especificado'}

Por favor, forneça sugestões de tratamento nos seguintes formatos:

1. MITIGAÇÃO (reduzir probabilidade/impacto):
   - Ações específicas e práticas
   - Controles preventivos
   - Monitoramento contínuo

2. CONTINGENCIAMENTO (plano B se o risco se materializar):
   - Ações de resposta imediata
   - Plano de recuperação
   - Comunicação de crise

Para cada sugestão, inclua:
- Descrição detalhada
- Responsável sugerido (cargo/área)
- Prazo estimado
- Custo aproximado (se aplicável)
- Eficácia esperada

Seja específico e prático, focando em ações implementáveis no contexto empresarial brasileiro.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um especialista em gestão de riscos corporativos com vasta experiência em identificação, análise e tratamento de riscos organizacionais. Suas sugestões devem ser práticas, específicas e implementáveis.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: 'Créditos do gateway de IA esgotados.', creditsExhausted: true }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errorData = await response.text();
      console.error('AI Gateway error:', response.status, errorData);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const suggestion = data.choices[0].message.content;

    // Consumir crédito apenas após sucesso comprovado da IA.
    if (empresa_id && user_id) {
      try {
        await supabase.rpc('consume_ai_credit', {
          p_empresa_id: empresa_id,
          p_user_id: user_id,
          p_funcionalidade: 'suggest_risk_treatment',
          p_descricao: `Sugestão de tratamento para risco: ${nome}`,
        });
      } catch (e) { console.warn('consume_ai_credit falhou (não bloqueante):', e); }
    }


    // Parse the suggestion to extract structured data
    const parseStructuredSuggestion = (text: string) => {
      const mitigacaoMatch = text.match(/1\.\s*MITIGAÇÃO[\s\S]*?(?=2\.\s*CONTINGENCIAMENTO|$)/i);
      const contingenciamentoMatch = text.match(/2\.\s*CONTINGENCIAMENTO[\s\S]*$/i);

      return {
        mitigacao: mitigacaoMatch ? mitigacaoMatch[0].replace(/1\.\s*MITIGAÇÃO/i, '').trim() : '',
        contingenciamento: contingenciamentoMatch ? contingenciamentoMatch[0].replace(/2\.\s*CONTINGENCIAMENTO/i, '').trim() : '',
        sugestao_completa: text
      };
    };

    const structuredSuggestion = parseStructuredSuggestion(suggestion);

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...structuredSuggestion,
        risco_analisado: {
          nome,
          descricao,
          categoria,
          nivel_risco
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in suggest-risk-treatment function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
