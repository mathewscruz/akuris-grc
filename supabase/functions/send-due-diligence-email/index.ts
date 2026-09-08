import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendIdempotentEmail } from '../_shared/idempotent-email.ts';
import { utcDay } from '../_shared/scheduled-job.ts';

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
    /*
      Duas origens legítimas: uma pessoa com sessão, e o processador diário de
      lembretes (por dentro, com a chave de serviço).

      Só a sessão era aceite: validava-se o token com `auth.getUser()`, e uma
      chave de serviço NÃO é um JWT de utilizador -- devolvia 401. Era por isso
      que o lembrete de expiração nunca chegava a sair, mesmo depois de alguém
      agendar a função.
    */
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '').trim();
    const chamadaInterna = token === supabaseServiceKey;

    let userData: { user: { id: string } } | null = null;
    if (!chamadaInterna) {
      const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey);
      const { data, error: userErr } = await verifier.auth.getUser(token);
      if (userErr || !data?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userData = data as any;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let profile: { empresa_id: string | null; role: string | null } | null = null;
    if (!chamadaInterna) {
      const { data } = await supabase
        .from('profiles').select('empresa_id, role').eq('user_id', userData!.user.id).eq('ativo', true).maybeSingle();
      profile = data as any;
      if (!profile?.empresa_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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

    // A chamada interna não tem inquilino próprio: o processador diário já
    // percorre empresa a empresa. A verificação vale para quem tem sessão.
    const isSuperAdmin = chamadaInterna || profile!.role === 'super_admin';
    if (!isSuperAdmin && assessment.empresa_id !== profile!.empresa_id) {
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
    const siteUrl = Deno.env.get('SITE_URL') || 'https://akuris.pt';
    const assessment_link = assessment.link_token
      ? `${siteUrl}/assessment/${assessment.link_token}`
      : undefined;

    const sysName = 'Akuris';
    let emailContent: { subject: string; html: string };



    switch (type) {
      case 'send':
      case 'invitation':
        emailContent = {
          subject: `Akuris - Te enviou uma avaliação de "${template_nome}"`,
          html: operationalEmail("dueDiligence", { name: fornecedor_nome, item: template_nome, company: sysName, status: "invitation", deadline: data_expiracao ? new Date(data_expiracao).toLocaleString("pt-BR") : "Conforme acordado", url: assessment_link })
        };
        break;

      case 'reminder':
        emailContent = {
          subject: `Lembrete: ${sysName} - Avaliação de "${template_nome}"`,
          html: operationalEmail("dueDiligence", { name: fornecedor_nome, item: template_nome, company: sysName, status: "reminder", deadline: data_expiracao ? new Date(data_expiracao).toLocaleString("pt-BR") : "Conforme acordado", url: assessment_link })
        };
        break;

      case 'completion':
        emailContent = {
          subject: `${sysName} - Due Diligence Concluído - "${template_nome}"`,
          html: operationalEmail("dueDiligence", { name: fornecedor_nome, item: template_nome, company: sysName, status: "completed", deadline: data_expiracao ? new Date(data_expiracao).toLocaleString("pt-BR") : "Conforme acordado", url: assessment_link })
        };
        break;

      default:
        throw new Error(`Tipo de e-mail inválido: ${type}. Tipos aceitos: send, invitation, reminder, completion`);
    }

    const payload = {
      from: 'Akuris <noreply@akuris.com.br>',
      to: [fornecedor_email],
      subject: emailContent.subject,
      html: sanitizeEmailDocument(emailContent.html),
      text: htmlToText(emailContent.html),
    };

    if (type === 'reminder') {
      const delivered = await sendIdempotentEmail(payload,
        `dd-reminder/${assessment.id}/${utcDay()}`, Deno.env.get('RESEND_API_KEY') || '');
      return new Response(JSON.stringify({ success: true, messageId: delivered.id }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const emailResponse = await resend.emails.send(payload);
    if (emailResponse.error || !emailResponse.data?.id) throw new Error('Email delivery failed');

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.data?.id }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Erro ao enviar e-mail:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)), success: false }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
