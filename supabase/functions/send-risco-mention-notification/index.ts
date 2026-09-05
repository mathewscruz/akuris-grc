import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@6.26.0";
import { APP_URL, EMAIL_FROM, emailDocument, escapeHtml, htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";
import { authErrorResponse, requireUserContext } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const ctx = await requireUserContext(req);
    if (!ctx.empresaId) return json({ error: "Usuário sem empresa" }, 403);
    const { user_id, risco_id, comentario_id } = await req.json();
    if (![user_id, risco_id, comentario_id].every((value) => typeof value === "string" && UUID.test(value))) {
      return json({ error: "Payload inválido" }, 400);
    }

    // O texto, o autor e a lista de menções vêm do banco. Assim o cliente não
    // consegue usar o remetente Akuris para enviar conteúdo arbitrário.
    const { data: comentario, error: comentarioError } = await ctx.supabase
      .from("riscos_comentarios")
      .select("id, risco_id, user_id, comentario, mencoes")
      .eq("id", comentario_id)
      .eq("risco_id", risco_id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (comentarioError) throw comentarioError;
    if (!comentario || !Array.isArray(comentario.mencoes) || !comentario.mencoes.includes(user_id)) {
      return json({ error: "Menção não encontrada" }, 404);
    }

    const { data: risco, error: riscoError } = await ctx.supabase
      .from("riscos")
      .select("nome, empresa_id")
      .eq("id", risco_id)
      .eq("empresa_id", ctx.empresaId)
      .maybeSingle();
    if (riscoError) throw riscoError;
    if (!risco) return json({ error: "Risco não encontrado" }, 404);

    const { data: destinatario, error: destinatarioError } = await ctx.supabase
      .from("profiles")
      .select("nome, email, empresa_id, ativo, notificar_por_email")
      .eq("user_id", user_id)
      .eq("empresa_id", ctx.empresaId)
      .maybeSingle();
    if (destinatarioError) throw destinatarioError;
    if (!destinatario?.ativo) return json({ error: "Destinatário não encontrado" }, 404);
    if (!destinatario.notificar_por_email || !destinatario.email || user_id === ctx.userId) {
      return json({ success: true, skipped: true });
    }

    const { data: autor } = await ctx.supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", ctx.userId)
      .eq("empresa_id", ctx.empresaId)
      .maybeSingle();

    const autorNome = String(autor?.nome || "Uma pessoa da sua equipe").replace(/[\r\n]+/g, " ").slice(0, 120);
    const riscoNome = String(risco.nome || "Risco").replace(/[\r\n]+/g, " ").slice(0, 160);
    const textoComentario = String(comentario.comentario || "").slice(0, 500);
    const link = `${APP_URL}/riscos?view=table&risco=${encodeURIComponent(risco_id)}`;
    const html = emailDocument("Você foi mencionado em um risco", `
      <p style="margin:0 0 18px;color:#3c4657">Olá <strong>${escapeHtml(destinatario.nome || "")}</strong>,</p>
      <p style="margin:0 0 18px;color:#3c4657"><strong>${escapeHtml(autorNome)}</strong> mencionou você em um comentário no risco <strong>${escapeHtml(riscoNome)}</strong>.</p>
      <div style="margin:22px 0;padding:18px 20px;border-left:3px solid #7552ff;background:#f7f5ff;border-radius:6px;color:#283246">${escapeHtml(textoComentario)}</div>
      <p style="margin:26px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:7px;background:#7552ff;color:#fff;text-decoration:none;font-weight:700">Abrir risco</a></p>
    `, { eyebrow: "Gestão de riscos" });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY não configurada");
    const resend = new Resend(resendApiKey);
    const { error: emailError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [destinatario.email],
      subject: `[Risco] ${autorNome} mencionou você em "${riscoNome}"`,
      html: sanitizeEmailDocument(html),
      text: htmlToText(html),
    }, { idempotencyKey: `risk-mention-${comentario_id}-${user_id}` });
    if (emailError) throw emailError;

    return json({ success: true });
  } catch (error) {
    console.error("send-risco-mention-notification", error);
    return authErrorResponse(error, corsHeaders);
  }
});
