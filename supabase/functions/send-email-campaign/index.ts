import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@4.0.0";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { BaseEmailTemplate } from "../_shared/email-templates/BaseEmailTemplate.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

const stripTestePrefix = (value: unknown) =>
  String(value ?? "")
    .replace(/\[\s*teste\s*\]\s*/gi, "")
    .trim();

async function checkSuperAdmin(token: string) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  return data?.role === "super_admin" ? user.id : null;
}

function buildContent(imageUrl: string | null, conteudoHtml: string) {
  return React.createElement(
    "div",
    null,
    imageUrl
      ? React.createElement("img", {
          src: imageUrl,
          alt: "",
          width: "512",
          style: {
            display: "block",
            width: "100%",
            maxWidth: "512px",
            height: "auto",
            borderRadius: "8px",
            margin: "0 0 24px",
          },
        })
      : null,
    React.createElement("div", {
      style: { color: "#2d3748", fontSize: "15px", lineHeight: "26px" },
      dangerouslySetInnerHTML: { __html: conteudoHtml },
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = await checkSuperAdmin(authHeader.replace("Bearer ", ""));
    if (!userId) return new Response(JSON.stringify({ error: "Apenas super admins" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { campanha_id, mode } = await req.json();
    if (!campanha_id) return new Response(JSON.stringify({ error: "campanha_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isTest = mode === "test";

    const { data: campanha, error: campErr } = await supabase
      .from("email_campanhas")
      .select("*")
      .eq("id", campanha_id)
      .maybeSingle();
    if (campErr || !campanha) throw new Error("Campanha não encontrada");
    if (!isTest && (campanha.status === "enviando" || campanha.status === "enviado")) {
      return new Response(JSON.stringify({ error: "Campanha já enviada ou em envio" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let emails: string[] = [];

    if (isTest) {
      // Buscar e-mail do super-admin logado
      const { data: me } = await supabase.from("profiles").select("email").eq("user_id", userId).maybeSingle();
      const myEmail = me?.email ? String(me.email).toLowerCase() : null;
      if (!myEmail || !myEmail.includes("@")) {
        return new Response(JSON.stringify({ error: "Seu perfil não possui e-mail válido para teste" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      emails = [myEmail];
    } else {
      // Buscar destinatários ativos
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("email")
        .eq("ativo", true)
        .not("email", "is", null);
      if (pErr) throw pErr;

      emails = Array.from(new Set((profiles || []).map((p: any) => String(p.email).toLowerCase()).filter((e) => e.includes("@"))));

      await supabase.from("email_campanhas").update({
        status: "enviando",
        total_destinatarios: emails.length,
        total_enviados: 0,
        total_falhados: 0,
        erro: null,
      }).eq("id", campanha_id);
    }

    // Renderizar HTML uma vez — remover definitivamente qualquer [TESTE] / [Teste] / [teste] do assunto
    const subjectFinal = stripTestePrefix(campanha.assunto || "") || "Comunicado Akuris";
    const html = await renderAsync(
      React.createElement(BaseEmailTemplate, {
        previewText: subjectFinal,
        title: subjectFinal,
        children: buildContent(campanha.imagem_url, campanha.conteudo_html),
      }),
    );

    let sent = 0;
    let failed = 0;
    const logs: { campanha_id: string; email: string; status: string; erro?: string }[] = [];

    for (const email of emails) {
      try {
        const { error } = await resend.emails.send({
          from: "Akuris <noreply@akuris.com.br>",
          to: [email],
          subject: subjectFinal,
          html,
          ...(isTest
            ? { headers: { "X-Entity-Ref-ID": `${campanha_id}-${Date.now()}-${crypto.randomUUID()}` } }
            : {}),
        });
        if (error) {
          failed++;
          logs.push({ campanha_id, email, status: isTest ? "test_failed" : "failed", erro: String(error.message || error) });
        } else {
          sent++;
          logs.push({ campanha_id, email, status: isTest ? "test_sent" : "sent" });
        }
      } catch (e: any) {
        failed++;
        logs.push({ campanha_id, email, status: isTest ? "test_failed" : "failed", erro: e?.message || String(e) });
      }
      // Pequeno delay para evitar rate limit
      if (emails.length > 1) await new Promise((r) => setTimeout(r, 600));
    }

    // Inserir logs em lote (chunks de 200)
    for (let i = 0; i < logs.length; i += 200) {
      await supabase.from("email_campanha_logs").insert(logs.slice(i, i + 200));
    }

    if (!isTest) {
      await supabase.from("email_campanhas").update({
        status: failed === emails.length && emails.length > 0 ? "falhou" : "enviado",
        enviado_em: new Date().toISOString(),
        total_enviados: sent,
        total_falhados: failed,
      }).eq("id", campanha_id);
    }

    return new Response(JSON.stringify({ success: true, sent, failed, total: emails.length, mode: isTest ? "test" : "broadcast" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-email-campaign error:", e);
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.campanha_id && body.mode !== "test") {
        await supabase.from("email_campanhas").update({ status: "falhou", erro: e?.message || String(e) }).eq("id", body.campanha_id);
      }
    } catch {
      // A resposta original ainda deve ser devolvida mesmo se falhar o registo do erro.
    }
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
