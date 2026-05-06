import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MentionNotificationRequest {
  user_id: string;
  controle_id: string;
  controle_nome: string;
  mencionado_por: string;
  comentario: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { user_id, controle_id, controle_nome, mencionado_por, comentario }: MentionNotificationRequest = await req.json();

    const { data: usuario, error: usuarioError } = await supabase.from("profiles").select("nome, email, empresa_id").eq("user_id", user_id).single();
    if (usuarioError || !usuario) throw new Error("Usuário não encontrado");

    const { data: autorMencao } = await supabase.from("profiles").select("nome").eq("user_id", mencionado_por).single();
    const autorNome = autorMencao?.nome || "Um usuário";

    const { data: empresa } = await supabase.from("empresas").select("nome, logo_url").eq("id", usuario.empresa_id).single();
    const companyName = empresa?.nome || "Akuris";

    const controleLink = `https://akuris.com.br/controles?detalhe=${controle_id}`;
    const comentarioTruncado = comentario.length > 200 ? comentario.substring(0, 200) + "..." : comentario;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <tr><td style="padding: 32px; text-align: center; border-bottom: 1px solid #e2e8f0;">
          <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
        </td></tr>
        <tr><td style="padding: 32px;">
          <h1 style="color: #0a1628; margin: 0 0 24px 0; font-size: 24px;">💬 Você foi mencionado em um comentário</h1>
          <p style="color: #3c4149; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Olá <strong>${usuario.nome}</strong>,</p>
          <p style="color: #3c4149; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;"><strong>${autorNome}</strong> mencionou você em um comentário no controle interno <strong>"${controle_nome}"</strong>.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0eeff; border-radius: 8px; border-left: 4px solid #7552ff; margin: 24px 0;">
            <tr><td style="padding: 20px;">
              <p style="margin: 0 0 8px 0; color: #7552ff; font-size: 14px; font-weight: 600;">Comentário:</p>
              <p style="margin: 0; color: #0a1628; font-size: 14px; line-height: 1.6; font-style: italic;">"${comentarioTruncado}"</p>
            </td></tr>
          </table>
          <p style="color: #3c4149; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">Clique no botão abaixo para visualizar o controle e responder ao comentário.</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${controleLink}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Ver Controle</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding: 24px 32px; background-color: #f5f7fa; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="margin: 0; color: #8898aa; font-size: 12px;">Esta é uma mensagem automática do sistema Akuris.</p>
          <p style="margin: 8px 0 0 0; color: #8898aa; font-size: 12px;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [usuario.email],
      subject: `[Controle Interno] ${autorNome} mencionou você em "${controle_nome}"`,
      html: emailHtml,
    });

    if (emailError) throw emailError;

    console.log(`E-mail de menção enviado para ${usuario.email}`);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
