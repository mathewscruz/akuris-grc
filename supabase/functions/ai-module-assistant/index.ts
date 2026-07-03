import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user (mandatory)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId: string = userData.user.id;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('empresa_id')
      .eq('user_id', userId)
      .single();
    const empresaId: string | null = profile?.empresa_id || null;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden: empresa not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Consumo de crédito ocorre APÓS o gateway aceitar a requisição (abaixo).


    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case 'classify-risk':
        systemPrompt = "Você é um especialista em gestão de riscos corporativos. Responda APENAS com JSON válido, sem markdown.";
        userPrompt = `Analise o risco abaixo e sugira classificação automática:
Nome: ${data.nome}
Descrição: ${data.descricao || 'Não informada'}

Retorne JSON: {"categoria":"string","probabilidade":"Muito Baixa|Baixa|Média|Alta|Muito Alta","impacto":"Muito Baixo|Baixo|Médio|Alto|Muito Alto","nivel_risco":"Muito Baixo|Baixo|Médio|Alto|Muito Alto|Crítico","justificativa":"string com 2-3 frases"}`;
        break;

      case 'triage-denuncia':
        systemPrompt = "Você é um especialista em compliance e canal de denúncias. Responda APENAS com JSON válido, sem markdown.";
        userPrompt = `Classifique a seguinte denúncia:
Título: ${data.titulo}
Descrição: ${data.descricao || ''}
Tipo: ${data.tipo || 'Não informado'}

Retorne JSON: {"gravidade":"baixa|media|alta|critica","categoria_sugerida":"string","urgencia":"baixa|media|alta","recomendacao":"string com próximos passos em 2-3 frases","riscos_associados":"string"}`;
        break;

      case 'suggest-controls':
        systemPrompt = "Você é um especialista em controles internos e frameworks de segurança (ISO 27001, NIST, CIS). Responda APENAS com JSON válido, sem markdown.";
        userPrompt = `Com base nos frameworks e controles ativos, sugira controles faltantes:
Frameworks ativos: ${data.frameworks?.join(', ') || 'Nenhum'}
Controles existentes: ${data.controles_existentes?.join(', ') || 'Nenhum'}
Área de foco: ${data.area || 'Geral'}

Retorne JSON: {"sugestoes":[{"nome":"string","descricao":"string","framework":"string","prioridade":"alta|media|baixa","justificativa":"string"}],"analise_gaps":"string resumo de 2-3 frases"}`;
        break;

      case 'summarize-incident':
        systemPrompt = "Você é um especialista em resposta a incidentes de segurança. Responda APENAS com JSON válido, sem markdown.";
        userPrompt = `Gere resumo executivo e timeline do incidente:
Título: ${data.titulo}
Descrição: ${data.descricao || ''}
Tipo: ${data.tipo || ''}
Criticidade: ${data.criticidade || ''}
Status: ${data.status || ''}
Data ocorrência: ${data.data_ocorrencia || ''}

Retorne JSON: {"resumo_executivo":"string com 3-4 frases","impacto_estimado":"string","acoes_recomendadas":["string"],"classificacao_sugerida":"string","comunicacao_necessaria":"boolean","stakeholders":["string"]}`;
        break;

      case 'explain-requirement':
        systemPrompt = "Você é um auditor sênior certificado (ISO 27001 Lead Auditor, CISA, CRISC) com 15 anos de experiência em Big4. Você guia empresas na jornada de certificação. Responda APENAS com JSON válido, sem markdown.";
        userPrompt = `Explique o seguinte requisito de framework de conformidade para um usuário que nunca trabalhou com auditoria:

Framework: ${data.framework_nome || 'Não informado'}
Código do Requisito: ${data.codigo || ''}
Título: ${data.titulo || ''}
Descrição oficial: ${data.descricao || 'Não disponível'}
Categoria: ${data.categoria || ''}
Status atual do usuário: ${data.status_atual || 'Não avaliado'}

Retorne JSON: {
  "explicacao_simples": "string com 3-4 frases explicando o que este requisito exige em linguagem acessível",
  "exemplos_evidencias": ["string com exemplo concreto de evidência aceita por auditores"],
  "perguntas_autoavaliacao": ["string com pergunta que o usuário deve fazer internamente para determinar se atende"],
  "status_sugerido": "conforme|parcial|nao_conforme",
  "justificativa_sugestao": "string com 2 frases explicando por que sugere este status",
  "dicas_implementacao": ["string com dica prática para implementar"],
  "nivel_esforco": "baixo|medio|alto"
}`;
        break;

      case 'framework-recommendations':
        systemPrompt = "Você é um consultor estratégico de GRC (Governança, Risco e Compliance) especialista em priorização de conformidade. Responda APENAS com JSON válido, sem markdown.";
        userPrompt = `Analise o progresso atual de conformidade e recomende próximos passos prioritários:

Framework: ${data.framework_nome || ''}
Score atual: ${data.score_atual || 0}%
Total de requisitos: ${data.total_requisitos || 0}
Avaliados: ${data.avaliados || 0}
Conformes: ${data.conformes || 0}
Parciais: ${data.parciais || 0}
Não conformes: ${data.nao_conformes || 0}

Requisitos não conformes com maior peso:
${(data.requisitos_criticos || []).map((r: any) => `- ${r.codigo}: ${r.titulo} (peso ${r.peso})`).join('\n')}

Requisitos parciais (quick wins potenciais):
${(data.requisitos_parciais || []).map((r: any) => `- ${r.codigo}: ${r.titulo} (peso ${r.peso})`).join('\n')}

Retorne JSON: {
  "analise_situacional": "string com 3-4 frases sobre a situação atual",
  "score_estimado_apos_acoes": number (estimativa de score se top 5 forem resolvidos),
  "top_5_prioridades": [{"codigo":"string","titulo":"string","justificativa":"string","esforco":"baixo|medio|alto"}],
  "quick_wins": [{"codigo":"string","titulo":"string","acao_sugerida":"string"}],
  "proximo_marco": "string com meta sugerida (ex: 'Alcançar 60% em 30 dias')",
  "recomendacao_geral": "string com orientação estratégica"
}`;
        break;

      case 'analyze-contract':
        systemPrompt = "Você é um advogado especialista em contratos corporativos e compliance. Responda APENAS com JSON válido, sem markdown.";
        userPrompt = `Analise as cláusulas críticas deste contrato:
Tipo: ${data.tipo || ''}
Fornecedor: ${data.fornecedor || ''}
Valor: ${data.valor || ''}
Vigência: ${data.vigencia || ''}
Descrição: ${data.descricao || ''}
Cláusulas: ${data.clausulas || ''}

Retorne JSON: {"alertas":[{"tipo":"sla|penalidade|renovacao|confidencialidade|lgpd","descricao":"string","severidade":"alta|media|baixa"}],"recomendacoes":["string"],"score_risco":"1-10","resumo":"string 2-3 frases"}`;
        break;

      case 'pricing_analysis':
        systemPrompt = "Você é um consultor financeiro SaaS especialista em precificação de produtos B2B com IA. Responda APENAS com JSON válido, sem markdown. Responda em português do Brasil.";
        userPrompt = `Analise a rentabilidade do meu produto SaaS de GRC (Governança, Risco e Compliance) que utiliza IA:

DADOS FINANCEIROS DO MÊS:
- Receita total: R$ ${data.receita_total?.toFixed(2) || '0'}
- Custo total IA estimado: R$ ${data.custo_total?.toFixed(2) || '0'}
- Margem bruta: R$ ${data.margem_bruta?.toFixed(2) || '0'} (${data.margem_percent?.toFixed(1) || '0'}%)
- Total de requisições IA: ${data.total_requisicoes || 0}
- Custo por requisição: R$ ${data.custo_por_req || '0.15'}

PLANOS DISPONÍVEIS:
${(data.planos || []).map((p: any) => `- ${p.nome}: R$ ${p.preco}/mês`).join('\n')}

DISTRIBUIÇÃO POR PLANO:
${(data.empresas_por_plano || []).map((e: any) => `- ${e.plano}: ${e.qtd} empresas`).join('\n')}

EMPRESAS EM DÉFICIT (custo > receita):
${(data.empresas_deficitarias || []).map((e: any) => `- ${e.nome} (${e.plano}): ${e.reqs} reqs, margem R$ ${e.margem?.toFixed(2)}`).join('\n') || 'Nenhuma'}

TOP FUNCIONALIDADES MAIS USADAS:
${(data.top_funcionalidades || []).map((f: any) => `- ${f.nome}: ${f.reqs} requisições`).join('\n')}

Retorne JSON: {
  "resumo": "string com 2-3 frases sobre a situação financeira geral",
  "diagnostico": "string com análise se os preços estão adequados, abaixo ou acima do mercado SaaS B2B",
  "recomendacoes": ["string com recomendação específica e acionável"],
  "alerta_empresas": "string sobre empresas deficitárias e o que fazer",
  "conclusao": "string com veredicto final: manter preços, aumentar, ou reestruturar franquias"
}`;
        break;

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    // Debita crédito apenas após gateway ter aceitado.
    await supabaseAdmin.rpc('consume_ai_credit', {
      p_empresa_id: empresaId,
      p_user_id: userId,
      p_funcionalidade: `ai-assistant:${action}`,
      p_descricao: `Assistente IA - ${action}`,
    });

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response, handling markdown code blocks
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { raw: content };
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('ai-module-assistant error:', error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
