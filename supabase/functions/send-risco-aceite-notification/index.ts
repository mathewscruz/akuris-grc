import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";

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

    const { risco_id, aprovador_id, solicitante_id, empresa_id, tipo, comentario }: NotificationRequest = await req.json();

    const { data: callerProfile } = await supabase.from('profiles').select('empresa_id').eq('user_id', callerId).eq('ativo', true).single();
    if (!callerProfile?.empresa_id || callerProfile.empresa_id !== empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: risco } = await supabase.from('riscos').select('nome')
      .eq('id', risco_id).eq('empresa_id', empresa_id).maybeSingle();
    if (!risco) {
      return new Response(JSON.stringify({ error: 'Risco não encontrado' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const risco_nome = risco.nome;

    // Buscar dados do aprovador
    const { data: aprovador } = await supabase
      .from("profiles").select("nome, email").eq('notificar_por_email', true).eq('ativo', true)
      .eq('empresa_id', empresa_id).eq("user_id", aprovador_id).single();
    if (!aprovador?.email) {
      return new Response(JSON.stringify({ error: "Aprovador não encontrado" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Buscar dados do solicitante
    const { data: solicitante } = await supabase
      .from("profiles").select("nome, email").eq('notificar_por_email', true).eq('ativo', true)
      .eq('empresa_id', empresa_id).eq("user_id", solicitante_id).single();

    // Buscar empresa
    const { data: empresa } = await supabase
      .from("empresas").select("nome").eq("id", empresa_id).single();
    const companyName = empresa?.nome || "Akuris";

    const riscoLink = `https://akuris.pt/riscos`;
    let destinatario = aprovador;
    let subject = "";
    let heading = "";
    let bodyText = "";
    let ctaText = "Acessar Risco";

    if (tipo === "solicitacao") {
      subject = `[Akuris] Solicitação de Aceite de Risco: ${risco_nome}`;
      heading = "Solicitação de Aceite de Risco";
      bodyText = `${solicitante?.nome || "Um usuário"} solicita sua aprovação para aceitar formalmente o seguinte risco:`;
      ctaText = "Revisar e Decidir";
    } else if (tipo === "aprovado") {
      destinatario = solicitante!;
      subject = `[Aceite aprovado] ${risco_nome}`;
      heading = "Aceite de risco aprovado";
      bodyText = `${aprovador.nome || "O aprovador"} aprovou o aceite formal do risco abaixo. Ele agora aparece no sub-módulo de Aceite de Risco.`;
      ctaText = "Ver Aceite de Risco";
    } else {
      destinatario = solicitante!;
      subject = `[Akuris] Aceite de Risco Rejeitado: ${risco_nome}`;
      heading = "Aceite de Risco Rejeitado";
      bodyText = `${aprovador.nome || "O aprovador"} rejeitou o aceite formal do risco abaixo.${comentario ? ` Motivo: ${comentario}` : ""}`;
      ctaText = "Ver Risco";
    }

    if (!destinatario?.email) {
      return new Response(JSON.stringify({ error: "Destinatário não encontrado" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const htmlContent = operationalEmail("acceptance", {
      name: destinatario?.nome || "Usuário", item: risco_nome, heading, intro: bodyText, company: companyName, action: ctaText, url: riscoLink
    });

    await resend.emails.send({
      from: "Akuris <noreply@akuris.com.br>",
      to: [destinatario.email],
      subject,
      html: sanitizeEmailDocument(htmlContent),
      text: htmlToText(htmlContent),
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
