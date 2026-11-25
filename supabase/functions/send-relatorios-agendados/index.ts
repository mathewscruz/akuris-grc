// Envio diário dos relatórios agendados: e-mail aos destinatários com link para
// abrir e descarregar o PDF no Akuris + aviso no sino do autor do relatório.
// Chamado só pela rotina diária (token da rotina).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";
import { notificationEmail } from "../_shared/email-brand.ts";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";
import { authorizedScheduledJob } from "../_shared/scheduled-job.ts";
import { devidoHoje, proximoEnvio } from "./regras.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP = "https://akuris.pt";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (!authorizedScheduledJob(req, Deno.env.get("LEMBRETES_DIARIOS_TOKEN"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))) {
    return json({ error: "Não autorizado" }, 401);
  }
  try {
    const agora = new Date(Date.now() - 3 * 3600000); // dia em Brasília
    const hoje = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
    const { data: agendas, error } = await db.from("relatorio_agendamentos")
      .select("id, empresa_id, relatorio_id, frequencia, dia_envio, destinatarios, ultimo_envio")
      .eq("ativo", true).limit(2000);
    if (error) throw error;
    const key = Deno.env.get("RESEND_API_KEY");
    let enviados = 0;
    for (const a of agendas ?? []) {
      if (!devidoHoje(a.frequencia, a.dia_envio, hoje, a.ultimo_envio)) continue;
      // Isolamento: o relatório tem de pertencer à mesma empresa do agendamento.
      const { data: rel } = await db.from("relatorios_customizados")
        .select("id, nome, descricao, created_by, empresa_id, status")
        .eq("id", a.relatorio_id).eq("empresa_id", a.empresa_id).maybeSingle();
      if (!rel || rel.status === "arquivado") continue;
      const url = `${APP}/relatorios?abrir=${rel.id}`;
      // Only active users of the same company may receive the report.
      const pedidos = (a.destinatarios ?? []).filter((e: string) => EMAIL_RE.test(e)).map((e: string) => e.trim().toLowerCase());
      const { data: membros } = pedidos.length
        ? await db.from("profiles").select("email").eq("empresa_id", a.empresa_id).eq("ativo", true)
        : { data: [] };
      const permitidos = new Set((membros ?? []).map((m: { email: string | null }) => (m.email ?? "").toLowerCase()));
      const dest = pedidos.filter((e: string) => permitidos.has(e));
      let ok = false;
      if (key && dest.length) {
        const html = notificationEmail({
          title: `Relatório agendado: ${rel.nome}`, module: "Relatórios", item: rel.nome, locale: "pt",
          intro: "O seu relatório agendado está pronto com os dados atualizados de hoje.",
          description: rel.descricao ?? "", next: "Abra o relatório no Akuris para pré-visualizar e descarregar o PDF.",
          action: { label: "Abrir relatório", url }, tone: "neutral",
        } as any);
        const { error: e } = await new Resend(key).emails.send({
          from: "Akuris <noreply@akuris.com.br>", to: dest,
          subject: `[Akuris] Relatório agendado: ${rel.nome}`,
          html: sanitizeEmailDocument(html), text: htmlToText(html),
        });
        if (e) console.error("Resend rejeitou", e); else ok = true;
      }
      if (rel.created_by) {
        await db.from("notifications").insert({
          user_id: rel.created_by, type: ok ? "info" : "warning",
          title: ok ? "Relatório agendado enviado" : "Falha no envio do relatório agendado",
          message: `${rel.nome} · ${dest.length} destinatário(s)`, link_to: `/relatorios?abrir=${rel.id}`,
          metadata: { relatorio_id: rel.id, agendamento_id: a.id },
        });
      }
      await db.from("relatorio_agendamentos").update({
        ultimo_envio: new Date().toISOString(),
        proximo_envio: proximoEnvio(a.frequencia, a.dia_envio, hoje),
      }).eq("id", a.id).eq("empresa_id", a.empresa_id);
      if (ok) enviados++;
    }
    return json({ verificados: agendas?.length ?? 0, enviados });
  } catch (e) {
    console.error("send-relatorios-agendados", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
