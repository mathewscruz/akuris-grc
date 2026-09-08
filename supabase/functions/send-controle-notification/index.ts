import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";
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

    const { controle_id, responsavel_id }: NotificationRequest = await req.json();

    if (!controle_id || !responsavel_id) return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: responsavelData, error: responsavelError } = await supabase
      .from("profiles")
      .select("nome, email, empresa_id, notificar_por_email, notificar_na_aplicacao")
      .eq("user_id", responsavel_id)
      .eq('ativo', true)
      .single();
    if (responsavelError || !responsavelData) return new Response(JSON.stringify({ error: "Responsible user not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    if (!ctx.empresaId || responsavelData.empresa_id !== ctx.empresaId) return new Response(JSON.stringify({ error: "Destinatário fora da sua empresa" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const { data: controle } = await supabase.from('controles')
      .select('nome, descricao, proxima_avaliacao')
      .eq('id', controle_id).eq('empresa_id', ctx.empresaId).maybeSingle();
    if (!controle) return new Response(JSON.stringify({ error: 'Controle não encontrado' }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    const controle_nome = controle.nome;
    const controle_descricao = controle.descricao || undefined;
    const proxima_avaliacao = controle.proxima_avaliacao || undefined;

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

    const controleLink = `https://akuris.pt/governanca/controles?controle=${controle_id}`;

    const htmlContent = operationalEmail("control", {
      name: responsavelData.nome || "Usuário", item: controle_nome, description: truncateDescription(controle_descricao), deadline: formatDate(proxima_avaliacao), url: controleLink
    });

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [responsavelData.email],
      subject: `[Akuris] Você foi designado como responsável: ${controle_nome}`,
      html: sanitizeEmailDocument(htmlContent),
      text: htmlToText(htmlContent),
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
