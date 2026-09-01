// Edge Function: translate-framework-content
// Traduz para inglês o conteúdo (título, descrição, categoria e textos de apoio)
// dos requisitos de um framework global do Gap Analysis, gravando nas colunas *_en.
//
// Restrita a super-admin. Processa em lotes para caber no tempo de execução:
// o cliente chama repetidamente até `remaining` chegar a 0.
// Consome 1 crédito de IA por lote (após o gateway aceitar). 402 quando esgotado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { MODELOS } from '../_shared/modelos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FIELDS = [
  'titulo',
  'descricao',
  'categoria',
  'orientacao_implementacao',
  'exemplos_evidencias',
  'perguntas_diagnostico',
] as const;

const MAX_BATCH = 15;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const frameworkId = typeof body?.frameworkId === 'string' ? body.frameworkId : '';
    const batchSize = Math.min(Math.max(Number(body?.batchSize) || MAX_BATCH, 1), MAX_BATCH);
    if (!/^[0-9a-f-]{36}$/i.test(frameworkId)) {
      return json({ error: 'Parâmetro obrigatório: frameworkId (uuid)' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) return json({ error: 'LOVABLE_API_KEY não configurada' }, 500);
    const supabase = createClient(supabaseUrl, serviceKey);

    // === AUTH: apenas super-admin ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const { data: isSuper } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'super_admin',
    });
    if (!isSuper) return json({ error: 'Forbidden: super-admin apenas' }, 403);

    const { data: profile } = await supabase
      .from('profiles').select('empresa_id').eq('user_id', userId).maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) return json({ error: 'User profile missing empresa_id' }, 403);

    // Framework (template global)
    const { data: framework } = await supabase
      .from('gap_analysis_frameworks')
      .select('id, nome, descricao, nome_en, descricao_en')
      .eq('id', frameworkId)
      .maybeSingle();
    if (!framework) return json({ error: 'Framework não encontrado' }, 404);

    // Pendentes: sem título em inglês
    const { count: pending } = await supabase
      .from('gap_analysis_requirements')
      .select('id', { count: 'exact', head: true })
      .eq('framework_id', frameworkId)
      .or('titulo_en.is.null,descricao_en.is.null');

    const { data: rows } = await supabase
      .from('gap_analysis_requirements')
      .select('id, codigo, titulo, descricao, categoria, orientacao_implementacao, exemplos_evidencias, perguntas_diagnostico')
      .eq('framework_id', frameworkId)
      .or('titulo_en.is.null,descricao_en.is.null')
      .order('ordem', { ascending: true })
      .limit(batchSize);

    if (!rows || rows.length === 0) {
      return json({ translated: 0, remaining: 0, done: true });
    }

    const payload = rows.map((r) => {
      const item: Record<string, string> = { id: r.id, codigo: r.codigo || '' };
      for (const f of FIELDS) {
        const v = (r as Record<string, unknown>)[f];
        if (typeof v === 'string' && v.trim()) item[f] = v.slice(0, 4000);
      }
      return item;
    });

    const prompt = `Translate the following compliance framework requirements from Portuguese to English.

Framework: ${framework.nome}

Rules:
- Use the official English wording of the standard whenever the item matches a known clause/control.
- Keep the exact same JSON structure and the same "id" values.
- Translate only the text fields present in each item; do not add fields.
- Keep any JSON string that contains a serialized array (perguntas_diagnostico) as a serialized array of translated strings.
- Preserve codes, acronyms and numbering as-is.
- No greetings, no commentary.

Return ONLY a valid JSON array (no markdown fences) with the translated items.

ITEMS:
${JSON.stringify(payload)}`;

    // Sem franquia, nem se chama o modelo: a chamada custa no instante
    // em que sai. Ver `_shared/creditos.ts`.
    if (!(await temCreditoIA(supabase, empresaId))) return semCreditoIA(corsHeaders);

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELOS.MECANICO,
        messages: [
          { role: 'system', content: 'You are a compliance standards translator. Reply with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 402) {
        return json({ error: 'Créditos de IA esgotados.', creditsExhausted: true }, 402);
      }
      if (aiResp.status === 429) {
        return json({ error: 'Muitas requisições, aguarde alguns segundos.' }, 429);
      }
      const t = await aiResp.text();
      return json({ error: 'Erro no gateway de IA', detail: t.slice(0, 500) }, 500);
    }

    const { data: creditoOk } = await supabase.rpc('consume_ai_credit', {
      p_empresa_id: empresaId,
      p_user_id: userId,
      p_funcionalidade: 'translate_framework_content',
      p_descricao: `Tradução EN de ${rows.length} requisitos (${framework.nome});
    /* Franquia esgotada entre a pergunta e o débito: quem chega
       a seguir não leva a resposta. */
    if (creditoOk === false) return semCreditoIA(corsHeaders)`,
    });

    const aiData = await aiResp.json();
    const raw: string = aiData?.choices?.[0]?.message?.content ?? '';
    const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (_) { /* noop */ } }
    }
    if (!Array.isArray(parsed)) {
      return json({ error: 'Resposta da IA inválida', raw: raw.slice(0, 500) }, 502);
    }

    const byId = new Map(rows.map((r) => [r.id, r]));
    let translated = 0;
    for (const item of parsed as Record<string, unknown>[]) {
      const id = typeof item?.id === 'string' ? item.id : '';
      const source = byId.get(id);
      if (!source) continue;
      const update: Record<string, string> = {};
      for (const f of FIELDS) {
        const v = item[f];
        if (typeof v === 'string' && v.trim()) update[`${f}_en`] = v.trim();
      }
      // Garante que o título em inglês exista para não reprocessar o mesmo item.
      if (!update.titulo_en) update.titulo_en = source.titulo || '';
      // Marca a descrição como processada mesmo quando não há texto a traduzir,
      // evitando que o mesmo requisito volte no próximo lote.
      if (!update.descricao_en) update.descricao_en = source.descricao || '';
      const { error } = await supabase
        .from('gap_analysis_requirements')
        .update(update)
        .eq('id', id)
        .eq('framework_id', frameworkId);
      if (!error) translated++;
    }

    const remaining = Math.max((pending ?? rows.length) - translated, 0);
    return json({ translated, remaining, done: remaining === 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
