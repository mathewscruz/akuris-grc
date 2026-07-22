// Edge Function: projeto-status-report
// Gera relatório executivo (status report) editorial de um projeto.
// Consome 1 crédito via consume_ai_credit. 402 quando esgotado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { projetoId } = (await req.json()) as { projetoId: string };
    if (!projetoId) {
      return new Response(JSON.stringify({ error: 'Parâmetro: projetoId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);
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
    const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('user_id', userId).maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: proj } = await supabase
      .from('projetos').select('id, nome, descricao, status, data_inicio, data_fim_prevista').eq('id', projetoId).eq('empresa_id', empresaId).maybeSingle();
    if (!proj) {
      return new Response(JSON.stringify({ error: 'Projeto não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Crédito consumido só após sucesso da IA (ver bloco pós-response).


    // Agrega métricas
    const { data: tarefas } = await supabase
      .from('projeto_tarefas')
      .select('id, titulo, prioridade, progresso_pct, prazo, bloqueada, sla_status, concluida_em, coluna_id')
      .eq('projeto_id', projetoId);
    const { data: colunas } = await supabase
      .from('projeto_colunas').select('id, nome, is_concluido').eq('projeto_id', projetoId);

    const total = tarefas?.length ?? 0;
    const concluidasIds = new Set((colunas ?? []).filter(c => c.is_concluido).map(c => c.id));
    const concluidas = (tarefas ?? []).filter(t => t.concluida_em || (t.coluna_id && concluidasIds.has(t.coluna_id))).length;
    const atrasadas = (tarefas ?? []).filter(t => t.prazo && new Date(t.prazo) < new Date() && !t.concluida_em).length;
    const slaViolado = (tarefas ?? []).filter(t => t.sla_status === 'violado').length;
    const bloqueadas = (tarefas ?? []).filter(t => t.bloqueada).length;
    const progressoMedio = total > 0 ? Math.round(((tarefas ?? []).reduce((s, t) => s + (t.progresso_pct ?? 0), 0) / total)) : 0;

    const resumoTarefasCriticas = (tarefas ?? [])
      .filter(t => t.prioridade === 'critica' || t.prioridade === 'alta')
      .slice(0, 10)
      .map(t => `- [${t.prioridade}] ${t.titulo} (${t.progresso_pct ?? 0}%)`)
      .join('\n');

    const prompt = `Você é um PMO sênior. Gere um status report editorial em PT-BR para o projeto abaixo. Sem saudações.

PROJETO: ${proj.nome}
${proj.descricao ? `Descrição: ${String(proj.descricao).slice(0, 400)}` : ''}
Status: ${proj.status}
Período: ${proj.data_inicio ?? 'n/d'} → ${proj.data_fim_prevista ?? 'n/d'}

MÉTRICAS:
- Tarefas: ${total} (concluídas: ${concluidas}, atrasadas: ${atrasadas}, bloqueadas: ${bloqueadas}, SLA violado: ${slaViolado})
- Progresso médio: ${progressoMedio}%

TAREFAS CRÍTICAS/ALTA:
${resumoTarefasCriticas || '(nenhuma)'}

Retorne APENAS JSON válido (sem markdown):
{
  "saude": "verde"|"amarelo"|"vermelho",
  "headline": "manchete editorial 1 frase",
  "resumo_executivo": "3-4 frases factuais sobre o estado atual",
  "riscos": ["risco 1 curto", "risco 2"],
  "proximas_acoes": ["próxima ação concreta 1", "próxima ação 2", "próxima ação 3"],
  "recomendacao_gestor": "1-2 frases dirigidas ao gestor"
}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um PMO sênior. Responda APENAS JSON válido em PT-BR.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: 'Créditos esgotados', creditsExhausted: true }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'Falha na IA', detail: await aiResp.text() }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const aiJson = await aiResp.json();
    try {
      await supabase.rpc('consume_ai_credit', {
        p_empresa_id: empresaId, p_user_id: userId,
        p_funcionalidade: 'projeto_status_report',
        p_descricao: `Status report IA — ${proj.nome}`,
      });
    } catch (e) { console.warn('consume_ai_credit falhou:', e); }
    let content: string = aiJson?.choices?.[0]?.message?.content ?? '{}';
    content = content.replace(/```json|```/g, '').trim();
    const idx = content.indexOf('{');
    if (idx > 0) content = content.slice(idx);
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { /* keep empty */ }

    return new Response(JSON.stringify({
      report: parsed,
      metrics: { total, concluidas, atrasadas, bloqueadas, slaViolado, progressoMedio },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro interno', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
