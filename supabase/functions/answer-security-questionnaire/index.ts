// Edge Function: answer-security-questionnaire
// Rascunha respostas a questionários de segurança de clientes usando
// SOMENTE dados da empresa (controles, frameworks, documentos).
// Consome 1 crédito via consume_ai_credit; 402 quando esgotado.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { MODELOS } from '../_shared/modelos.ts';
import { temCreditoIA, semCreditoIA } from '../_shared/creditos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const perguntas: string[] = Array.isArray(body?.perguntas)
      ? body.perguntas.map((p: unknown) => String(p).trim().slice(0, 500)).filter((p: string) => p.length >= 3)
      : [];
    const idioma = body?.idioma === 'en' ? 'en' : 'pt';
    if (perguntas.length === 0 || perguntas.length > 80) return json({ error: 'perguntas: 1 a 80 itens' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) return json({ error: 'LOVABLE_API_KEY não configurada' }, 500);
    const supabase = createClient(supabaseUrl, serviceKey);

    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey);
    const { data: u } = await verifier.auth.getUser(auth.replace('Bearer ', ''));
    if (!u?.user) return json({ error: 'Unauthorized' }, 401);
    const userId = u.user.id;
    const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('user_id', userId).eq('ativo', true).maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) return json({ error: 'Empresa não encontrada' }, 403);

    const [{ data: controles }, { data: docs }, { data: tc }] = await Promise.all([
      supabase.from('controles').select('nome, descricao, status').eq('empresa_id', empresaId).limit(150),
      supabase.from('documentos').select('nome, tipo, status').eq('empresa_id', empresaId).limit(80),
      supabase.from('trust_center').select('framework_ids').eq('empresa_id', empresaId).maybeSingle(),
    ]);
    let frameworks: string[] = [];
    const fwIds = (tc as any)?.framework_ids ?? [];
    if (fwIds.length) {
      const { data: fws } = await supabase.from('gap_analysis_frameworks').select('nome').in('id', fwIds);
      frameworks = (fws ?? []).map((f) => f.nome);
    }

    const contexto = [
      `Controles: ${(controles ?? []).map((c) => `${c.nome} [${c.status}]${c.descricao ? ` - ${String(c.descricao).slice(0, 120)}` : ''}`).join('; ')}`,
      `Documentos: ${(docs ?? []).map((d) => `${d.nome} (${d.tipo}, ${d.status ?? '-'})`).join('; ')}`,
      `Frameworks avaliados: ${frameworks.join(', ') || 'nenhum publicado'}`,
    ].join('\n').slice(0, 14000);

    if (!(await temCreditoIA(supabase, empresaId))) return semCreditoIA(corsHeaders);

    const prompt = `Responda a um questionário de segurança de um cliente em nome da empresa, em ${idioma === 'en' ? 'inglês' : 'português'}.
Use APENAS o contexto abaixo. Se o contexto não comprovar, responda "nao" ou "parcial" e diga o que falta — nunca invente.
Contexto da empresa:
${contexto}

Perguntas:
${perguntas.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Retorne APENAS JSON válido:
{"respostas":[{"n":1,"resposta":"sim|parcial|nao|na","justificativa":"1-3 frases","evidencias":["nome do controle ou documento"]}]}`;

    const ai = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELOS.PADRAO,
        messages: [
          { role: 'system', content: 'Você é um analista de segurança da informação. Responda APENAS JSON válido, sem saudações.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!ai.ok) {
      if (ai.status === 402) return json({ error: 'Créditos esgotados', creditsExhausted: true }, 402);
      if (ai.status === 429) return json({ error: 'Rate limit' }, 429);
      return json({ error: 'Falha na IA' }, 500);
    }
    const aiJson = await ai.json();
    try {
      const { data: ok } = await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId, p_user_id: userId,
        p_funcionalidade: 'responder_questionario',
        p_descricao: `Questionário de segurança — ${perguntas.length} perguntas`,
      });
      if (ok === false) return semCreditoIA(corsHeaders);
    } catch (e) { console.warn('consume_ai_credit falhou:', e); }

    let content: string = aiJson?.choices?.[0]?.message?.content ?? '{}';
    content = content.replace(/```json|```/g, '').trim();
    const idx = content.indexOf('{');
    if (idx > 0) content = content.slice(idx);
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const porN = new Map<number, any>((parsed.respostas ?? []).map((r: any) => [Number(r.n), r]));
    const respostas = perguntas.map((pergunta, i) => {
      const r = porN.get(i + 1) ?? {};
      const resposta = ['sim', 'parcial', 'nao', 'na'].includes(r.resposta) ? r.resposta : 'parcial';
      return { pergunta, resposta, justificativa: String(r.justificativa ?? ''), evidencias: Array.isArray(r.evidencias) ? r.evidencias.map(String) : [] };
    });
    return json({ respostas });
  } catch (err) {
    return json({ error: 'Erro interno', detail: String(err) }, 500);
  }
});
