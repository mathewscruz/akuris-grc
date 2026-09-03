import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { temCreditoIA, semCreditoIA } from '../_shared/creditos.ts';
import { MODELOS } from '../_shared/modelos.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Locale = "pt" | "en";

/** Colunas de orientação por idioma. O conteúdo é global (compartilhado por todas as empresas). */
const COLS = {
  pt: {
    orientacao: "orientacao_implementacao",
    evidencias: "exemplos_evidencias",
    perguntas: "perguntas_diagnostico",
  },
  en: {
    orientacao: "orientacao_implementacao_en",
    evidencias: "exemplos_evidencias_en",
    perguntas: "perguntas_diagnostico_en",
  },
} as const;

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
    const requirementId = typeof body.requirement_id === 'string' ? body.requirement_id : null;
    const frameworkId = typeof body.framework_id === 'string' ? body.framework_id : null;
    const rawBatch = Number(body.batch_size);
    const batchSize = Number.isFinite(rawBatch) ? Math.min(Math.max(Math.trunc(rawBatch), 1), 25) : 10;
    const locale: Locale = body.locale === 'en' ? 'en' : 'pt';
    const force = body.force === true;
    const cols = COLS[locale];

    // Regenerar sobrescreve conteúdo GLOBAL (visto por todas as empresas) → só super-admin.
    if (force) {
      const { data: isSuper } = await userClient.rpc('has_super_admin_role');
      if (isSuper !== true) {
        return new Response(JSON.stringify({ error: 'Forbidden: super admin required to regenerate' }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const selectCols = `id, codigo, titulo, descricao, categoria, ${cols.orientacao}, ${cols.evidencias}, ${cols.perguntas}` +
      (locale === 'en' ? `, ${COLS.pt.orientacao}, ${COLS.pt.evidencias}, ${COLS.pt.perguntas}` : '');

    // Single requirement mode
    if (requirementId) {
      const { data: req_data, error: fetchError } = await supabase
        .from("gap_analysis_requirements")
        .select(selectCols)
        .eq("id", requirementId)
        .single();

      if (fetchError || !req_data) {
        return new Response(JSON.stringify({ error: "Requisito não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const row = req_data as Record<string, string | null>;

      // Cache global: conteúdo já existe nesse idioma → devolve sem IA e sem consumir crédito.
      const cachedOrientacao = (row[cols.orientacao] || '').trim();
      if (!force && cachedOrientacao) {
        return new Response(JSON.stringify({
          message: "Guidance served from cache",
          cached: true,
          locale,
          orientacao_implementacao: row[cols.orientacao],
          exemplos_evidencias: row[cols.evidencias],
          perguntas_diagnostico: row[cols.perguntas],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const guidance = await generateGuidance(row as any, lovableKey, locale, basePt(row, locale));
      if (!guidance) {
        // AI falhou — NÃO consumir crédito
        return new Response(JSON.stringify({ error: "Failed to generate guidance" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Só debita o crédito quando a IA entregou conteúdo
      // Sem franquia, nem se chama o modelo: a chamada custa no instante
      // em que sai. Ver `_shared/creditos.ts`.
      if (!(await temCreditoIA(supabase, empresaId))) return semCreditoIA(corsHeaders);

      const { data: creditResult } = await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId,
        p_user_id: userId,
        p_funcionalidade: 'populate-requirement-guidance',
        p_descricao: `Orientação (${locale}) para requisito ${row.codigo || row.titulo}`
      });
      if (creditResult === false) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("gap_analysis_requirements")
        .update({
          [cols.orientacao]: guidance.orientacao_implementacao,
          [cols.evidencias]: guidance.exemplos_evidencias,
          [cols.perguntas]: guidance.perguntas_diagnostico,
        })
        .eq("id", requirementId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        message: "Guidance generated successfully",
        cached: false,
        locale,
        orientacao_implementacao: guidance.orientacao_implementacao,
        exemplos_evidencias: guidance.exemplos_evidencias,
        perguntas_diagnostico: guidance.perguntas_diagnostico,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch mode — só requisitos sem conteúdo no idioma pedido
    let query = supabase
      .from("gap_analysis_requirements")
      .select(selectCols)
      .is(cols.orientacao, null)
      .order("ordem", { ascending: true })
      .limit(batchSize);

    if (frameworkId) {
      query = query.eq("framework_id", frameworkId);
    }

    const { data: requirements, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!requirements || requirements.length === 0) {
      return new Response(JSON.stringify({ message: "All requirements already have guidance", processed: 0, remaining: 0, locale }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    for (const raw of requirements) {
      const r = raw as Record<string, string | null>;
      // Gera primeiro; só cobra se a IA entregar conteúdo válido
      let guidance: GuidanceResult | null = null;
      try {
        guidance = await generateGuidance(r as any, lovableKey, locale, basePt(r, locale));
      } catch (e) {
        console.error(`Error processing ${r.codigo}:`, e);
        continue;
      }
      if (!guidance) continue;

      const { data: batchCredit } = await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId,
        p_user_id: userId,
        p_funcionalidade: 'populate-requirement-guidance-batch',
        p_descricao: `Orientação (${locale}) requisito ${r.codigo || r.titulo}`
      });
      if (batchCredit === false) break;

      try {
        const { error: updateError } = await supabase
          .from("gap_analysis_requirements")
          .update({
            [cols.orientacao]: guidance.orientacao_implementacao,
            [cols.evidencias]: guidance.exemplos_evidencias,
            [cols.perguntas]: guidance.perguntas_diagnostico,
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

    // Quantos ainda faltam nesse idioma (para a UI mostrar progresso do lote)
    let remainingQuery = supabase
      .from("gap_analysis_requirements")
      .select("id", { count: "exact", head: true })
      .is(cols.orientacao, null);
    if (frameworkId) remainingQuery = remainingQuery.eq("framework_id", frameworkId);
    const { count: remaining } = await remainingQuery;

    return new Response(JSON.stringify({
      message: `Processed ${processed} of ${requirements.length} requirements`,
      processed,
      total: requirements.length,
      remaining: remaining ?? 0,
      locale,
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

interface BasePt {
  orientacao: string;
  evidencias: string;
  perguntas: string;
}

/** Quando geramos em inglês e já existe versão PT, ela vira base de tradução. */
function basePt(row: Record<string, string | null>, locale: Locale): BasePt | null {
  if (locale !== 'en') return null;
  const orientacao = (row[COLS.pt.orientacao] || '').trim();
  if (!orientacao) return null;
  return {
    orientacao,
    evidencias: (row[COLS.pt.evidencias] || '').trim(),
    perguntas: (row[COLS.pt.perguntas] || '').trim(),
  };
}

async function generateGuidance(
  req: { codigo: string | null; titulo: string; descricao: string | null; categoria: string | null },
  apiKey: string,
  locale: Locale = 'pt',
  base: BasePt | null = null,
): Promise<GuidanceResult | null> {
  const prompt = locale === 'en'
    ? buildEnglishPrompt(req, base)
    : buildPortuguesePrompt(req);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELOS.PADRAO,
        messages: [{ role: "user", content: prompt }],
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

function buildPortuguesePrompt(
  req: { codigo: string | null; titulo: string; descricao: string | null; categoria: string | null },
): string {
  return `Você é um especialista sênior de GRC. Sua tarefa é transformar a norma em um playbook que uma pessoa sem experiência prévia consiga executar.

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

## Entenda o requisito
Explique em linguagem simples, em no máximo 80 palavras, o resultado que a empresa precisa alcançar.

## Faça nesta ordem
Liste de 3 a 7 passos concretos, sequenciais e executáveis. Diga o que criar, configurar, aprovar ou revisar. Não use conselhos vagos como "adote boas práticas".

## Considere concluído quando
Crie um checklist objetivo de 3 a 6 critérios verificáveis que definem o estado pronto.

## Responsáveis e frequência
Indique os papéis normalmente responsáveis e quando executar ou revisar. Não invente cargos obrigatórios se a norma não os exigir.

## Riscos de não atender
Liste apenas riscos diretamente relacionados ao requisito. Não afirme multas ou sanções específicas sem base no texto fornecido.
===ORIENTACAO_END===

===EVIDENCIAS_START===
Liste de 4 a 7 evidências concretas que demonstram execução, não apenas intenção. Uma por linha, iniciando com "- ". Inclua registros operacionais quando forem relevantes.
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
- Seja conciso: a orientação inteira deve ter no máximo 450 palavras
- Não use saudações, preâmbulos, analogias, emojis ou menções a consultorias
- Não repita perguntas de diagnóstico dentro da orientação
- Português brasileiro
- Comece DIRETAMENTE com o conteúdo, sem saudações`;
}

function buildEnglishPrompt(
  req: { codigo: string | null; titulo: string; descricao: string | null; categoria: string | null },
  base: BasePt | null,
): string {
  const translationBlock = base
    ? `

**Existing Brazilian Portuguese version (use it as the factual source, but rewrite it into the concise structure requested below; do NOT invent new content):**

--- ORIENTATION (PT) ---
${base.orientacao}
--- EVIDENCE (PT) ---
${base.evidencias || "(empty — create 6 to 10 items)"}
--- DIAGNOSTIC QUESTIONS (PT, JSON) ---
${base.perguntas || "(empty — create exactly 5 questions)"}
`
    : '';

  return `You are a senior GRC specialist. Turn the standard into an implementation playbook that someone with no prior experience can execute.

For the requirement below, produce THREE outputs clearly separated by the delimiters.

**Requirement:**
- Code: ${req.codigo || "N/A"}
- Title: ${req.titulo}
- Description: ${req.descricao || "No additional description"}
- Category: ${req.categoria || "General"}${translationBlock}

---

Follow EXACTLY this format with the delimiters below:

===ORIENTACAO_START===
Markdown content with these sections:

## Understand the requirement
Explain in plain language, in no more than 80 words, the outcome the company must achieve.

## Do this in order
List 3 to 7 concrete, sequential, executable steps. Say what to create, configure, approve, or review. Do not use vague advice such as "follow best practices".

## Consider it complete when
Create an objective checklist of 3 to 6 verifiable completion criteria.

## Owners and frequency
Name the roles normally responsible and when to perform or review the activity. Do not invent mandatory job titles when the standard does not require them.

## Risks of not complying
List only risks directly related to the requirement. Do not claim specific fines or sanctions unless supported by the supplied text.
===ORIENTACAO_END===

===EVIDENCIAS_START===
List 4 to 7 concrete pieces of evidence that demonstrate execution, not only intent. One per line, starting with "- ". Include operational records where relevant.
===EVIDENCIAS_END===

===DIAGNOSTICO_START===
Produce exactly 5 quick diagnostic questions answerable with "Yes", "Partial" or "No".
Return ONLY a JSON array:
[
  {"pergunta": "question text", "peso": 1},
  ...
]
Weights: 1 (normal), 2 (high), 3 (critical). Exactly 5 items.
===DIAGNOSTICO_END===

**Rules:**
- Plain business English, no unnecessary jargon
- Content specific to this requirement, NOT generic
- Be concise: the entire guidance must not exceed 450 words
- Do not use greetings, preambles, analogies, emojis, or references to consultants
- Do not repeat the diagnostic questions inside the guidance
- Keep the JSON key names exactly as shown ("pergunta", "peso"), only the values in English
- Start DIRECTLY with the content, no greetings`;
}
