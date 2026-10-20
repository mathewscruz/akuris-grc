import { fetchIA, rotularFuncaoIA } from '../_shared/ai.ts';
rotularFuncaoIA('populate-requirement-guidance');
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODELOS } from '../_shared/modelos.ts';
import { guidanceQuestions, guidanceStyleOk, implementationSection, parseGeneratedGuidance } from '../_shared/requirement-guidance-content.ts';
import { authorizedScheduledJob } from '../_shared/scheduled-job.ts';
import { getOrCreateGuidance, GuidanceError, type GuidanceResult } from './guidance-service.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type Locale = "pt" | "en";
const PASSOS: Record<Locale, string> = { pt: 'aça nesta ordem', en: 'do this in order' };
const EVIDENCIA_EM_LISTA = /(^|\n)\s*([-*•]|\d+[.)])\s/;
// Referenced so the style contract stays shared with the generator parser.
void guidanceStyleOk;
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
    // Scheduled warm-up: platform cron prepares the shared catalogue in small batches.
    const scheduled = authorizedScheduledJob(req, Deno.env.get('LEMBRETES_DIARIOS_TOKEN'), supabaseKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    let userId = 'platform-cron';
    if (!scheduled) {
      const { data: userData, error: claimsError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (claimsError || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);
      userId = userData.user.id;
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('empresa_id').eq('user_id', userData.user.id).eq('ativo', true).single();
      if (profileError || !profile?.empresa_id) return json({ error: 'Forbidden' }, 403);
    }

    // Catálogo global: traduz títulos/descrições/categorias que ainda não têm inglês.
    if (scheduled) {
      const traduzidos = await traduzirCatalogo(supabase, Deno.env.get('LOVABLE_API_KEY'));
      if (traduzidos > 0) return json({ translated: traduzidos });
      const ampliadas = await ampliarDescricoes(supabase, Deno.env.get('LOVABLE_API_KEY'));
      if (ampliadas > 0) return json({ descriptions_expanded: ampliadas });
    }
    const body = scheduled ? await scheduledBody(supabase) : await req.json().catch(() => null);
    if (scheduled && !body) return json({ processed: 0, remaining: 0, idle: true });
    if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400);
    const requirementId = typeof body.requirement_id === 'string' ? body.requirement_id : null;
    const frameworkId = typeof body.framework_id === 'string' ? body.framework_id : null;
    if ((requirementId && !uuid.test(requirementId)) || (frameworkId && !uuid.test(frameworkId))) return json({ error: 'invalid_id' }, 400);
    const rawBatch = Number(body.batch_size);
    const batchSize = Number.isFinite(rawBatch) ? Math.min(Math.max(Math.trunc(rawBatch), 1), 25) : 10;
    const locale: Locale = body.locale === 'en' ? 'en' : 'pt';
    // Platform cron rewrites legacy catalogue guidance (greetings, emojis, no ordered steps).
    const legacy = scheduled && body.legacy === true;
    const force = body.force === true || legacy;
    // Lets the batch caller step past items that failed or are mid-generation,
    // instead of re-reading the same first rows forever.
    const rawOffset = Number(body.offset);
    const offset = Number.isFinite(rawOffset) ? Math.min(Math.max(Math.trunc(rawOffset), 0), 5000) : 0;
    const cols = COLS[locale];

    // Shared catalogue: only the platform administrator can overwrite or
    // warm a whole framework. A customer can request missing individual guidance.
    if (!scheduled && (force || !requirementId)) {
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
          if (error) { console.error('rate limit rpc falhou', error.message); throw new GuidanceError('guidance_temporarily_unavailable'); }
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
          // Repair missing pieces without rewriting valid catalogue content or
          // changing question order beneath evaluations already answered by users.
          const currentRow = await readRow(row.id!);
          if (legacy) {
            const oldQ = currentRow[cols.perguntas] || null;
            const oldEv = currentRow[cols.evidencias] || '';
            if (guidanceQuestions(oldQ).length) guidance = { ...guidance, perguntas_diagnostico: oldQ };
            if (EVIDENCIA_EM_LISTA.test(oldEv)) guidance = { ...guidance, exemplos_evidencias: oldEv };
          } else if (!force) {
            const previous = {
              orientacao_implementacao: currentRow[cols.orientacao] || '',
              exemplos_evidencias: currentRow[cols.evidencias] || '',
              perguntas_diagnostico: currentRow[cols.perguntas] || null,
            };
            guidance = {
              orientacao_implementacao: implementationSection(previous.orientacao_implementacao) ? previous.orientacao_implementacao : guidance.orientacao_implementacao,
              exemplos_evidencias: previous.exemplos_evidencias.trim() ? previous.exemplos_evidencias : guidance.exemplos_evidencias,
              perguntas_diagnostico: guidanceQuestions(previous.perguntas_diagnostico).length ? previous.perguntas_diagnostico : guidance.perguntas_diagnostico,
            };
          }
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
    let query = supabase.from('gap_analysis_requirements').select(selectCols).order('ordem').order('id');
    query = legacy
      ? query.not(cols.orientacao, 'ilike', `%${PASSOS[locale]}%`).not(cols.orientacao, 'is', null).neq(cols.orientacao, '').range(0, batchSize - 1)
      : query.or(`${cols.orientacao}.is.null,${cols.orientacao}.eq.`).range(offset, offset + batchSize - 1);
    if (frameworkId) query = query.eq('framework_id', frameworkId);
    const { data: requirements, error: fetchError } = await query;
    if (fetchError) throw new GuidanceError('guidance_read_failed');
    let processed = 0, failed = 0, pending = 0;
    // Parallel inside the batch so a batch fits the function's time limit.
    const results = await Promise.allSettled((requirements || []).map((raw) =>
      generateAndSave(raw as unknown as Record<string, string | null>)));
    for (const r of results) {
      if (r.status === 'fulfilled') { if (r.value.pending) pending++; else processed++; }
      else { failed++; console.error('Requirement guidance batch item failed', r.reason instanceof GuidanceError ? r.reason.code : 'internal_error'); }
    }
    let remainingQuery = supabase.from('gap_analysis_requirements').select('id', { count: 'exact', head: true })
      .or(`${cols.orientacao}.is.null,${cols.orientacao}.eq.`);
    if (frameworkId) remainingQuery = remainingQuery.eq('framework_id', frameworkId);
    const { count: remaining, error: countError } = await remainingQuery;
    if (countError) throw new GuidanceError('guidance_read_failed');
    return json({ processed, failed, pending, remaining: remaining ?? 0, total: requirements?.length || 0, locale });
  } catch (error) {
    console.error('Requirement guidance failed', error instanceof GuidanceError ? error.code : 'internal_error', error instanceof Error ? error.message : String(error));
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
    const response = await fetchIA('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELOS.ANALISE,
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

    return parseGeneratedGuidance(fullContent, data.choices?.[0]?.finish_reason);
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

/** Cron body: Portuguese first, then English; a fixed batch per run. */
// deno-lint-ignore no-explicit-any
async function scheduledBody(supabase: any): Promise<Record<string, unknown> | null> {
  for (const locale of ['pt', 'en'] as const) {
    const col = COLS[locale].orientacao;
    const { count } = await supabase.from('gap_analysis_requirements').select('id', { count: 'exact', head: true })
      .or(`${col}.is.null,${col}.eq.`);
    if ((count ?? 0) > 0) return { locale, batch_size: 8, offset: Math.floor(Math.random() * Math.min(count, 40)) };
  }
  for (const locale of ['pt', 'en'] as const) {
    const col = COLS[locale].orientacao;
    const { count } = await supabase.from('gap_analysis_requirements').select('id', { count: 'exact', head: true })
      .not(col, 'ilike', `%${PASSOS[locale]}%`).not(col, 'is', null).neq(col, '');
    if ((count ?? 0) > 0) return { locale, batch_size: 6, legacy: true };
  }
  return null;
}

/** Traduz até 25 requisitos de frameworks globais sem título/descrição/categoria em inglês. */
async function traduzirCatalogo(supabase: any, apiKey: string | undefined): Promise<number> {
  if (!apiKey) { console.error('traducao: LOVABLE_API_KEY ausente'); return 0; }
  const { data: globais } = await supabase.from('gap_analysis_frameworks').select('id').is('empresa_id', null);
  const ids = (globais ?? []).map((f: any) => f.id);
  if (!ids.length) return 0;
  const { data: rows, error: errRows } = await supabase.from('gap_analysis_requirements')
    .select('id, codigo, titulo, descricao, categoria, titulo_en, descricao_en, categoria_en')
    .in('framework_id', ids)
    .or('titulo_en.is.null,titulo_en.eq.,descricao_en.is.null,descricao_en.eq.,categoria_en.is.null')
    .limit(25);
  if (errRows) console.error('traducao: leitura falhou', errRows.message);
  if (!rows?.length) return 0;
  const entrada = rows.map((r: any) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, descricao: r.descricao, categoria: r.categoria }));
  const resp = await fetchIA('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELOS.ANALISE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You translate GRC framework requirement metadata from Portuguese to professional English. Keep official terminology of the standard (ISO, NIST, PCI, GDPR, etc.). Return JSON {"items":[{"id","titulo_en","descricao_en","categoria_en"}]} with exactly one item per input id. No extra text.' },
        { role: 'user', content: JSON.stringify(entrada) },
      ],
    }),
  });
  if (!resp.ok) { console.error('traducao falhou', resp.status); return 0; }
  const out = await resp.json();
  let itens: any[] = [];
  try { itens = JSON.parse(out.choices?.[0]?.message?.content ?? '{}').items ?? []; } catch (e) { console.error('traducao: json invalido', String(e)); return 0; }
  const porId = new Map(rows.map((r: any) => [r.id, r]));
  let n = 0;
  for (const it of itens) {
    const atual: any = porId.get(it?.id);
    if (!atual) continue;
    const patch: Record<string, string> = {};
    if (!atual.titulo_en?.trim() && typeof it.titulo_en === 'string' && it.titulo_en.trim()) patch.titulo_en = it.titulo_en.trim().slice(0, 300);
    if (!atual.descricao_en?.trim() && typeof it.descricao_en === 'string' && it.descricao_en.trim()) patch.descricao_en = it.descricao_en.trim();
    if (!atual.categoria_en?.trim() && typeof it.categoria_en === 'string' && it.categoria_en.trim()) patch.categoria_en = it.categoria_en.trim().slice(0, 200);
    if (!Object.keys(patch).length) continue;
    const { error } = await supabase.from('gap_analysis_requirements').update(patch).eq('id', atual.id);
    if (!error) n++;
  }
  console.log('traducao gravados', n, 'de', rows.length);
  return n;
}

/** Descrição curta (≈ só o título) não diz ao usuário o que a norma exige: amplia até 40 por vez. */
// deno-lint-ignore no-explicit-any
async function ampliarDescricoes(supabase: any, apiKey: string | undefined): Promise<number> {
  if (!apiKey) return 0;
  const { data: globais } = await supabase.from('gap_analysis_frameworks').select('id, nome').is('empresa_id', null);
  const nomes = new Map((globais ?? []).map((f: any) => [f.id, f.nome]));
  if (!nomes.size) return 0;
  const curtas: any[] = [];
  for (let from = 0; from < 4000 && curtas.length < 40; from += 1000) {
    const { data, error } = await supabase.from('gap_analysis_requirements')
      .select('id, framework_id, codigo, titulo, descricao, descricao_en')
      .in('framework_id', [...nomes.keys()]).order('id').range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) {
      const d = (r.descricao || '').trim();
      if (d.length < 40 || d.toLowerCase() === (r.titulo || '').trim().toLowerCase()) curtas.push(r);
      if (curtas.length >= 40) break;
    }
    if (data.length < 1000) break;
  }
  if (!curtas.length) return 0;
  const entrada = curtas.map((r) => ({ id: r.id, framework: nomes.get(r.framework_id), codigo: r.codigo, titulo: r.titulo, descricao_atual: r.descricao }));
  const resp = await fetchIA('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELOS.ANALISE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a senior GRC specialist. For each framework requirement, write what the organization must do, in your own words (never copy the official text verbatim). descricao: Brazilian Portuguese, 1-2 sentences, 120-320 characters, starting with "A organização deve". descricao_en: same meaning in English, starting with "The organization must". No greetings, emojis, markdown or requirement codes. Return JSON {"items":[{"id","descricao","descricao_en"}]} with one item per input id.' },
        { role: 'user', content: JSON.stringify(entrada) },
      ],
    }),
  });
  if (!resp.ok) { console.error('descricoes falhou', resp.status); return 0; }
  const out = await resp.json();
  let itens: any[] = [];
  try { itens = JSON.parse(out.choices?.[0]?.message?.content ?? '{}').items ?? []; } catch { return 0; }
  const ids = new Set(curtas.map((r) => r.id));
  let n = 0;
  for (const it of itens) {
    const pt = typeof it?.descricao === 'string' ? it.descricao.trim() : '';
    const en = typeof it?.descricao_en === 'string' ? it.descricao_en.trim() : '';
    if (!ids.has(it?.id) || pt.length < 40 || en.length < 40) continue;
    const { error } = await supabase.from('gap_analysis_requirements').update({ descricao: pt, descricao_en: en }).eq('id', it.id);
    if (!error) n++;
  }
  console.log('descricoes ampliadas', n, 'de', curtas.length);
  return n;
}
