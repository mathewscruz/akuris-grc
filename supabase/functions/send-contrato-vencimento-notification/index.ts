import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";

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
      const { data: gestor } = await supabase.from("profiles").select("email, nome").eq("user_id", gestor_id).single();
      if (gestor?.email) { emailList.add(gestor.email); gestorNome = gestor.nome || ""; }
    }
    const { data: admins } = await supabase.from("profiles").select("email").eq("empresa_id", empresa_id).in("role", ["admin", "super_admin"]);
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
    const contratoLink = `https://akuris.com.br/contratos?contrato=${contrato_id}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0a1628; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: ${urgencyConfig.color}; padding: 16px 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${urgencyConfig.icon} Contrato ${isCritical ? 'Vencido' : 'Próximo do Vencimento'}</span>
    </div>
    <div style="text-align: center; padding: 24px 32px 16px;">
      <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
    </div>
    <div style="padding: 0 32px 32px;">
      <h1 style="font-size: 22px; color: #0a1628; margin: 0 0 24px; font-weight: 600;">${isCritical ? 'Contrato Vencido!' : 'Contrato Próximo do Vencimento'}</h1>
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 8px 24px; background-color: ${urgencyConfig.bg}; color: ${urgencyConfig.color}; border-radius: 20px; font-weight: 700; font-size: 16px; border: 2px solid ${urgencyConfig.color};">${urgencyConfig.text}</span>
      </div>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; color: #0a1628; margin: 0 0 16px; font-weight: 600;">${nome}</h2>
        <div style="display: grid; gap: 12px;">
          <div style="font-size: 14px; color: #475569;"><strong style="color: #64748b;">Nº Contrato:</strong> ${numero_contrato}</div>
          ${fornecedor_nome ? `<div style="font-size: 14px; color: #475569;"><strong style="color: #64748b;">Fornecedor:</strong> ${fornecedor_nome}</div>` : ''}
          <div style="font-size: 14px; color: #475569;"><strong style="color: #64748b;">Data de Vencimento:</strong> ${formatDate(data_fim)}</div>
          <div style="font-size: 14px; color: #475569;"><strong style="color: #64748b;">Valor:</strong> ${formatCurrency(valor)}</div>
          ${gestorNome ? `<div style="font-size: 14px; color: #475569;"><strong style="color: #64748b;">Gestor:</strong> ${gestorNome}</div>` : ''}
        </div>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${contratoLink}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Ver Contrato</a>
      </div>
      <div style="background-color: ${urgencyConfig.bg}; border-radius: 8px; padding: 16px; border-left: 4px solid ${urgencyConfig.color};">
        <p style="font-size: 13px; color: #475569; margin: 0;"><strong>Ação Recomendada:</strong> ${isCritical ? 'Este contrato está vencido. Verifique a situação e tome as medidas necessárias.' : 'Revise o contrato e inicie o processo de renovação ou encerramento conforme necessário.'}</p>
      </div>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Por favor, não responda a este e-mail.</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    const emailPromises = Array.from(emailList).map(async (email) => {
      try {
        const { error: emailError } = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [email], subject: `[Akuris] ${urgencyConfig.icon} Contrato ${isCritical ? 'Vencido' : 'Vencendo'}: ${nome}`, html: htmlContent });
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
