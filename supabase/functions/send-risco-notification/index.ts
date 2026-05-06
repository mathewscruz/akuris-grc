import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest { risco_id: string; titulo: string; descricao?: string; probabilidade: number; impacto: number; categoria?: string; responsavel_id: string; empresa_id: string; }

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const resend = new Resend(resendApiKey);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { risco_id, titulo, descricao, probabilidade, impacto, categoria, responsavel_id, empresa_id }: NotificationRequest = await req.json();

    const { data: responsavelData, error: responsavelError } = await supabase.from("profiles").select("nome, email, empresa_id").eq("user_id", responsavel_id).single();
    if (responsavelError || !responsavelData?.email) return new Response(JSON.stringify({ error: "Responsável não encontrado ou sem email" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    let companyName = "Akuris";
    const { data: empresaData } = await supabase.from("empresas").select("nome").eq("id", empresa_id).single();
    if (empresaData) { companyName = empresaData.nome || companyName; }

    const nivelRisco = probabilidade * impacto;
    const getNivelConfig = (nivel: number) => {
      if (nivel >= 20) return { color: "#dc2626", bg: "#fef2f2", text: "Crítico", icon: "🔴" };
      if (nivel >= 12) return { color: "#f97316", bg: "#fff7ed", text: "Alto", icon: "🟠" };
      if (nivel >= 6) return { color: "#f59e0b", bg: "#fffbeb", text: "Médio", icon: "🟡" };
      return { color: "#7552ff", bg: "#f0eeff", text: "Baixo", icon: "🟢" };
    };
    const config = getNivelConfig(nivelRisco);
    const truncateText = (text?: string, maxLength = 300): string => { if (!text) return "Sem descrição"; return text.length > maxLength ? text.substring(0, maxLength) + "..." : text; };
    const riscoLink = `https://akuris.com.br/riscos?risco=${risco_id}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0a1628; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="text-align: center; padding: 32px 32px 16px; border-bottom: 1px solid #e2e8f0;">
      <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
    </div>
    <div style="padding: 32px;">
      <h1 style="font-size: 22px; color: #0a1628; margin: 0 0 8px; font-weight: 600;">📊 Risco Atribuído a Você</h1>
      <p style="font-size: 15px; color: #64748b; margin: 0 0 24px;">Olá <strong>${responsavelData.nome || 'Usuário'}</strong>, você foi designado como responsável por um novo risco.</p>
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 10px 24px; background-color: ${config.bg}; color: ${config.color}; border-radius: 8px; font-weight: 700; font-size: 14px; border: 2px solid ${config.color};">${config.icon} Nível de Risco: ${config.text} (${nivelRisco})</span>
      </div>
      <div style="background-color: ${config.bg}; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${config.color};">
        <h2 style="font-size: 16px; color: #0a1628; margin: 0 0 12px; font-weight: 600;">${titulo}</h2>
        <div style="display: grid; gap: 8px; margin-bottom: 12px;">
          <div style="font-size: 14px; color: #475569;"><strong>Probabilidade:</strong> ${probabilidade}/5</div>
          <div style="font-size: 14px; color: #475569;"><strong>Impacto:</strong> ${impacto}/5</div>
          ${categoria ? `<div style="font-size: 14px; color: #475569;"><strong>Categoria:</strong> ${categoria}</div>` : ''}
        </div>
        ${descricao ? `<p style="font-size: 14px; color: #475569; margin: 12px 0 0; white-space: pre-wrap;">${truncateText(descricao)}</p>` : ''}
      </div>
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="font-size: 12px; color: #64748b; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Posição na Matriz de Riscos</p>
        <p style="font-size: 24px; color: #0a1628; margin: 0; font-weight: 700;">P${probabilidade} × I${impacto} = ${nivelRisco}</p>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${riscoLink}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Gerenciar Risco</a>
      </div>
      <div style="background-color: #f0eeff; border-radius: 8px; padding: 16px; border-left: 4px solid #7552ff;">
        <p style="font-size: 13px; color: #5a3fd6; margin: 0;"><strong>Próximos Passos:</strong> Avalie o risco, defina planos de tratamento e acompanhe a evolução através do sistema.</p>
      </div>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Por favor, não responda a este e-mail.</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    const emailResponse = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [responsavelData.email], subject: `[Akuris] ${config.icon} Risco Atribuído: ${titulo}`, html: htmlContent });
    console.log("E-mail enviado com sucesso:", emailResponse);

    await supabase.from("notifications").insert({ user_id: responsavel_id, type: nivelRisco >= 12 ? "warning" : "info", title: "Novo risco atribuído", message: `Você é responsável pelo risco: ${titulo} (Nível ${config.text})`, link_to: `/riscos?risco=${risco_id}`, read: false });

    return new Response(JSON.stringify({ success: true, emailResponse }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-risco-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
