// Avisa o responsável de uma tarefa de projeto (sino + e-mail) quando:
// - é atribuído; - o status (coluna) muda; - o prazo está a 3 dias ou é hoje.
// Chamado só por dentro (gatilho do banco e rotina diária) com o token da rotina.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";
import { notificationEmail } from "../_shared/email-brand.ts";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";
import { authorizedScheduledJob } from "../_shared/scheduled-job.ts";
import { deveAvisarEvento, fimDe, lembreteDevido } from "./regras.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP = "https://akuris.pt";
const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "Não definido");
const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

type Tarefa = {
  id: string; projeto_id: string; coluna_id: string | null; parent_task_id: string | null; titulo: string;
  responsavel_id: string | null; data_fim: string | null; prazo: string | null; concluida_em: string | null;
  progresso_pct: number | null; lembrete_3d_enviado_em: string | null; lembrete_dia_enviado_em: string | null;
};
const CAMPOS = "id, projeto_id, coluna_id, parent_task_id, titulo, responsavel_id, data_fim, prazo, concluida_em, progresso_pct, lembrete_3d_enviado_em, lembrete_dia_enviado_em";

async function avisar(tarefa: Tarefa, tipo: "atribuicao" | "status" | "3d" | "dia", extra: { de?: string; para?: string; ator?: string } = {}) {
  const { data: projeto } = await db.from("projetos").select("nome, empresa_id").eq("id", tarefa.projeto_id).maybeSingle();
  if (!projeto) return { enviado: false, motivo: "projeto" };
  const { data: dest } = await db.from("profiles")
    .select("nome, email, empresa_id, notificar_por_email, notificar_na_aplicacao")
    .eq("user_id", tarefa.responsavel_id!).eq("ativo", true).maybeSingle();
  // Isolamento: só quem é da empresa dona do projeto.
  if (!dest || dest.empresa_id !== projeto.empresa_id) return { enviado: false, motivo: "destinatario" };

  const url = `${APP}/projetos/${tarefa.projeto_id}?focus=${tarefa.id}`;
  const fim = fimDe(tarefa);
  const titulo = {
    atribuicao: "Nova atividade atribuída a você",
    status: "O status da sua atividade mudou",
    "3d": "Prazo da sua atividade em 3 dias",
    dia: "Sua atividade vence hoje",
  }[tipo];
  const intro = {
    atribuicao: `${extra.ator ? extra.ator + " atribuiu" : "Foi atribuída"} a você a atividade abaixo.`,
    status: `${extra.ator ?? "Alguém"} alterou o status de "${extra.de ?? "—"}" para "${extra.para ?? "—"}".`,
    "3d": "Faltam poucos dias para o prazo desta atividade.",
    dia: "O prazo desta atividade termina hoje.",
  }[tipo];

  if (dest.notificar_na_aplicacao !== false) {
    await db.from("notifications").insert({
      user_id: tarefa.responsavel_id, type: tipo === "dia" ? "warning" : "info",
      title: titulo, message: `${tarefa.titulo} · ${projeto.nome}`, link_to: `/projetos/${tarefa.projeto_id}?focus=${tarefa.id}`,
      metadata: { projeto_id: tarefa.projeto_id, tarefa_id: tarefa.id, tipo },
    });
  }

  const key = Deno.env.get("RESEND_API_KEY");
  if (dest.notificar_por_email === false || !dest.email || !key) return { enviado: false, motivo: "email_indisponivel" };
  const html = notificationEmail({
    name: dest.nome || "Usuário", item: tarefa.titulo, code: "", description: "", locale: "pt",
    tone: tipo === "dia" ? "warning" : "neutral",
    title: titulo, module: "Projetos", intro,
    fields: [["Projeto", projeto.nome], ["Prazo", fmt(fim)], ...(tipo === "status" ? [["Novo status", extra.para ?? "—"] as const] : [])],
    next: "Abra a atividade no Akuris para acompanhar e atualizar o andamento.",
    action: { label: "Abrir atividade", url },
  } as any);
  const { error } = await new Resend(key).emails.send({
    from: "Akuris <noreply@akuris.com.br>", to: [dest.email],
    subject: `[Akuris] ${titulo}: ${tarefa.titulo}`,
    html: sanitizeEmailDocument(html), text: htmlToText(html),
  });
  if (error) { console.error("Resend rejeitou", error); return { enviado: false, motivo: "provedor" }; }
  return { enviado: true };
}

async function nome(userId: unknown) {
  if (!isUuid(userId)) return undefined;
  const { data } = await db.from("profiles").select("nome").eq("user_id", userId as string).maybeSingle();
  return data?.nome ?? undefined;
}

Deno.serve(async (req) => {
  if (!authorizedScheduledJob(req, Deno.env.get("LEMBRETES_DIARIOS_TOKEN"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))) {
    return json({ error: "Não autorizado" }, 401);
  }
  try {
    const body = await req.json().catch(() => ({}));
    const tipo = body?.tipo;

    if (tipo === "atribuicao" || tipo === "status") {
      if (!isUuid(body.tarefa_id)) return json({ error: "tarefa_id inválido" }, 400);
      const { data: t } = await db.from("projeto_tarefas").select(CAMPOS).eq("id", body.tarefa_id).maybeSingle();
      if (!t || !deveAvisarEvento(t.responsavel_id, isUuid(body.ator_id) ? body.ator_id : null)) return json({ enviado: false });
      const ator = await nome(body.ator_id);
      if (tipo === "atribuicao") return json(await avisar(t as Tarefa, "atribuicao", { ator }));
      const ids = [body.coluna_anterior_id, t.coluna_id].filter(isUuid);
      const { data: cols } = ids.length ? await db.from("projeto_colunas").select("id, nome").in("id", ids) : { data: [] };
      const n = (id: unknown) => cols?.find((c: any) => c.id === id)?.nome;
      return json(await avisar(t as Tarefa, "status", { ator, de: n(body.coluna_anterior_id), para: n(t.coluna_id) }));
    }

    if (tipo === "prazo") {
      const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); // dia em Brasília
      const ate = new Date(Date.parse(hoje) + 3 * 86400000).toISOString().slice(0, 10);
      const { data: rows, error } = await db.from("projeto_tarefas").select(CAMPOS)
        .not("responsavel_id", "is", null).is("concluida_em", null)
        .or(`and(data_fim.gte.${hoje},data_fim.lte.${ate}),and(data_fim.is.null,prazo.gte.${hoje},prazo.lte.${ate}T23:59:59)`)
        .limit(1000);
      if (error) throw error;
      const ids = (rows ?? []).map((r: any) => r.id);
      const colIds = [...new Set((rows ?? []).map((r: any) => r.coluna_id).filter(Boolean))];
      const [{ data: filhos }, { data: cols }] = await Promise.all([
        ids.length ? db.from("projeto_tarefas").select("parent_task_id").in("parent_task_id", ids) : Promise.resolve({ data: [] }),
        colIds.length ? db.from("projeto_colunas").select("id, is_concluido").in("id", colIds) : Promise.resolve({ data: [] }),
      ]);
      const pais = new Set((filhos ?? []).map((f: any) => f.parent_task_id));
      const concl = new Set((cols ?? []).filter((c: any) => c.is_concluido).map((c: any) => c.id));
      let enviados = 0;
      for (const t of (rows ?? []) as Tarefa[]) {
        const l = lembreteDevido(t, hoje, !pais.has(t.id), !!t.coluna_id && concl.has(t.coluna_id));
        if (!l) continue;
        const r = await avisar(t, l);
        await db.from("projeto_tarefas").update(l === "dia" ? { lembrete_dia_enviado_em: new Date().toISOString(), lembrete_3d_enviado_em: t.lembrete_3d_enviado_em ?? new Date().toISOString() } : { lembrete_3d_enviado_em: new Date().toISOString() }).eq("id", t.id);
        if (r.enviado) enviados++;
      }
      return json({ verificadas: rows?.length ?? 0, enviados });
    }
    return json({ error: "tipo inválido" }, 400);
  } catch (e) {
    console.error("send-projeto-tarefa-notification", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
