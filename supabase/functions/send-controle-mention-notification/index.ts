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

    /*
      Quem chama tem de pertencer à empresa do destinatário.

      O identificador do destinatário vinha do CORPO do pedido e era usado tal e
      qual contra um cliente de service_role, que ignora RLS. Qualquer
      utilizador autenticado podia notificar e mandar e-mail a qualquer pessoa
      de QUALQUER empresa, com texto à escolha, a partir do domínio de
      confiança da plataforma.
    */
    const ctx = await requireUserContext(req);

    const { user_id, controle_id, comentario }: MentionNotificationRequest = await req.json();

    if (!user_id || !controle_id || typeof comentario !== 'string' || comentario.length > 2_000) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: controle } = await supabase.from('controles').select('nome, empresa_id')
      .eq('id', controle_id).eq('empresa_id', ctx.empresaId).maybeSingle();
    if (!controle) {
      return new Response(JSON.stringify({ error: 'Controle não encontrado' }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    const controle_nome = controle.nome;

    const { data: usuario, error: usuarioError } = await supabase.from("profiles").select("nome, email, empresa_id")
      .eq('notificar_por_email', true).eq('ativo', true).eq("user_id", user_id).single();
    if (usuarioError || !usuario) throw new Error("Usuário não encontrado");
    if (!ctx.empresaId || usuario.empresa_id !== ctx.empresaId) {
      return new Response(JSON.stringify({ error: "Destinatário fora da sua empresa" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: autorMencao } = await supabase.from("profiles").select("nome")
      .eq('empresa_id', ctx.empresaId).eq('ativo', true).eq("user_id", ctx.userId).single();
    const autorNome = autorMencao?.nome || "Um usuário";

    const { data: empresa } = await supabase.from("empresas").select("nome, logo_url").eq("id", usuario.empresa_id).single();
    const companyName = empresa?.nome || "Akuris";

    const controleLink = `https://akuris.pt/governanca/controles?detalhe=${controle_id}`;
    const comentarioTruncado = comentario.length > 200 ? comentario.substring(0, 200) + "..." : comentario;

    const emailHtml = operationalEmail("controlMention", {
      name: usuario.nome, item: controle_nome, author: autorNome, description: comentarioTruncado, url: controleLink
    });

    const { error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [usuario.email],
      subject: `[Controle Interno] ${autorNome} mencionou você em "${controle_nome}"`,
      html: sanitizeEmailDocument(emailHtml),
      text: htmlToText(emailHtml),
    });

    if (emailError) throw emailError;

    console.log(`E-mail de menção enviado para ${usuario.email}`);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Erro na função:", error);
    // Falha de autenticação responde 401/403, não 500.
    return authErrorResponse(error, corsHeaders);
  }
});
