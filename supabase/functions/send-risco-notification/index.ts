import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";
import { requireUserContext, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest { risco_id: string; titulo: string; descricao?: string; probabilidade: number; impacto: number; categoria?: string; responsavel_id: string; empresa_id: string; }

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const resend = new Resend(resendApiKey);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    /*
      Quem chama tem de pertencer à empresa que diz representar.

      Antes, `responsavel_id` e `empresa_id` vinham do CORPO do pedido e eram
      usados tal e qual contra um cliente de service_role, que ignora RLS. Um
      utilizador autenticado de um inquilino podia assim mandar e-mail e
      notificação a qualquer pessoa de QUALQUER empresa, com o assunto e o
      texto que quisesse -- vindos do domínio de confiança da plataforma.
      É um veículo de phishing, e uma fuga de nomes e e-mails alheios.
    */
    const ctx = await requireUserContext(req);

    const { risco_id, responsavel_id }: NotificationRequest = await req.json();

    // A empresa é sempre a da sessão; o corpo do pedido não a escolhe.
    const empresa_id = ctx.empresaId;
    if (!empresa_id) return new Response(JSON.stringify({ error: "Sem empresa associada" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const { data: responsavelData, error: responsavelError } = await supabase.from("profiles").select("nome, email, empresa_id")
      .eq('notificar_por_email', true).eq('ativo', true).eq("user_id", responsavel_id).single();
    if (responsavelError || !responsavelData?.email) return new Response(JSON.stringify({ error: "Responsável não encontrado ou sem email" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    // E o destinatário tem de ser do mesmo inquilino de quem manda.
    if (responsavelData.empresa_id !== empresa_id) return new Response(JSON.stringify({ error: "Destinatário fora da sua empresa" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const { data: risco } = await supabase.from('riscos')
      .select('nome, descricao, probabilidade_inicial, impacto_inicial, categoria_id')
      .eq('id', risco_id).eq('empresa_id', empresa_id).maybeSingle();
    if (!risco) return new Response(JSON.stringify({ error: 'Risco não encontrado' }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    const titulo = risco.nome;
    const descricao = risco.descricao || undefined;
    const probabilidade = risco.probabilidade_inicial || 0;
    const impacto = risco.impacto_inicial || 0;
    const categoria = risco.categoria_id || undefined;

    let companyName = "Akuris";
    const { data: empresaData } = await supabase.from("empresas").select("nome").eq("id", empresa_id).single();
    if (empresaData) { companyName = empresaData.nome || companyName; }

    const nivelRisco = probabilidade * impacto;
    const getNivelConfig = (nivel: number) => {
      if (nivel >= 20) return { color: "#dc2626", bg: "#fef2f2", text: "Crítico", icon: "🔴" };
      if (nivel >= 12) return { color: "#f97316", bg: "#fff7ed", text: "Alto", icon: "🟠" };
      if (nivel >= 6) return { color: "#f59e0b", bg: "#fffbeb", text: "Médio", icon: "🟡" };
      return { color: "#7552ff", bg: "#f0eeff", text: "Baixo", icon: "🟢" };
    };
    const config = getNivelConfig(nivelRisco);
    const truncateText = (text?: string, maxLength = 300): string => { if (!text) return "Sem descrição"; return text.length > maxLength ? text.substring(0, maxLength) + "..." : text; };
    const riscoLink = `https://akuris.pt/riscos?risco=${risco_id}`;

    const htmlContent = operationalEmail("risk", {
      name: responsavelData.nome || "Usuário", item: titulo, description: descricao ? truncateText(descricao) : undefined, level: `${config.text} (${nivelRisco})`, probability: `${probabilidade}/5`, impact: `${impacto}/5`, category: categoria, tone: nivelRisco >= 20 ? "danger" : nivelRisco >= 6 ? "warning" : "neutral", url: riscoLink
    });

    const emailResponse = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [responsavelData.email], subject: `[Risco atribuído — ${config.text}] ${titulo}`, html: sanitizeEmailDocument(htmlContent), text: htmlToText(htmlContent) });
    console.log("E-mail enviado com sucesso:", emailResponse);

    await supabase.from("notifications").insert({ user_id: responsavel_id, type: nivelRisco >= 12 ? "warning" : "info", title: "Novo risco atribuído", message: `Você é responsável pelo risco: ${titulo} (Nível ${config.text})`, link_to: `/riscos?risco=${risco_id}`, read: false });

    return new Response(JSON.stringify({ success: true, emailResponse }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-risco-notification:", error);
    // Falha de autenticação responde 401/403, não 500 -- e não devolve o
    // detalhe interno a quem nem devia ter passado da porta.
    return authErrorResponse(error, corsHeaders);
  }
};

serve(handler);
