// Edge Function: projeto-sla-checker
// Roda via cron periódico. Atualiza sla_status das tarefas (no_prazo / em_risco / violado)
// baseado em prazo + sla_horas.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Tarefas com prazo e não concluídas
    const { data: tarefas, error } = await supabase
      .from('projeto_tarefas')
      .select('id, prazo, sla_horas, sla_status, concluida_em, sla_violado_em')
      .not('prazo', 'is', null)
      .is('concluida_em', null)
      .limit(5000);

    if (error) throw error;

    const now = Date.now();
    let atualizadasViolado = 0, atualizadasRisco = 0, atualizadasOk = 0;

    for (const t of tarefas ?? []) {
      const prazoMs = new Date(t.prazo!).getTime();
      const horasRestantes = (prazoMs - now) / (1000 * 60 * 60);
      const limiteRisco = t.sla_horas && t.sla_horas > 0 ? t.sla_horas : 24; // default 24h
      let novoStatus: 'no_prazo' | 'em_risco' | 'violado' = 'no_prazo';
      if (horasRestantes < 0) novoStatus = 'violado';
      else if (horasRestantes <= limiteRisco) novoStatus = 'em_risco';

      if (novoStatus === t.sla_status) continue;

      const payload: Record<string, unknown> = { sla_status: novoStatus };
      if (novoStatus === 'violado' && !t.sla_violado_em) payload.sla_violado_em = new Date().toISOString();

      await supabase.from('projeto_tarefas').update(payload).eq('id', t.id);

      if (novoStatus === 'violado') atualizadasViolado++;
      else if (novoStatus === 'em_risco') atualizadasRisco++;
      else atualizadasOk++;
    }

    return new Response(JSON.stringify({
      ok: true,
      verificadas: tarefas?.length ?? 0,
      atualizadas: { violado: atualizadasViolado, em_risco: atualizadasRisco, no_prazo: atualizadasOk },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
