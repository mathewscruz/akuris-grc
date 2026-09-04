import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { days_before_expiration = 3, empresa_id } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey
    );

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days_before_expiration);

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
      .lt('data_expiracao', futureDate.toISOString())
      .gt('data_expiracao', new Date().toISOString());

    // O processador diário chama isto empresa a empresa, respeitando a
    // definição de cada uma; sem o filtro, uma empresa que desligou o lembrete
    // receberia à mesma.
    if (empresa_id) {
      query = query.eq('empresa_id', empresa_id);
    }

    const { data: assessments, error } = await query;

    if (error) throw error;

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

        if (response.error) {
          throw new Error(`Erro ao enviar email: ${response.error.message || String(response.error)}`);
        }

        successCount++;
      } catch (emailError) {
        console.error(`Erro ao enviar lembrete para ${assessment.fornecedor_email}:`, emailError);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processados ${assessments?.length || 0} assessments`,
      details: { total: assessments?.length || 0, success: successCount, errors: errorCount },
    }), {
      status: 200,
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
