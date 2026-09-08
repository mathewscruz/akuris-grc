import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  item_id: string;
  auditoria_id: string;
  responsavel_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === AUTH: exige JWT válido de usuário autenticado do próprio tenant ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;
    const { data: callerProfile } = await supabase
      .from('profiles').select('empresa_id').eq('user_id', callerId).eq('ativo', true).maybeSingle();
    const callerEmpresaId = callerProfile?.empresa_id;
    if (!callerEmpresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { item_id, auditoria_id, responsavel_id }: NotificationRequest = await req.json();
    if (!item_id || !auditoria_id || !responsavel_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Valida que a auditoria pertence à empresa do chamador (impede envio cross-tenant)
    const { data: auditoria } = await supabase
      .from('auditorias').select('empresa_id, nome').eq('id', auditoria_id).maybeSingle();
    if (!auditoria || auditoria.empresa_id !== callerEmpresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden: auditoria não pertence à sua empresa' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // O conteúdo e o destinatário vêm do item já salvo, não de texto livre do
    // navegador. Isso também garante que o link enviado aponta para um item real.
    const { data: itemSalvo } = await supabase
      .from('auditoria_itens')
      .select('id, auditoria_id, responsavel_id, codigo, titulo, prazo')
      .is('controle_excluido_em', null)
      .eq('id', item_id)
      .maybeSingle();
    if (
      !itemSalvo ||
      itemSalvo.auditoria_id !== auditoria_id ||
      itemSalvo.responsavel_id !== responsavel_id
    ) {
      return new Response(JSON.stringify({ error: 'Forbidden: item ou responsável inválido' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const item_codigo = itemSalvo.codigo;
    const item_titulo = itemSalvo.titulo;
    const auditoria_nome = auditoria.nome;
    const prazo = itemSalvo.prazo;

    const { data: responsavel, error: responsavelError } = await supabase
      .from("profiles")
      .select("nome, email, empresa_id, notificar_por_email, notificar_na_aplicacao")
      .eq("user_id", responsavel_id)
      .eq('ativo', true)
      .single();
    if (responsavelError || !responsavel) throw new Error("Responsável não encontrado");

    // Responsável precisa estar na mesma empresa
    if (responsavel.empresa_id !== callerEmpresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden: responsável não pertence à sua empresa' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const itemLink = `/governanca/auditorias?focus=${item_id}`;
    let appSent = false;
    if (responsavel.notificar_na_aplicacao !== false) {
      const { error: appError } = await supabase.from("notifications").insert({
        user_id: responsavel_id,
        title: "Novo Item de Auditoria Atribuído",
        message: `Você foi designado como responsável pelo item "${item_codigo} - ${item_titulo}" na auditoria "${auditoria_nome}"`,
        type: "info",
        link_to: itemLink,
        metadata: { item_id, auditoria_id, tipo: "auditoria_item_atribuido" },
      });
      if (appError) throw appError;
      appSent = true;
    }

    if (responsavel.notificar_por_email === false) {
      return new Response(JSON.stringify({
        success: true,
        app_sent: appSent,
        email_sent: false,
        email_reason: "preference_disabled",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!responsavel.email) {
      return new Response(JSON.stringify({
        success: true,
        app_sent: appSent,
        email_sent: false,
        email_reason: "missing_address",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY ausente: item salvo, e-mail não enviado");
      return new Response(JSON.stringify({
        success: true,
        app_sent: appSent,
        email_sent: false,
        email_reason: "service_not_configured",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resend = new Resend(resendApiKey);
    const prazoFormatted = prazo ? new Date(prazo.length === 10 ? `${prazo}T00:00:00` : prazo).toLocaleDateString('pt-BR') : "Não definido";
    const appUrl = Deno.env.get("APP_URL") || "https://akuris.pt";
    const auditoriaLink = `${appUrl}${itemLink}`;

    const emailHtml = operationalEmail("audit", {
      name: responsavel.nome, item: item_titulo, code: item_codigo, audit: auditoria_nome, deadline: prazoFormatted, url: auditoriaLink
    });

    const { error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [responsavel.email],
      subject: `[Auditoria] Item atribuído: ${item_codigo} - ${item_titulo}`,
      html: sanitizeEmailDocument(emailHtml),
      text: htmlToText(emailHtml),
    });

    if (emailError) {
      console.error("Erro ao enviar e-mail:", emailError);
      throw emailError;
    }

    console.log(`Notificação enviada para ${responsavel.email}`);

    return new Response(JSON.stringify({ success: true, app_sent: appSent, email_sent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
