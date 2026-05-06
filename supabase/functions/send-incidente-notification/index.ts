import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest { incidente_id: string; titulo: string; descricao?: string; gravidade: string; tipo: string; responsavel_id?: string; empresa_id: string; }

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: require valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: userData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const callerId = userData.user.id as string;

    const { incidente_id, titulo, descricao, gravidade, tipo, responsavel_id, empresa_id }: NotificationRequest = await req.json();

    // Verify caller belongs to the same empresa
    const { data: callerProfile } = await supabase.from('profiles').select('empresa_id').eq('user_id', callerId).single();
    if (!callerProfile?.empresa_id || callerProfile.empresa_id !== empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    let companyName = "Akuris";
    const { data: empresaData } = await supabase.from("empresas").select("nome").eq("id", empresa_id).single();
    if (empresaData) { companyName = empresaData.nome || companyName; }

    const emailList = new Set<string>();
    const { data: admins } = await supabase.from("profiles").select("email, nome").eq("empresa_id", empresa_id).in("role", ["admin", "super_admin"]);
    admins?.forEach(admin => { if (admin.email) emailList.add(admin.email); });

    let responsavelNome = "";
    if (responsavel_id) {
      const { data: responsavel } = await supabase.from("profiles").select("email, nome").eq("user_id", responsavel_id).single();
      if (responsavel?.email) { emailList.add(responsavel.email); responsavelNome = responsavel.nome || ""; }
    }

    if (emailList.size === 0) return new Response(JSON.stringify({ success: true, message: "Nenhum destinatário" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const gravidadeConfig: Record<string, { color: string; bg: string; text: string }> = {
      baixa: { color: "#7552ff", bg: "#f0eeff", text: "Baixa" },
      media: { color: "#f59e0b", bg: "#fffbeb", text: "Média" },
      alta: { color: "#f97316", bg: "#fff7ed", text: "Alta" },
      critica: { color: "#dc2626", bg: "#fef2f2", text: "Crítica" },
    };
    const config = gravidadeConfig[gravidade] || gravidadeConfig.media;
    const truncateText = (text?: string, maxLength = 300): string => { if (!text) return "Sem descrição"; return text.length > maxLength ? text.substring(0, maxLength) + "..." : text; };
    const incidenteLink = `https://akuris.com.br/incidentes?incidente=${incidente_id}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0a1628; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: ${config.color}; padding: 16px 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">⚠️ Incidente ${config.text}</span>
    </div>
    <div style="text-align: center; padding: 24px 32px 16px;">
      <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
    </div>
    <div style="padding: 0 32px 32px;">
      <h1 style="font-size: 22px; color: #0a1628; margin: 0 0 24px; font-weight: 600;">Novo Incidente Registrado</h1>
      <div style="background-color: ${config.bg}; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${config.color};">
        <h2 style="font-size: 16px; color: #0a1628; margin: 0 0 12px; font-weight: 600;">${titulo}</h2>
        <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;"><strong>Tipo:</strong> ${tipo}</div>
        <div style="font-size: 14px; color: #64748b; margin-bottom: 12px;"><strong>Gravidade:</strong> <span style="display: inline-block; padding: 2px 10px; background-color: ${config.color}20; color: ${config.color}; border-radius: 4px; font-weight: 600; font-size: 12px;">${config.text}</span></div>
        ${descricao ? `<p style="font-size: 14px; color: #475569; margin: 12px 0 0; white-space: pre-wrap;">${truncateText(descricao)}</p>` : ''}
      </div>
      ${responsavelNome ? `<div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;"><p style="font-size: 13px; color: #64748b; margin: 0;"><strong>Responsável designado:</strong> ${responsavelNome}</p></div>` : ''}
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${incidenteLink}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Ver Detalhes do Incidente</a>
      </div>
      <div style="background-color: #fffbeb; border-radius: 8px; padding: 16px; border-left: 4px solid #f59e0b;">
        <p style="font-size: 13px; color: #92400e; margin: 0;"><strong>Ação Requerida:</strong> Este incidente requer atenção imediata.</p>
      </div>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Por favor, não responda a este e-mail.</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    const emailPromises = Array.from(emailList).map(async (email) => {
      try {
        const { error: emailError } = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [email], subject: `[Akuris] ⚠️ Incidente ${config.text}: ${titulo}`, html: htmlContent });
        if (emailError) return { email, success: false, error: emailError };
        return { email, success: true };
      } catch (error) { return { email, success: false, error }; }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    if (responsavel_id) {
      await supabase.from("notifications").insert({ user_id: responsavel_id, type: gravidade === "critica" ? "error" : "warning", title: `Incidente ${config.text} Registrado`, message: `Novo incidente: ${titulo}`, link_to: `/incidentes?incidente=${incidente_id}`, read: false });
    }

    return new Response(JSON.stringify({ success: true, sent: successCount, total: results.length }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-incidente-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
