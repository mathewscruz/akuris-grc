import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  contrato_id: string;
  nome: string;
  numero_contrato: string;
  fornecedor_nome?: string;
  data_fim: string;
  valor?: number;
  gestor_id?: string;
  empresa_id: string;
  dias_restantes: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const resend = new Resend(resendApiKey);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ============ AUTH: aceita service-role (cron interno) OU JWT válido; deriva empresa do JWT ============
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    let callerEmpresaId: string | null = null;
    let isInternal = false;
    if (token === SERVICE_ROLE) {
      isInternal = true;
    } else {
      const verifier = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE);
      const { data: userData } = await verifier.auth.getUser(token);
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      const { data: prof } = await supabase.from("profiles").select("empresa_id").eq("user_id", userData.user.id).maybeSingle();
      callerEmpresaId = prof?.empresa_id || null;
      if (!callerEmpresaId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    const body: NotificationRequest = await req.json();
    const { contrato_id, nome, numero_contrato, fornecedor_nome, data_fim, valor, dias_restantes } = body;
    let { gestor_id, empresa_id } = body;

    if (!contrato_id) {
      return new Response(JSON.stringify({ error: "contrato_id obrigatório" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // TENANT GUARD: validar contrato pertence à empresa do caller (ou usar contrato.empresa_id p/ cron)
    const { data: contratoRow } = await supabase
      .from("contratos")
      .select("id, empresa_id, responsavel_id")
      .eq("id", contrato_id)
      .maybeSingle();
    if (!contratoRow) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (!isInternal && contratoRow.empresa_id !== callerEmpresaId) {
      console.warn("Cross-tenant attempt on send-contrato-vencimento-notification", { callerEmpresaId, target: contratoRow.empresa_id, contrato_id });
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    // Sempre confiar no valor persistido, nunca no body
    empresa_id = contratoRow.empresa_id;
    if (gestor_id) {
      // Validar que gestor_id, se informado, pertence à mesma empresa
      const { data: gestorProfile } = await supabase.from("profiles").select("user_id, empresa_id").eq("user_id", gestor_id).maybeSingle();
      if (!gestorProfile || gestorProfile.empresa_id !== empresa_id) {
        gestor_id = undefined;
      }
    } else if (contratoRow.responsavel_id) {
      gestor_id = contratoRow.responsavel_id;
    }

    let companyName = "Akuris";
    const { data: empresaData } = await supabase.from("empresas").select("nome").eq("id", empresa_id).single();
    if (empresaData) { companyName = empresaData.nome || companyName; }

    const emailList = new Set<string>();
    let gestorNome = "";
    if (gestor_id) {
      const { data: gestor } = await supabase.from("profiles").select("email, nome").eq('notificar_por_email', true).eq("user_id", gestor_id).single();
      if (gestor?.email) { emailList.add(gestor.email); gestorNome = gestor.nome || ""; }
    }
    const { data: admins } = await supabase.from("profiles").select("email").eq('notificar_por_email', true).eq("empresa_id", empresa_id).in("role", ["admin", "super_admin"]);
    admins?.forEach(admin => { if (admin.email) emailList.add(admin.email); });

    if (emailList.size === 0) return new Response(JSON.stringify({ success: true, message: "Nenhum destinatário" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const isUrgent = dias_restantes <= 7;
    const isCritical = dias_restantes <= 0;
    const urgencyConfig = isCritical 
      ? { color: "#dc2626", bg: "#fef2f2", text: "VENCIDO", icon: "🚨" }
      : isUrgent ? { color: "#f97316", bg: "#fff7ed", text: `${dias_restantes} dias`, icon: "⚠️" }
      : { color: "#f59e0b", bg: "#fffbeb", text: `${dias_restantes} dias`, icon: "📅" };

    const formatDate = (dateStr: string): string => { try { return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return dateStr; } };
    const formatCurrency = (val?: number): string => { if (!val) return "Não informado"; return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val); };
    const contratoLink = `https://akuris.pt/contratos?contrato=${contrato_id}`;

    const htmlContent = operationalEmail("contract", {
      item: nome, code: numero_contrato, status: urgencyConfig.text, deadline: formatDate(data_fim), supplier: fornecedor_nome, amount: formatCurrency(valor), owner: gestorNome, tone: isCritical ? "danger" : "warning", url: contratoLink
    });

    const emailPromises = Array.from(emailList).map(async (email) => {
      try {
        const { error: emailError } = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [email], subject: `[Ação necessária] Contrato ${isCritical ? 'vencido' : 'próximo do vencimento'}: ${nome}`, html: sanitizeEmailDocument(htmlContent), text: htmlToText(htmlContent) });
        if (emailError) { console.error(`Erro ao enviar para ${email}:`, emailError); return { email, success: false, error: emailError }; }
        return { email, success: true };
      } catch (error) { return { email, success: false, error }; }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    if (gestor_id) {
      await supabase.from("notifications").insert({ user_id: gestor_id, type: isCritical ? "error" : "warning", title: `Contrato ${isCritical ? 'Vencido' : 'Próximo do Vencimento'}`, message: `${nome} - ${urgencyConfig.text}`, link_to: `/contratos?contrato=${contrato_id}`, read: false });
    }

    return new Response(JSON.stringify({ success: true, sent: successCount, total: results.length }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-contrato-vencimento-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
