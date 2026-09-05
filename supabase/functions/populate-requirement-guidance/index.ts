import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODELOS } from '../_shared/modelos.ts';
import { getOrCreateGuidance, GuidanceError, type GuidanceResult } from './guidance-service.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type Locale = "pt" | "en";
const COLS = {
  pt: { orientacao: "orientacao_implementacao", evidencias: "exemplos_evidencias", perguntas: "perguntas_diagnostico" },
  en: { orientacao: "orientacao_implementacao_en", evidencias: "exemplos_evidencias_en", perguntas: "perguntas_diagnostico_en" },
} as const;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", ...(status === 202 ? { "Retry-After": "10" } : {}) },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function fingerprint(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: claimsError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (claimsError || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('empresa_id').eq('user_id', userId).eq('ativo', true).single();
    if (profileError || !profile?.empresa_id) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400);
    const requirementId = typeof body.requirement_id === 'string' ? body.requirement_id : null;
    const frameworkId = typeof body.framework_id === 'string' ? body.framework_id : null;
    if ((requirementId && !uuid.test(requirementId)) || (frameworkId && !uuid.test(frameworkId))) return json({ error: 'invalid_id' }, 400);
    const rawBatch = Number(body.batch_size);
    const batchSize = Number.isFinite(rawBatch) ? Math.min(Math.max(Math.trunc(rawBatch), 1), 25) : 10;
    const locale: Locale = body.locale === 'en' ? 'en' : 'pt';
    const force = body.force === true;
    const cols = COLS[locale];

    // Shared catalogue: only the platform administrator can overwrite or
    // warm a whole framework. A customer can request missing individual guidance.
    if (force || !requirementId) {
      const { data: isSuper, error: roleError } = await userClient.rpc('has_super_admin_role');
      if (roleError || isSuper !== true) return json({ error: 'Forbidden: super admin required' }, 403);
    }
    const selectCols = `id, codigo, titulo, descricao, categoria, ${cols.orientacao}, ${cols.evidencias}, ${cols.perguntas}` +
      (locale === 'en' ? `, ${COLS.pt.orientacao}, ${COLS.pt.evidencias}, ${COLS.pt.perguntas}` : '');
    const cached = (row: Record<string, string | null>): GuidanceResult | null => {
      if (!row[cols.orientacao]?.trim()) return null;
      return { orientacao_implementacao: row[cols.orientacao]!, exemplos_evidencias: row[cols.evidencias] || '', perguntas_diagnostico: row[cols.perguntas] || null };
    };
    async function readRow(id: string) {
      const { data, error } = await supabase.from('gap_analysis_requirements').select(selectCols).eq('id', id).single();
      if (error || !data) throw new GuidanceError('requirement_unavailable', 404);
      return data as unknown as Record<string, string | null>;
    }
    async function generateAndSave(row: Record<string, string | null>) {
      return getOrCreateGuidance({
        cached: cached(row), force,
        readCached: async () => cached(await readRow(row.id!)),
        claim: async () => {
          // Cache reads work even while the AI provider is unavailable.
          if (!Deno.env.get('LOVABLE_API_KEY')) throw new GuidanceError('guidance_temporarily_unavailable');
          const { data: allowed, error } = await supabase.rpc('consume_security_rate_limit', {
            p_scope: 'requirement-guidance:content',
            p_fingerprint_hash: await fingerprint(`${row.id}:${locale}`),
            p_max_requests: 1, p_window_seconds: 120,
          });
          if (error) throw new GuidanceError('guidance_temporarily_unavailable');
          if (allowed !== true) return false;
          const { data: userAllowed, error: userLimitError } = await supabase.rpc('consume_security_rate_limit', {
            p_scope: 'requirement-guidance:user',
            p_fingerprint_hash: await fingerprint(userId),
            p_max_requests: 60, p_window_seconds: 60,
          });
          if (userLimitError) throw new GuidanceError('guidance_temporarily_unavailable');
          if (userAllowed !== true) throw new GuidanceError('guidance_rate_limited', 429);
          return true;
        },
        generate: () => generateGuidance(row as any, Deno.env.get('LOVABLE_API_KEY')!, locale, basePt(row, locale)),
        save: async (guidance) => {
          const { data, error } = await supabase.from('gap_analysis_requirements').update({
            [cols.orientacao]: guidance.orientacao_implementacao,
            [cols.evidencias]: guidance.exemplos_evidencias,
            [cols.perguntas]: guidance.perguntas_diagnostico,
          }).eq('id', row.id!).select(selectCols).single();
          if (error || !data) throw new GuidanceError('guidance_save_failed');
          return cached(data as unknown as Record<string, string | null>)!;
        },
      });
    }

    if (requirementId) {
      const result = await generateAndSave(await readRow(requirementId));
      return json({ ...result, locale }, result.pending ? 202 : 200);
    }

    // Missing guidance only; both null and legacy blank values need preparation.
    let query = supabase.from('gap_analysis_requirements').select(selectCols)
      .or(`${cols.orientacao}.is.null,${cols.orientacao}.eq.`).order('ordem').order('id').limit(batchSize);
    if (frameworkId) query = query.eq('framework_id', frameworkId);
    const { data: requirements, error: fetchError } = await query;
    if (fetchError) throw new GuidanceError('guidance_read_failed');
    let processed = 0, failed = 0, pending = 0;
    for (const raw of requirements || []) {
      try {
        const result = await generateAndSave(raw as unknown as Record<string, string | null>);
        if (result.pending) pending++; else processed++;
      } catch (error) {
        failed++;
        console.error('Requirement guidance batch item failed', error instanceof GuidanceError ? error.code : 'internal_error');
      }
    }
    let remainingQuery = supabase.from('gap_analysis_requirements').select('id', { count: 'exact', head: true })
      .or(`${cols.orientacao}.is.null,${cols.orientacao}.eq.`);
    if (frameworkId) remainingQuery = remainingQuery.eq('framework_id', frameworkId);
    const { count: remaining, error: countError } = await remainingQuery;
    if (countError) throw new GuidanceError('guidance_read_failed');
    return json({ processed, failed, pending, remaining: remaining ?? 0, total: requirements?.length || 0, locale });
  } catch (error) {
    console.error('Requirement guidance failed', error instanceof GuidanceError ? error.code : 'internal_error');
    return json({ error: error instanceof GuidanceError ? error.code : 'guidance_temporarily_unavailable' }, error instanceof GuidanceError ? error.status : 500);
  }
});

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
      signal: AbortSignal.timeout(60_000),
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
