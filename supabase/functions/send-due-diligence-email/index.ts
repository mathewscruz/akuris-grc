import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'send' | 'reminder' | 'completion' | 'invitation';
  assessment_id: string;
  fornecedor_nome: string;
  fornecedor_email: string;
  template_nome: string;
  assessment_link?: string;
  data_expiracao?: string;
  empresa_nome?: string;
  empresa_logo_url?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, assessment_id, fornecedor_nome, fornecedor_email, template_nome, assessment_link, data_expiracao, empresa_nome, empresa_logo_url }: EmailRequest = await req.json();

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
