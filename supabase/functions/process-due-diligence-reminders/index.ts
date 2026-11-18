import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { readScheduledRows, utcDay } from '../_shared/scheduled-job.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  // Exige service-role explícito para invocar (evita spam externo)
  const authHeader = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const providedToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!serviceKey || providedToken !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const { days_before_expiration = 3, empresa_id, dry_run } = await req.json().catch(() => ({}));
    if (!empresa_id || !Number.isInteger(days_before_expiration) || days_before_expiration < 1 || days_before_expiration > 365) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid reminder scope' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey
    );

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days_before_expiration);
    const today = utcDay();
    const { data: settings, error: settingsError } = await supabase.from('empresa_reminder_settings')
      .select('reminders_enabled,due_diligence_expiracao_ativo').eq('empresa_id', empresa_id).maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.reminders_enabled || !settings.due_diligence_expiracao_ativo) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'disabled' }), { status: 200, headers: corsHeaders });
    }

    let query = supabase
      .from('due_diligence_assessments')
      .select(`
        id,
        fornecedor_nome,
        fornecedor_email,
        link_token,
        data_expiracao,
        due_diligence_templates!inner(nome)
      `)
      .eq('status', 'enviado')
      .or(`ultimo_lembrete_enviado.is.null,ultimo_lembrete_enviado.lt.${today}T00:00:00Z`)
      .lt('data_expiracao', futureDate.toISOString())
      .gt('data_expiracao', new Date().toISOString());

    // O processador diário chama isto empresa a empresa, respeitando a
    // definição de cada uma; sem o filtro, uma empresa que desligou o lembrete
    // receberia à mesma.
    if (empresa_id) {
      query = query.eq('empresa_id', empresa_id);
    }

    const assessments = await readScheduledRows<any>((from, to) => query.order('id').range(from, to));
    if (dry_run === true) {
      return new Response(JSON.stringify({ success: true, dry_run: true, eligible: assessments.length, sent: 0 }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Encontrados ${assessments?.length || 0} assessments para lembrete`);

    let successCount = 0;
    let errorCount = 0;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://akuris.pt';

    for (const assessment of assessments || []) {
      try {
        const assessmentLink = `${siteUrl}/assessment/${assessment.link_token}`;

        const response = await supabase.functions.invoke('send-due-diligence-email', {
          body: {
            type: 'reminder',
            assessment_id: assessment.id,
            fornecedor_nome: assessment.fornecedor_nome,
            fornecedor_email: assessment.fornecedor_email,
            template_nome: (assessment.due_diligence_templates as any)?.nome
              ?? (Array.isArray(assessment.due_diligence_templates) ? assessment.due_diligence_templates[0]?.nome : ''),
            assessment_link: assessmentLink,
            data_expiracao: assessment.data_expiracao,
            empresa_nome: 'Akuris'
          },
          headers: { Authorization: `Bearer ${serviceKey}` },
        });

        if (response.error || response.data?.success !== true) {
          throw new Error('Reminder delivery failed');
        }

        const { error: saveError } = await supabase.from('due_diligence_assessments')
          .update({ ultimo_lembrete_enviado: new Date().toISOString() })
          .eq('id', assessment.id).eq('empresa_id', empresa_id);
        if (saveError) throw saveError;

        successCount++;
      } catch (emailError) {
        console.error(`Erro ao enviar lembrete do assessment ${assessment.id}:`, emailError);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: errorCount === 0,
      message: `Processados ${assessments?.length || 0} assessments`,
      details: { total: assessments?.length || 0, success: successCount, errors: errorCount },
    }), {
      status: errorCount === 0 ? 200 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Erro no processamento de lembretes:", error);
    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)),
        success: false
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
