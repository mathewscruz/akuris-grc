// Edge Function: evidence-cross-match
// Recebe { evidence_id } e analisa em quais requisitos da empresa essa evidência também serve.
// Persiste sugestões em evidence_library_links com vinculo_tipo='sugestao_ia'.
// Consome 1 crédito de IA via consume_ai_credit. Retorna 402 se esgotado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  evidence_id: string;
  empresa_id: string;
  /** opcional: limita o cross-match a frameworks específicos da empresa */
  framework_ids?: string[];
  /** quantidade máxima de candidatos a enviar para IA (default 30) */
  max_candidates?: number;
}

interface AISuggestion {
  requirement_id: string;
  score: number; // 0..1
  justificativa: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { evidence_id, framework_ids, max_candidates = 30 } = body || ({} as RequestBody);

    if (!evidence_id) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro obrigatório: evidence_id' }),
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

    // === AUTH: validate JWT and derive empresa_id from caller's profile ===
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
    const empresa_id = profile?.empresa_id;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: 'User profile missing empresa_id' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Carrega a evidência
    const { data: evidence, error: evErr } = await supabase
      .from('evidence_library')
      .select('id, empresa_id, nome, descricao, tags, arquivo_url, arquivo_nome, arquivo_tipo, link_externo')
      .eq('id', evidence_id)
      .eq('empresa_id', empresa_id)
      .single();

    if (evErr || !evidence) {
      return new Response(
        JSON.stringify({ error: 'Evidência não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2) Já vinculadas (excluir candidatos)
    const { data: existingLinks } = await supabase
      .from('evidence_library_links')
      .select('requirement_id')
      .eq('evidence_id', evidence_id)
      .eq('empresa_id', empresa_id);

    const alreadyLinked = new Set((existingLinks || []).map((l: any) => l.requirement_id));

    // 3) Frameworks ativos da empresa: derivados das avaliações reais
    //    (o produto atual não usa `gap_analysis_assessments`; a tela grava
    //    direto em `gap_analysis_evaluations`).
    let activeFwQuery = supabase
      .from('gap_analysis_evaluations')
      .select('framework_id')
      .eq('empresa_id', empresa_id);
    if (framework_ids && framework_ids.length > 0) {
      activeFwQuery = activeFwQuery.in('framework_id', framework_ids);
    }
    const { data: activeFwRows } = await activeFwQuery;
    const empresaFrameworkIds = Array.from(
      new Set((activeFwRows || []).map((a: any) => a.framework_id)),
    ).filter(Boolean);

    if (empresaFrameworkIds.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], reason: 'Nenhum framework ativo na empresa' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4) Carrega requisitos candidatos + framework name
    const { data: requirements, error: reqErr } = await supabase
      .from('gap_analysis_requirements')
      .select('id, codigo, titulo, descricao, categoria, exemplos_evidencias, framework_id, gap_analysis_frameworks(nome)')
      .in('framework_id', empresaFrameworkIds);

    if (reqErr) {
      return new Response(
        JSON.stringify({ error: 'Erro ao carregar requisitos', detail: reqErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const candidates = (requirements || []).filter((r: any) => !alreadyLinked.has(r.id));
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], reason: 'Sem requisitos candidatos disponíveis' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5) Pré-filtro lexical simples — pontua candidatos por overlap de tokens
    const evidenceText = [
      evidence.nome,
      evidence.descricao,
      (evidence.tags || []).join(' '),
      evidence.arquivo_nome,
    ].filter(Boolean).join(' ').toLowerCase();
    const evidenceTokens = new Set(
      evidenceText
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/i)
        .filter((t) => t.length >= 4),
    );

    const scored = candidates.map((r: any) => {
      const text = [r.codigo, r.titulo, r.descricao, r.categoria, r.exemplos_evidencias]
        .filter(Boolean).join(' ').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let overlap = 0;
      for (const t of evidenceTokens) if (text.includes(t)) overlap++;
      return { req: r, lexical: overlap };
    });

    // ordena por overlap descendente, fallback alfabético; corta no max_candidates
    scored.sort((a, b) => b.lexical - a.lexical);
    const shortlist = scored.slice(0, max_candidates).map((s) => s.req);

    // 6) Consome 1 crédito de IA
    const { data: creditOk, error: creditErr } = await supabase.rpc('consume_ai_credit', {
      p_empresa_id: empresa_id,
      p_user_id: userId,
      p_funcionalidade: 'evidence_cross_match',
      p_descricao: `Cross-match IA para evidência ${evidence.nome}`,
    });
    if (creditErr || creditOk === false) {
      return new Response(
        JSON.stringify({ error: 'Créditos de IA esgotados.', creditsExhausted: true }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 7) Monta prompt único comparativo
    const candidatesDescription = shortlist.map((r: any, idx: number) => {
      const fwName = r.gap_analysis_frameworks?.nome || 'Framework';
      return `[${idx + 1}] id=${r.id}
Framework: ${fwName}
Código: ${r.codigo || '—'}
Título: ${r.titulo}
${r.categoria ? `Categoria: ${r.categoria}` : ''}
${r.descricao ? `Descrição: ${String(r.descricao).slice(0, 600)}` : ''}
${r.exemplos_evidencias ? `Evidências esperadas: ${String(r.exemplos_evidencias).slice(0, 400)}` : ''}`;
    }).join('\n\n');

    const evidenceBlock = `
Nome: ${evidence.nome}
${evidence.descricao ? `Descrição: ${evidence.descricao}` : ''}
${evidence.tags && evidence.tags.length ? `Tags: ${evidence.tags.join(', ')}` : ''}
${evidence.arquivo_nome ? `Arquivo: ${evidence.arquivo_nome} (${evidence.arquivo_tipo || 'desconhecido'})` : ''}
${evidence.link_externo ? `Link: ${evidence.link_externo}` : ''}`;

    const prompt = `Você é um auditor sênior de conformidade GRC. Tenho UMA evidência (documento ou link) e ${shortlist.length} requisitos candidatos de frameworks de conformidade. Diga em quais requisitos essa MESMA evidência também serve como prova de conformidade.

EVIDÊNCIA:
${evidenceBlock}

REQUISITOS CANDIDATOS:
${candidatesDescription}

Para cada requisito em que a evidência é aderente, retorne uma entrada. IGNORE requisitos sem aderência clara.

Retorne APENAS JSON válido (sem markdown), no formato:
{
  "suggestions": [
    { "requirement_id": "<uuid>", "score": 0.00-1.00, "justificativa": "até 200 caracteres explicando por que esta evidência atende este requisito" }
  ]
}

Score: 1.00 = atende plenamente, 0.80 = atende com alta probabilidade, 0.60 = atende parcialmente, abaixo de 0.60 NÃO incluir na resposta.`;

    // 8) Chama Lovable AI
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um auditor de conformidade rigoroso. Responda APENAS JSON válido.' },
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
    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (_) { /* noop */ } }
    }

    if (!parsed || !Array.isArray(parsed.suggestions)) {
      return new Response(
        JSON.stringify({ error: 'Resposta da IA inválida', raw: raw.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const suggestions: AISuggestion[] = parsed.suggestions
      .filter((s: any) => s && typeof s.requirement_id === 'string' && typeof s.score === 'number' && s.score >= 0.6)
      .map((s: any) => ({
        requirement_id: s.requirement_id,
        score: Math.min(1, Math.max(0, s.score)),
        justificativa: typeof s.justificativa === 'string' ? s.justificativa.slice(0, 500) : '',
      }));

    if (suggestions.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], persisted: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 9) Para cada sugestão: garante uma evaluation existente para o requisito e cria o link pendente
    const requirementsById = new Map(shortlist.map((r: any) => [r.id, r]));

    let persisted = 0;
    const enriched: any[] = [];

    for (const s of suggestions) {
      const r = requirementsById.get(s.requirement_id);
      if (!r) continue;

      // Garante evaluation
      let evaluationId: string | null = null;
      const { data: existingEval } = await supabase
        .from('gap_analysis_evaluations')
        .select('id')
        .eq('empresa_id', empresa_id)
        .eq('framework_id', r.framework_id)
        .eq('requirement_id', r.id)
        .maybeSingle();

      if (existingEval?.id) {
        evaluationId = existingEval.id;
      } else {
        const { data: newEval, error: createEvalErr } = await supabase
          .from('gap_analysis_evaluations')
          .insert({
            empresa_id,
            framework_id: r.framework_id,
            requirement_id: r.id,
            conformity_status: 'nao_avaliado',
            evidence_status: 'pendente',
            created_by: userId,
          })
          .select('id')
          .single();
        if (createEvalErr) continue;
        evaluationId = newEval?.id || null;
      }
      if (!evaluationId) continue;

      // Cria link sugerido (idempotente via UNIQUE)
      const { error: linkErr } = await supabase
        .from('evidence_library_links')
        .upsert({
          empresa_id,
          evidence_id,
          evaluation_id: evaluationId,
          requirement_id: r.id,
          framework_id: r.framework_id,
          vinculo_tipo: 'sugestao_ia',
          ia_score: s.score,
          ia_justificativa: s.justificativa,
          created_by: userId,
        }, { onConflict: 'evidence_id,evaluation_id', ignoreDuplicates: false });

      if (!linkErr) {
        persisted++;
        enriched.push({
          requirement_id: r.id,
          framework_id: r.framework_id,
          framework_nome: r.gap_analysis_frameworks?.nome || null,
          codigo: r.codigo,
          titulo: r.titulo,
          categoria: r.categoria,
          score: s.score,
          justificativa: s.justificativa,
          evaluation_id: evaluationId,
        });
      }
    }

    return new Response(
      JSON.stringify({ suggestions: enriched, persisted, analyzed_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('evidence-cross-match error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
