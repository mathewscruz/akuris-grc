import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  risco_id: string;
  risco_nome: string;
  aprovador_id: string;
  solicitante_id: string;
  empresa_id: string;
  tipo: "solicitacao" | "aprovado" | "rejeitado";
  comentario?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: require valid JWT and matching empresa
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

    const { risco_id, risco_nome, aprovador_id, solicitante_id, empresa_id, tipo, comentario }: NotificationRequest = await req.json();

    const { data: callerProfile } = await supabase.from('profiles').select('empresa_id').eq('user_id', callerId).single();
    if (!callerProfile?.empresa_id || callerProfile.empresa_id !== empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Buscar dados do aprovador
    const { data: aprovador } = await supabase
      .from("profiles").select("nome, email").eq("user_id", aprovador_id).single();
    if (!aprovador?.email) {
      return new Response(JSON.stringify({ error: "Aprovador não encontrado" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Buscar dados do solicitante
    const { data: solicitante } = await supabase
      .from("profiles").select("nome, email").eq("user_id", solicitante_id).single();

    // Buscar empresa
    const { data: empresa } = await supabase
      .from("empresas").select("nome").eq("id", empresa_id).single();
    const companyName = empresa?.nome || "Akuris";

    const riscoLink = `https://akuris.com.br/riscos`;
    let destinatario = aprovador;
    let subject = "";
    let heading = "";
    let bodyText = "";
    let ctaText = "Acessar Risco";

    if (tipo === "solicitacao") {
      subject = `[Akuris] ✋ Solicitação de Aceite de Risco: ${risco_nome}`;
      heading = "✋ Solicitação de Aceite de Risco";
      bodyText = `<strong>${solicitante?.nome || "Um usuário"}</strong> solicita sua aprovação para aceitar formalmente o seguinte risco:`;
      ctaText = "Revisar e Decidir";
    } else if (tipo === "aprovado") {
      destinatario = solicitante!;
      subject = `[Akuris] ✅ Aceite de Risco Aprovado: ${risco_nome}`;
      heading = "✅ Aceite de Risco Aprovado";
      bodyText = `<strong>${aprovador.nome || "O aprovador"}</strong> aprovou o aceite formal do risco abaixo. Ele agora aparece no sub-módulo de Aceite de Risco.`;
      ctaText = "Ver Aceite de Risco";
    } else {
      destinatario = solicitante!;
      subject = `[Akuris] ❌ Aceite de Risco Rejeitado: ${risco_nome}`;
      heading = "❌ Aceite de Risco Rejeitado";
      bodyText = `<strong>${aprovador.nome || "O aprovador"}</strong> rejeitou o aceite formal do risco abaixo.${comentario ? ` <br/><strong>Motivo:</strong> ${comentario}` : ""}`;
      ctaText = "Ver Risco";
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0a1628; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: #0a1628; text-align: center; padding: 32px 32px 16px;">
      <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
    </div>
    <div style="height: 3px; background: linear-gradient(90deg, #7552ff, #5a3fd6, #7552ff);"></div>
    <div style="padding: 32px;">
      <h1 style="font-size: 22px; color: #0a1628; margin: 0 0 24px; font-weight: 600;">${heading}</h1>
      <p style="font-size: 15px; color: #3c4149; margin: 0 0 20px;">Olá <strong>${destinatario?.nome || "Usuário"}</strong>,</p>
      <p style="font-size: 15px; color: #3c4149; margin: 0 0 24px;">${bodyText}</p>
      <div style="background-color: #f0eeff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #7552ff;">
        <h2 style="font-size: 16px; color: #0a1628; margin: 0 0 8px; font-weight: 600;">${risco_nome}</h2>
        <p style="font-size: 14px; color: #64748b; margin: 0;">Empresa: ${companyName}</p>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${riscoLink}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">${ctaText}</a>
      </div>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Por favor, não responda a este e-mail.</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: "Akuris <noreply@akuris.com.br>",
      to: [destinatario?.email!],
      subject,
      html: htmlContent,
    });

    console.log(`E-mail de aceite de risco (${tipo}) enviado para ${destinatario?.email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: any) {
    console.error("Error in send-risco-aceite-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
