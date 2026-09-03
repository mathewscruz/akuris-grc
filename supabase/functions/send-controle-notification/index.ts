import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { requireUserContext, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  controle_id: string;
  controle_nome: string;
  controle_descricao?: string;
  proxima_avaliacao?: string;
  responsavel_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    /*
      Quem chama tem de pertencer à empresa do destinatário.

      O identificador do destinatário vinha do CORPO do pedido e era usado tal e
      qual contra um cliente de service_role, que ignora RLS. Qualquer
      utilizador autenticado podia notificar e mandar e-mail a qualquer pessoa
      de QUALQUER empresa, com texto à escolha, a partir do domínio de
      confiança da plataforma.
    */
    const ctx = await requireUserContext(req);

    const { controle_id, controle_nome, controle_descricao, proxima_avaliacao, responsavel_id }: NotificationRequest = await req.json();

    if (!controle_id || !responsavel_id || !controle_nome) return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: responsavelData, error: responsavelError } = await supabase
      .from("profiles")
      .select("nome, email, empresa_id, notificar_por_email, notificar_na_aplicacao")
      .eq("user_id", responsavel_id)
      .single();
    if (responsavelError || !responsavelData) return new Response(JSON.stringify({ error: "Responsible user not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    if (!ctx.empresaId || responsavelData.empresa_id !== ctx.empresaId) return new Response(JSON.stringify({ error: "Destinatário fora da sua empresa" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });

    // O aviso dentro do Akuris não depende do provedor de e-mail. Antes, uma
    // chave ausente ou uma rejeição do Resend impedia também esta notificação.
    let appSent = false;
    if (responsavelData.notificar_na_aplicacao !== false) {
      const { error: appError } = await supabase.from("notifications").insert({
        user_id: responsavel_id,
        type: "info",
        title: "Novo controle atribuído",
        message: `Você foi designado como responsável pelo controle: ${controle_nome}`,
        link_to: `/governanca?tab=controles&controle=${controle_id}`,
        read: false,
      });
      if (appError) throw appError;
      appSent = true;
    }

    if (responsavelData.notificar_por_email === false) {
      return new Response(JSON.stringify({
        success: true,
        app_sent: appSent,
        email_sent: false,
        email_reason: "preference_disabled",
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (!responsavelData.email) {
      return new Response(JSON.stringify({
        success: true,
        app_sent: appSent,
        email_sent: false,
        email_reason: "missing_address",
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (!resendApiKey) {
      console.error("RESEND_API_KEY ausente: controle salvo, e-mail não enviado");
      return new Response(JSON.stringify({
        success: true,
        app_sent: appSent,
        email_sent: false,
        email_reason: "service_not_configured",
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const resend = new Resend(resendApiKey);

    const formatDate = (dateStr?: string): string => {
      if (!dateStr) return "Não definida";
      try { return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return dateStr; }
    };

    const truncateDescription = (desc?: string): string => {
      if (!desc) return "Sem descrição";
      return desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
    };

    const controleLink = `https://akuris.com.br/governanca?tab=controles&controle=${controle_id}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0a1628; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
    </div>
    <h1 style="font-size: 22px; color: #0a1628; text-align: center; margin-bottom: 24px; font-weight: 600;">📋 Você foi designado como responsável</h1>
    <p style="font-size: 15px; margin-bottom: 20px;">Olá <strong>${responsavelData.nome || "Usuário"}</strong>,</p>
    <p style="font-size: 15px; margin-bottom: 24px;">Você foi designado como responsável pelo seguinte controle interno:</p>
    <div style="background-color: #f0eeff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #7552ff;">
      <h2 style="font-size: 16px; color: #0a1628; margin: 0 0 12px 0; font-weight: 600;">${controle_nome}</h2>
      <p style="font-size: 14px; color: #64748b; margin: 0 0 12px 0; white-space: pre-wrap;">${truncateDescription(controle_descricao)}</p>
      <div style="font-size: 13px; color: #475569;"><strong>📅 Vencimento da Avaliação:</strong> ${formatDate(proxima_avaliacao)}</div>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${controleLink}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Acessar Controle</a>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Por favor, não responda a este e-mail.</p>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [responsavelData.email],
      subject: `[Akuris] Você foi designado como responsável: ${controle_nome}`,
      html: htmlContent,
    });

    if (emailError) {
      console.error("Resend rejeitou o e-mail de atribuição do controle", emailError);
      return new Response(JSON.stringify({
        error: "Email provider rejected the message",
        app_sent: appSent,
        email_sent: false,
      }), { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    console.log("Email sent successfully:", emailData);
    return new Response(JSON.stringify({
      success: true,
      app_sent: appSent,
      email_sent: true,
      email_id: emailData?.id ?? null,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-controle-notification:", error);
    // Falha de autenticação responde 401/403, não 500.
    return authErrorResponse(error, corsHeaders);
  }
};

serve(handler);
