import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'send' | 'reminder' | 'completion' | 'invitation';
  assessment_id: string;
  template_nome?: string;
  empresa_nome?: string;
  empresa_logo_url?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // === AUTH: require valid Supabase JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabase
      .from('profiles').select('empresa_id, role').eq('user_id', userData.user.id).maybeSingle();
    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: EmailRequest = await req.json();
    const { type, assessment_id, template_nome: bodyTemplateNome } = body;

    if (!assessment_id) {
      return new Response(JSON.stringify({ error: 'assessment_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Load trusted assessment data server-side
    const { data: assessment, error: aerr } = await supabase
      .from('due_diligence_assessments')
      .select('id, empresa_id, fornecedor_nome, fornecedor_email, link_token, data_expiracao, template_id')
      .eq('id', assessment_id)
      .maybeSingle();

    if (aerr || !assessment) {
      return new Response(JSON.stringify({ error: 'Assessment não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isSuperAdmin = profile.role === 'super_admin';
    if (!isSuperAdmin && assessment.empresa_id !== profile.empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!assessment.fornecedor_email) {
      return new Response(JSON.stringify({ error: 'Fornecedor sem e-mail' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let template_nome = bodyTemplateNome || 'Due Diligence';
    if (assessment.template_id) {
      const { data: tpl } = await supabase
        .from('due_diligence_templates').select('nome').eq('id', assessment.template_id).maybeSingle();
      if (tpl?.nome) template_nome = tpl.nome;
    }

    const fornecedor_nome = assessment.fornecedor_nome || 'Fornecedor';
    const fornecedor_email = assessment.fornecedor_email;
    const data_expiracao = assessment.data_expiracao;
    const assessment_link = assessment.link_token
      ? `https://akuris.com.br/due-diligence/responder/${assessment.link_token}`
      : undefined;

    const sysName = 'Akuris';
    let emailContent: { subject: string; html: string };


    const headerHtml = `<div style="text-align: center; margin-bottom: 30px;"><img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" /></div>`;
    const footerHtml = `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;"><p style="color: #64748b; font-size: 14px;">Este é um e-mail automático da <strong>Akuris</strong>. Em caso de dúvidas, entre em contato conosco.</p><p style="color: #8898aa; font-size: 12px;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>`;

    switch (type) {
      case 'send':
      case 'invitation':
        emailContent = {
          subject: `Akuris - Te enviou uma avaliação de "${template_nome}"`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${headerHtml}<h1 style="color: #7552ff;">Questionário de Due Diligence</h1><p>Olá <strong>${fornecedor_nome}</strong>,</p><p>Você foi convidado(a) a responder um questionário de due diligence para <strong>${sysName}</strong>.</p><div style="background-color: #f0eeff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7552ff;"><h3 style="margin: 0 0 10px 0;">Template: ${template_nome}</h3><p style="margin: 0; color: #64748b;">Por favor, clique no link abaixo para acessar e responder o questionário.</p></div><div style="text-align: center; margin: 30px 0;"><a href="${assessment_link}" style="background-color: #7552ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Responder Questionário</a></div><p><strong>⏰ Prazo:</strong> ${data_expiracao ? new Date(data_expiracao).toLocaleString('pt-BR') : 'Conforme acordado'}</p>${footerHtml}</div>`
        };
        break;

      case 'reminder':
        emailContent = {
          subject: `Lembrete: ${sysName} - Avaliação de "${template_nome}"`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${headerHtml}<h1 style="color: #f59e0b;">Lembrete - Questionário Pendente</h1><p>Olá <strong>${fornecedor_nome}</strong>,</p><p>Este é um lembrete sobre o questionário de due diligence da <strong>${sysName}</strong> que ainda não foi respondido.</p><div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;"><h3 style="margin: 0 0 10px 0;">Template: ${template_nome}</h3><p style="margin: 0; color: #92400e;">O questionário ainda não foi respondido. Por favor, responda o quanto antes.</p></div><div style="text-align: center; margin: 30px 0;"><a href="${assessment_link}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Responder Agora</a></div><p><strong>⏰ Prazo:</strong> ${data_expiracao ? new Date(data_expiracao).toLocaleString('pt-BR') : 'Conforme acordado'}</p>${footerHtml}</div>`
        };
        break;

      case 'completion':
        emailContent = {
          subject: `${sysName} - Due Diligence Concluído - "${template_nome}"`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${headerHtml}<h1 style="color: #16a34a;">Questionário Concluído ✅</h1><p>Olá <strong>${fornecedor_nome}</strong>,</p><p>Confirmamos o recebimento das suas respostas para o questionário de due diligence da <strong>${sysName}</strong>:</p><div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;"><h3 style="margin: 0 0 10px 0;">Template: ${template_nome}</h3><p style="margin: 0; color: #166534;">✅ Questionário respondido com sucesso!</p></div><p>Obrigado pela sua colaboração. Suas respostas estão sendo analisadas.</p>${footerHtml}</div>`
        };
        break;

      default:
        throw new Error(`Tipo de e-mail inválido: ${type}. Tipos aceitos: send, invitation, reminder, completion`);
    }

    const emailResponse = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [fornecedor_email],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.data?.id }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Erro ao enviar e-mail:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)), success: false }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
