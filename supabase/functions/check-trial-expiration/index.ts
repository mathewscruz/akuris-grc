import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRIAL_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Disable expired trials
    const { error: rpcError } = await supabaseAdmin.rpc('check_trial_expiration');
    if (rpcError) console.error('Erro check_trial_expiration:', rpcError);

    // 2. Find active trials and compute days remaining
    const { data: trials } = await supabaseAdmin
      .from('empresas')
      .select('id, nome, contato, data_inicio_trial')
      .eq('status_licenca', 'trial')
      .eq('ativo', true)
      .not('data_inicio_trial', 'is', null);

    const now = Date.now();
    const reminders: Array<{ empresa_id: string; milestone: 'd_minus_3' | 'd_zero'; email: string; nome: string; daysLeft: number }> = [];

    for (const t of trials || []) {
      const start = new Date(t.data_inicio_trial as string).getTime();
      const elapsedDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      const daysLeft = TRIAL_DAYS - elapsedDays;
      if (!t.contato) continue;

      if (daysLeft === 3) reminders.push({ empresa_id: t.id, milestone: 'd_minus_3', email: t.contato, nome: t.nome, daysLeft });
      else if (daysLeft <= 0) reminders.push({ empresa_id: t.id, milestone: 'd_zero', email: t.contato, nome: t.nome, daysLeft });
    }

    // 3. Filter out already-sent milestones
    let sentCount = 0;
    for (const r of reminders) {
      const { data: existing } = await supabaseAdmin
        .from('trial_reminders_sent')
        .select('id')
        .eq('empresa_id', r.empresa_id)
        .eq('milestone', r.milestone)
        .maybeSingle();

      if (existing) continue;

      const subject = r.milestone === 'd_minus_3'
        ? `⏰ Seu trial Akuris termina em 3 dias`
        : `🔔 Seu trial Akuris terminou`;

      const message = r.milestone === 'd_minus_3'
        ? `Olá, equipe ${r.nome}!\n\nSeu período de avaliação gratuita do Akuris termina em 3 dias. Para continuar usando a plataforma sem interrupções, entre em contato para ativar seu plano.`
        : `Olá, equipe ${r.nome}!\n\nSeu período de avaliação gratuita do Akuris foi encerrado. O acesso à plataforma foi suspenso. Entre em contato para reativar.`;

      try {
        await supabaseAdmin.functions.invoke('send-welcome-email', {
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: {
            userName: r.nome,
            userEmail: r.email,
            setupPasswordUrl: 'https://akuris.com.br/contato',
            companyName: 'Akuris',
            companyLogoUrl: '',
            customSubject: subject,
            customMessage: message,
          },
        });

        await supabaseAdmin.from('trial_reminders_sent').insert({
          empresa_id: r.empresa_id,
          milestone: r.milestone,
          recipient_email: r.email,
        });
        sentCount++;
      } catch (e) {
        console.error('Erro ao enviar lembrete:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      reminders_sent: sentCount,
      executed_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
