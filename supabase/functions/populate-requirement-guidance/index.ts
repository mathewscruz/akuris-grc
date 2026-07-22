import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user (mandatory)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: claimsError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (claimsError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId: string = userData.user.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('user_id', userId)
      .single();
    const empresaId: string | null = profile?.empresa_id || null;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden: empresa not found' }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requirementId = body.requirement_id;
    const frameworkId = body.framework_id;
    const batchSize = body.batch_size || 10;

    // Single requirement mode
    if (requirementId) {
      const { data: req_data, error: fetchError } = await supabase
        .from("gap_analysis_requirements")
        .select("id, codigo, titulo, descricao, categoria")
        .eq("id", requirementId)
        .single();

      if (fetchError || !req_data) {
        return new Response(JSON.stringify({ error: "Requisito não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const guidance = await generateGuidance(req_data, lovableKey);
      if (!guidance) {
        // AI falhou — NÃO consumir crédito
        return new Response(JSON.stringify({ error: "Failed to generate guidance" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Só debita o crédito quando a IA entregou conteúdo
      const { data: creditResult } = await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId,
        p_user_id: userId,
        p_funcionalidade: 'populate-requirement-guidance',
        p_descricao: `Orientação para requisito ${req_data.codigo || req_data.titulo}`
      });
      if (creditResult === false) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("gap_analysis_requirements")
        .update({
          orientacao_implementacao: guidance.orientacao_implementacao,
          exemplos_evidencias: guidance.exemplos_evidencias,
          perguntas_diagnostico: guidance.perguntas_diagnostico,
        })
        .eq("id", requirementId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        message: "Guidance generated successfully",
        orientacao_implementacao: guidance.orientacao_implementacao,
        exemplos_evidencias: guidance.exemplos_evidencias,
        perguntas_diagnostico: guidance.perguntas_diagnostico,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch mode
    let query = supabase
      .from("gap_analysis_requirements")
      .select("id, codigo, titulo, descricao, categoria")
      .is("orientacao_implementacao", null)
      .order("ordem", { ascending: true })
      .limit(batchSize);

    if (frameworkId) {
      query = query.eq("framework_id", frameworkId);
    }

    const { data: requirements, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!requirements || requirements.length === 0) {
      return new Response(JSON.stringify({ message: "All requirements already have guidance", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    for (const r of requirements) {
      // Gera primeiro; só cobra se a IA entregar conteúdo válido
      let guidance: GuidanceResult | null = null;
      try {
        guidance = await generateGuidance(r, lovableKey);
      } catch (e) {
        console.error(`Error processing ${r.codigo}:`, e);
        continue;
      }
      if (!guidance) continue;

      const { data: batchCredit } = await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId,
        p_user_id: userId,
        p_funcionalidade: 'populate-requirement-guidance-batch',
        p_descricao: `Orientação requisito ${r.codigo || r.titulo}`
      });
      if (batchCredit === false) break;

      try {
        // guidance já foi gerado antes de debitar o crédito
        const { error: updateError } = await supabase
          .from("gap_analysis_requirements")
          .update({
            orientacao_implementacao: guidance.orientacao_implementacao,
            exemplos_evidencias: guidance.exemplos_evidencias,
            perguntas_diagnostico: guidance.perguntas_diagnostico,
          })
          .eq("id", r.id);

        if (updateError) {
          console.error(`Update error for ${r.codigo}:`, updateError);
          continue;
        }
        processed++;
      } catch (e) {
        console.error(`Error processing ${r.codigo}:`, e);
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${processed} of ${requirements.length} requirements`,
      processed,
      total: requirements.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface GuidanceResult {
  orientacao_implementacao: string;
  exemplos_evidencias: string;
  perguntas_diagnostico: string | null;
}

async function generateGuidance(
  req: { codigo: string | null; titulo: string; descricao: string | null; categoria: string | null },
  apiKey: string
): Promise<GuidanceResult | null> {
  // Consolidated prompt: generates all 3 outputs in a single AI call (was 3 parallel calls)
  const consolidatedPrompt = `Você é um consultor sênior de GRC (Governança, Riscos e Compliance) com 20 anos de experiência em Big4.

Para o requisito abaixo, gere TRÊS saídas separadas claramente por delimitadores.

**Requisito:**
- Código: ${req.codigo || "N/A"}
- Título: ${req.titulo}
- Descrição: ${req.descricao || "Sem descrição adicional"}
- Categoria: ${req.categoria || "Geral"}

---

Gere o conteúdo seguindo EXATAMENTE este formato com os delimitadores indicados:

===ORIENTACAO_START===
Gere o conteúdo em Markdown com estas seções:

## 📋 O que este requisito significa
Explique em linguagem simples. 2-3 parágrafos curtos.

## 🎯 Por que isso importa para sua empresa
Consequências reais: multas, perda de clientes, danos à reputação. 2-3 parágrafos.

## ⚠️ O que acontece se você não faz isso
Riscos concretos de não conformidade. Use bullets.

## 🔍 Fatores que você deve analisar
5-8 perguntas de autoavaliação em lista numerada.

## 💡 Dicas práticas de implementação
4-6 passos concretos e simples.
===ORIENTACAO_END===

===EVIDENCIAS_START===
Liste 6 a 10 exemplos de evidências que um auditor aceitaria. Uma por linha, iniciando com "- ". Seja específico.
===EVIDENCIAS_END===

===DIAGNOSTICO_START===
Gere exatamente 5 perguntas de diagnóstico rápido respondíveis com "Sim", "Parcial" ou "Não".
Retorne APENAS um JSON array:
[
  {"pergunta": "texto da pergunta", "peso": 1},
  ...
]
Pesos: 1 (normal), 2 (alta), 3 (crítica). Exatamente 5 itens.
===DIAGNOSTICO_END===

**Regras:**
- Linguagem simples, sem jargão desnecessário
- Conteúdo específico para o requisito, NÃO genérico
- Português brasileiro
- Comece DIRETAMENTE com o conteúdo, sem saudações`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: consolidatedPrompt }],
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.error(`AI gateway error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const fullContent = data.choices?.[0]?.message?.content || "";

    if (!fullContent) return null;

    // Parse the three sections from the consolidated response
    const orientacaoMatch = fullContent.match(/===ORIENTACAO_START===([\s\S]*?)===ORIENTACAO_END===/);
    const evidenciasMatch = fullContent.match(/===EVIDENCIAS_START===([\s\S]*?)===EVIDENCIAS_END===/);
    const diagnosticoMatch = fullContent.match(/===DIAGNOSTICO_START===([\s\S]*?)===DIAGNOSTICO_END===/);

    const orientacao = orientacaoMatch?.[1]?.trim() || fullContent;
    const evidencias = evidenciasMatch?.[1]?.trim() || "";

    // Parse diagnostic questions
    let perguntasJson: string | null = null;
    if (diagnosticoMatch) {
      const rawDiagnostico = diagnosticoMatch[1].trim();
      const jsonMatch = rawDiagnostico.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[0]); // validate
          perguntasJson = jsonMatch[0];
        } catch {
          console.error("Failed to parse diagnostic questions JSON");
        }
      }
    }

    return {
      orientacao_implementacao: orientacao,
      exemplos_evidencias: evidencias,
      perguntas_diagnostico: perguntasJson,
    };
  } catch (e) {
    console.error(`AI call error for ${req.codigo}:`, e);
    return null;
  }
}
