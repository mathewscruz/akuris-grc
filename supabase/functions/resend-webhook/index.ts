import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Webhook } from "npm:svix@1.68.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook não configurado", { status: 503 });

  const raw = await req.text();
  let event: any;
  try {
    event = new Webhook(secret).verify(raw, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    });
  } catch {
    return new Response("Assinatura inválida", { status: 401 });
  }

  const providerId = event?.data?.email_id;
  const mapped: Record<string, string> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
  };
  const status = mapped[event?.type];
  if (!providerId || !status) return new Response("ok");

  const timestampColumn = status === "delivered" ? "delivered_at" : status === "bounced" ? "bounced_at" : "complained_at";
  const { data: log, error } = await supabase
    .from("email_campanha_logs")
    .update({ status, [timestampColumn]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("provider_id", providerId)
    .select("campanha_id")
    .maybeSingle();
  if (error) return new Response("Falha ao registrar evento", { status: 500 });
  if (!log?.campanha_id) return new Response("ok");

  const { data: logs } = await supabase.from("email_campanha_logs").select("status").eq("campanha_id", log.campanha_id);
  const count = (name: string) => (logs ?? []).filter((item: any) => item.status === name).length;
  await supabase.from("email_campanhas").update({
    total_entregues: count("delivered"),
    total_rejeitados: count("bounced"),
    total_reclamacoes: count("complained"),
  }).eq("id", log.campanha_id);

  return new Response("ok");
});
