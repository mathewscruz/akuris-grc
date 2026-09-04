import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const page = (token: string, completed = false) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preferências de e-mail — Akuris</title></head><body style="margin:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#202938"><main style="max-width:520px;margin:10vh auto;background:#fff;border:1px solid #dfe4eb;border-radius:10px;overflow:hidden"><header style="padding:26px 34px;background:#0a1628;border-bottom:2px solid #7552ff"><img src="https://akuris.pt/akuris-logo-email.png" width="150" alt="Akuris"></header><section style="padding:36px 34px"><p style="margin:0 0 8px;color:#7552ff;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Preferências</p><h1 style="font-size:24px;margin:0 0 16px">${completed ? "Preferência atualizada" : "Parar de receber comunicados"}</h1><p style="line-height:1.6;color:#566276">${completed ? "Você não receberá novas campanhas editoriais da Akuris. Avisos transacionais e de segurança continuam ativos." : "Esta opção interrompe newsletters e comunicados editoriais. Alertas operacionais, de segurança e da sua conta continuam ativos."}</p>${completed ? '<a href="https://akuris.pt" style="color:#5f43db">Voltar ao site</a>' : `<form method="post"><input type="hidden" name="token" value="${token}"><button type="submit" style="margin-top:10px;border:0;border-radius:7px;background:#7552ff;color:#fff;padding:13px 20px;font-weight:700;cursor:pointer">Confirmar descadastro</button></form>`}</section></main></body></html>`;

serve(async (req) => {
  const url = new URL(req.url);
  let token = url.searchParams.get("token") ?? "";
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) token = String((await req.json().catch(() => ({}))).token ?? token);
    else token = String((await req.formData().catch(() => new FormData())).get("token") ?? token);
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Link inválido", { status: 400 });
  if (req.method === "GET") return new Response(page(token), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { error } = await supabase.from("profiles").update({ receber_comunicados: false }).eq("email_unsubscribe_token", token);
  if (error) return new Response("Não foi possível atualizar a preferência", { status: 500 });
  return new Response(page(token, true), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
});
