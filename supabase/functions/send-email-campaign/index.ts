import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@6.26.0";
import React from "npm:react@18.3.1";
import { Link, renderAsync } from "npm:@react-email/components@0.0.22";
import { BaseEmailTemplate } from "../_shared/email-templates/BaseEmailTemplate.tsx";
import { authCorsHeaders } from "../_shared/cors.ts";
import { APP_URL, EMAIL_FROM, htmlToText, sanitizeEmailHtml } from "../_shared/email.ts";
import { requireUserContext, requireValidMfa, authErrorResponse } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const stripTestePrefix = (value: unknown) => String(value ?? "").replace(/\[\s*teste\s*\]\s*/gi, "").trim();
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...authCorsHeaders(req), "Content-Type": "application/json" },
});

function content(imageUrl: string | null, safeHtml: string) {
  return React.createElement("div", null,
    imageUrl ? React.createElement("img", {
      src: imageUrl, alt: "", width: "512",
      style: { display: "block", width: "100%", maxWidth: "512px", height: "auto", borderRadius: "8px", margin: "0 0 24px" },
    }) : null,
    React.createElement("div", { style: { color: "#2d3748", fontSize: "15px", lineHeight: "26px" }, dangerouslySetInnerHTML: { __html: safeHtml } }),
  );
}

type Recipient = { user_id: string; email: string; email_unsubscribe_token: string };
type Log = {
  campanha_id: string; recipient_id: string; email: string; status: string; erro?: string;
  provider_id?: string; idempotency_key: string; accepted_at?: string;
};

async function deliver(campaign: any, recipient: Recipient, subject: string, isTest: boolean): Promise<Log> {
  const idempotencyKey = isTest ? `test-${campaign.id}-${crypto.randomUUID()}` : `campaign-${campaign.id}-${recipient.user_id}`;
  const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe-email?token=${recipient.email_unsubscribe_token}`;
  const safeHtml = sanitizeEmailHtml(campaign.conteudo_html);
  const html = await renderAsync(React.createElement(BaseEmailTemplate, {
    previewText: subject,
    title: subject,
    children: content(campaign.imagem_url, safeHtml),
    footerNote: React.createElement(React.Fragment, null,
      "Você recebeu este comunicado por usar a Akuris. ",
      React.createElement(Link, { href: unsubscribeUrl, style: { color: "#7552ff" } }, "Gerenciar comunicados"),
      ".",
    ),
  }));

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [recipient.email],
      subject,
      html,
      text: `${subject}\n\n${htmlToText(safeHtml)}\n\nGerenciar comunicados: ${unsubscribeUrl}\nAkuris: ${APP_URL}`,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }, { idempotencyKey });
    if (error) throw new Error(String(error.message || error));
    return {
      campanha_id: campaign.id,
      recipient_id: recipient.user_id,
      email: recipient.email,
      status: isTest ? "test_sent" : "accepted",
      provider_id: data?.id,
      idempotency_key: idempotencyKey,
      accepted_at: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      campanha_id: campaign.id,
      recipient_id: recipient.user_id,
      email: recipient.email,
      status: isTest ? "test_failed" : "failed",
      erro: error?.message || String(error),
      idempotency_key: idempotencyKey,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: authCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Método não permitido" }, 405);
  let campaignId: string | undefined;
  let isTest = false;
  try {
    const ctx = await requireUserContext(req);
    await requireValidMfa(ctx);
    if (ctx.role !== 'super_admin') return json(req, { error: "Apenas super admins" }, 403);
    const userId = ctx.userId;

    if (Number(req.headers.get('content-length') || 0) > 32 * 1024) {
      return json(req, { error: 'Payload muito grande' }, 413);
    }

    const body = await req.json();
    campaignId = body.campanha_id;
    isTest = body.mode === "test";
    if (!campaignId) return json(req, { error: "campanha_id obrigatório" }, 400);

    const { data: campaign, error: campaignError } = await supabase.from("email_campanhas").select("*").eq("id", campaignId).maybeSingle();
    if (campaignError || !campaign) return json(req, { error: "Campanha não encontrada" }, 404);

    if (!isTest) {
      const { data: claimed, error } = await supabase.from("email_campanhas")
        .update({ status: "enviando", erro: null, total_enviados: 0, total_falhados: 0, total_entregues: 0, total_rejeitados: 0, total_reclamacoes: 0 })
        .eq("id", campaignId).eq("status", "rascunho").select("id").maybeSingle();
      if (error) throw error;
      if (!claimed) return json(req, { error: "Campanha já enviada ou em envio" }, 409);
    }

    let recipients: Recipient[] = [];
    if (isTest) {
      const { data } = await supabase.from("profiles").select("user_id,email,email_unsubscribe_token").eq("user_id", userId).maybeSingle();
      if (data?.email) recipients = [data as Recipient];
    } else {
      const { data, error } = await supabase.from("profiles")
        .select("user_id,email,email_unsubscribe_token")
        .eq("ativo", true).eq("receber_comunicados", true).not("email", "is", null);
      if (error) throw error;
      const seen = new Set<string>();
      recipients = (data ?? []).filter((item: any) => {
        const email = String(item.email ?? "").trim().toLowerCase();
        if (!email.includes("@") || seen.has(email)) return false;
        item.email = email;
        seen.add(email);
        return true;
      }) as Recipient[];
    }
    if (!recipients.length) throw new Error(isTest ? "Seu perfil não possui e-mail válido para teste" : "Nenhum destinatário consentiu em receber comunicados");

    if (!isTest) await supabase.from("email_campanhas").update({ total_destinatarios: recipients.length }).eq("id", campaignId);
    const subject = stripTestePrefix(campaign.assunto) || "Comunicado Akuris";
    const logs: Log[] = [];
    for (let start = 0; start < recipients.length; start += 8) {
      logs.push(...await Promise.all(recipients.slice(start, start + 8).map((recipient) => deliver(campaign, recipient, subject, isTest))));
    }

    for (let start = 0; start < logs.length; start += 200) {
      const { error } = await supabase.from("email_campanha_logs").upsert(logs.slice(start, start + 200), { onConflict: "idempotency_key" });
      if (error) throw error;
    }
    const sent = logs.filter((item) => item.status === "accepted" || item.status === "test_sent").length;
    const failed = logs.length - sent;
    if (!isTest) await supabase.from("email_campanhas").update({
      status: failed === logs.length ? "falhou" : "enviado",
      enviado_em: new Date().toISOString(), total_enviados: sent, total_falhados: failed,
    }).eq("id", campaignId);

    return json(req, { success: true, sent, failed, total: recipients.length, mode: isTest ? "test" : "broadcast" });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error, authCorsHeaders(req));
    console.error("send-email-campaign:", error?.message || error);
    if (campaignId && !isTest) await supabase.from("email_campanhas").update({ status: "falhou", erro: error?.message || String(error) }).eq("id", campaignId);
    return json(req, { error: error?.message || "Erro ao enviar campanha" }, 500);
  }
});
