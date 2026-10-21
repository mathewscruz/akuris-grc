// E-mail ao novo responsável de um framework do Gap Analysis.
// Chamado pelo app depois de atribuir; só envia se o registo existir na empresa de quem chama.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { notificationEmail } from "../_shared/email-brand.ts";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";
import { requireUserContext, authErrorResponse } from "../_shared/auth.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const ctx = await requireUserContext(req);
    const { framework_id } = await req.json().catch(() => ({}));
    if (typeof framework_id !== "string" || !/^[0-9a-f-]{36}$/i.test(framework_id)) return json({ error: "framework_id inválido" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dono } = await db.from("gap_analysis_framework_owners").select("user_id, atribuido_por")
      .eq("empresa_id", ctx.empresaId).eq("framework_id", framework_id).maybeSingle();
    if (!dono || dono.user_id === ctx.userId) return json({ enviado: false });
    const [{ data: fw }, { data: dest }, { data: autor }] = await Promise.all([
      db.from("gap_analysis_frameworks").select("nome, versao").eq("id", framework_id).maybeSingle(),
      db.from("profiles").select("nome, email, empresa_id, notificar_por_email").eq("user_id", dono.user_id).eq("ativo", true).maybeSingle(),
      db.from("profiles").select("nome, email").eq("user_id", ctx.userId).maybeSingle(),
    ]);
    if (!fw || !dest || dest.empresa_id !== ctx.empresaId) return json({ enviado: false });
    const key = Deno.env.get("RESEND_API_KEY");
    if (dest.notificar_por_email === false || !dest.email || !key) return json({ enviado: false, motivo: "email_indisponivel" });
    const quem = autor?.nome || autor?.email || "Um administrador";
    const html = notificationEmail({
      name: dest.nome || "Usuário", item: `${fw.nome}${fw.versao ? " " + fw.versao : ""}`, locale: "pt",
      title: "Você é responsável por um framework", module: "Gap Analysis",
      intro: `${quem} designou você como responsável pelo framework abaixo.`,
      fields: [["Atribuído por", quem]],
      next: "Abra o framework para acompanhar a aderência e os requisitos sob sua responsabilidade.",
      action: { label: "Abrir framework", url: `https://akuris.pt/gap-analysis/framework/${framework_id}` },
    });
    const { error } = await new Resend(key).emails.send({
      from: "Akuris <noreply@akuris.com.br>", to: [dest.email],
      subject: `[Akuris] Você é responsável pelo framework ${fw.nome}`,
      html: sanitizeEmailDocument(html), text: htmlToText(html),
    });
    if (error) { console.error("Resend rejeitou", error); return json({ enviado: false, motivo: "provedor" }, 502); }
    return json({ enviado: true });
  } catch (e) {
    return authErrorResponse(e, cors);
  }
});
