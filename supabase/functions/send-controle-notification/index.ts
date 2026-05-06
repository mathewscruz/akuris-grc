import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

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
    if (!resendApiKey) return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const resend = new Resend(resendApiKey);
    const { controle_id, controle_nome, controle_descricao, proxima_avaliacao, responsavel_id }: NotificationRequest = await req.json();

    if (!controle_id || !responsavel_id || !controle_nome) return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: responsavelData, error: responsavelError } = await supabase.from("profiles").select("nome, email, empresa_id").eq("user_id", responsavel_id).single();
    if (responsavelError || !responsavelData) return new Response(JSON.stringify({ error: "Responsible user not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    if (!responsavelData.email) return new Response(JSON.stringify({ error: "Responsible user has no email" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    let companyName = "Akuris";

    if (responsavelData.empresa_id) {
      const { data: empresaData } = await supabase.from("empresas").select("nome").eq("id", responsavelData.empresa_id).single();
      if (empresaData) { companyName = empresaData.nome || companyName; }
    }

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

    const emailResponse = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [responsavelData.email],
      subject: `[Akuris] Você foi designado como responsável: ${controle_nome}`,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    await supabase.from("notifications").insert({
      user_id: responsavel_id, type: "info", title: "Novo controle atribuído",
      message: `Você foi designado como responsável pelo controle: ${controle_nome}`,
      link_to: `/governanca?tab=controles&controle=${controle_id}`, read: false,
    });

    return new Response(JSON.stringify({ success: true, emailResponse }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-controle-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
