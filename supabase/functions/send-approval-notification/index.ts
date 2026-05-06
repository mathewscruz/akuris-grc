import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  documento_id: string;
  aprovador_id: string;
  solicitante_id: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require valid JWT and verify caller belongs to the document's empresa
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const callerId = userData.user.id as string;

    const { documento_id, aprovador_id, solicitante_id }: NotificationRequest = await req.json();

    if (!documento_id || !aprovador_id || !solicitante_id) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify caller belongs to the same empresa as the document
    const { data: callerProfile } = await supabase
      .from('profiles').select('empresa_id').eq('user_id', callerId).single();
    const { data: docCheck } = await supabase
      .from('documentos').select('empresa_id').eq('id', documento_id).single();
    if (!callerProfile?.empresa_id || !docCheck?.empresa_id || callerProfile.empresa_id !== docCheck.empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log("Enviando notificação de aprovação:", { documento_id, aprovador_id, solicitante_id });

    const { data: solicitante, error: solicitanteError } = await supabase
      .from('profiles').select('nome').eq('user_id', solicitante_id).single();
    if (solicitanteError || !solicitante) throw new Error("Solicitante não encontrado");

    const { data: aprovador, error: aprovadorError } = await supabase
      .from('profiles').select('nome, email').eq('user_id', aprovador_id).single();
    if (aprovadorError || !aprovador) throw new Error("Aprovador não encontrado");

    const { data: document, error: docError } = await supabase
      .from('documentos').select('nome, empresa_id').eq('id', documento_id).single();
    if (docError || !document) throw new Error("Documento não encontrado");

    const { data: empresa } = await supabase
      .from('empresas').select('nome, logo_url').eq('id', document.empresa_id).single();

    const companyName = empresa?.nome || "Akuris";

    const emailResponse = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [aprovador.email],
      subject: `[Akuris] Solicitação de Aprovação: ${document.nome}`,
      html: `
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
      <h1 style="font-size: 22px; color: #0a1628; margin: 0 0 24px; font-weight: 600;">📄 Solicitação de Aprovação</h1>
      <p style="font-size: 15px; color: #3c4149; margin: 0 0 20px;">Olá <strong>${aprovador.nome}</strong>,</p>
      <p style="font-size: 15px; color: #3c4149; margin: 0 0 24px;"><strong>${solicitante.nome}</strong> solicitou sua aprovação para o seguinte documento:</p>
      <div style="background-color: #f0eeff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #7552ff;">
        <h2 style="font-size: 16px; color: #0a1628; margin: 0 0 8px; font-weight: 600;">${document.nome}</h2>
        <p style="font-size: 14px; color: #64748b; margin: 0;">Empresa: ${companyName}</p>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://akuris.com.br/documentos?aprovar=${documento_id}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Revisar e Aprovar</a>
      </div>
      <p style="font-size: 14px; color: #64748b; text-align: center;">Acesse o sistema para revisar o documento e tomar sua decisão.</p>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Por favor, não responda a este e-mail.</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`,
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(JSON.stringify({ success: true, message: "Notificação enviada com sucesso", emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erro na função send-approval-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)), success: false }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
