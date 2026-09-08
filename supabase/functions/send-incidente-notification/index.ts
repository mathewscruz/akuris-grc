import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";

import { severidadeCanonica, isSevero } from '../_shared/severidade.ts';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest { incidente_id: string; titulo: string; descricao?: string; gravidade: string; tipo: string; responsavel_id?: string; empresa_id: string; }

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: require valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: userData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const callerId = userData.user.id as string;

    const { incidente_id, responsavel_id, empresa_id }: NotificationRequest = await req.json();

    // Verify caller belongs to the same empresa
    const { data: callerProfile } = await supabase.from('profiles').select('empresa_id').eq('user_id', callerId).eq('ativo', true).single();
    if (!callerProfile?.empresa_id || callerProfile.empresa_id !== empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: incidente } = await supabase.from('incidentes')
      .select('titulo, descricao, criticidade, tipo_incidente')
      .eq('id', incidente_id).eq('empresa_id', empresa_id).maybeSingle();
    if (!incidente) {
      return new Response(JSON.stringify({ error: 'Incidente não encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const titulo = incidente.titulo;
    const descricao = incidente.descricao || undefined;
    const gravidade = incidente.criticidade;
    const tipo = incidente.tipo_incidente;

    let companyName = "Akuris";
    const { data: empresaData } = await supabase.from("empresas").select("nome").eq("id", empresa_id).single();
    if (empresaData) { companyName = empresaData.nome || companyName; }

    const emailList = new Set<string>();
    const { data: admins } = await supabase.from("profiles").select("email, nome").eq('notificar_por_email', true).eq('ativo', true).eq("empresa_id", empresa_id).in("role", ["admin", "super_admin"]);
    admins?.forEach(admin => { if (admin.email) emailList.add(admin.email); });

    let responsavelNome = "";
    if (responsavel_id) {
      const { data: responsavel } = await supabase.from("profiles").select("email, nome").eq('notificar_por_email', true)
        .eq('ativo', true).eq('empresa_id', empresa_id).eq("user_id", responsavel_id).single();
      if (responsavel?.email) { emailList.add(responsavel.email); responsavelNome = responsavel.nome || ""; }
    }

    if (emailList.size === 0) return new Response(JSON.stringify({ success: true, message: "Nenhum destinatário" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const gravidadeConfig: Record<string, { color: string; bg: string; text: string }> = {
      baixa: { color: "#7552ff", bg: "#f0eeff", text: "Baixa" },
      media: { color: "#f59e0b", bg: "#fffbeb", text: "Média" },
      alta: { color: "#f97316", bg: "#fff7ed", text: "Alta" },
      critica: { color: "#dc2626", bg: "#fef2f2", text: "Crítica" },
    };
    const config = gravidadeConfig[gravidade] || gravidadeConfig.media;
    const truncateText = (text?: string, maxLength = 300): string => { if (!text) return "Sem descrição"; return text.length > maxLength ? text.substring(0, maxLength) + "..." : text; };
    const incidenteLink = `https://akuris.pt/incidentes?incidente=${incidente_id}`;

    const htmlContent = operationalEmail("incident", {
      item: titulo, description: descricao ? truncateText(descricao) : undefined, severity: config.text, type: tipo, owner: responsavelNome, tone: gravidade === "critica" ? "danger" : gravidade === "baixa" ? "neutral" : "warning", url: incidenteLink
    });

    const emailPromises = Array.from(emailList).map(async (email) => {
      try {
        const { error: emailError } = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [email], subject: `[Incidente ${config.text}] ${titulo}`, html: sanitizeEmailDocument(htmlContent), text: htmlToText(htmlContent) });
        if (emailError) return { email, success: false, error: emailError };
        return { email, success: true };
      } catch (error) { return { email, success: false, error }; }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    if (responsavel_id) {
      await supabase.from("notifications").insert({ user_id: responsavel_id, type: severidadeCanonica(gravidade) === "critico" ? "error" : "warning", title: `Incidente ${config.text} Registrado`, message: `Novo incidente: ${titulo}`, link_to: `/incidentes?incidente=${incidente_id}`, read: false });
    }

    return new Response(JSON.stringify({ success: true, sent: successCount, total: results.length }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-incidente-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
