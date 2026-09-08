import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";
import { sanitizeEmailDocument } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  documento_id: string;
  aprovador_id: string;
  solicitante_id: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require valid JWT and verify caller belongs to the document's empresa
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const callerId = userData.user.id as string;

    const { documento_id, aprovador_id, solicitante_id }: NotificationRequest = await req.json();

    if (!documento_id || !aprovador_id || !solicitante_id) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify caller belongs to the same empresa as the document
    const { data: callerProfile } = await supabase
      .from('profiles').select('empresa_id').eq('user_id', callerId).eq('ativo', true).single();
    const { data: docCheck } = await supabase
      .from('documentos').select('empresa_id').eq('id', documento_id).single();
    if (!callerProfile?.empresa_id || !docCheck?.empresa_id || callerProfile.empresa_id !== docCheck.empresa_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log("Enviando notificação de aprovação:", { documento_id, aprovador_id, solicitante_id });

    const { data: solicitante, error: solicitanteError } = await supabase
      .from('profiles').select('nome').eq('user_id', solicitante_id)
      .eq('empresa_id', callerProfile.empresa_id).eq('ativo', true).single();
    if (solicitanteError || !solicitante) throw new Error("Solicitante não encontrado");

    const { data: aprovador, error: aprovadorError } = await supabase
      .from('profiles').select('nome, email').eq('notificar_por_email', true)
      .eq('user_id', aprovador_id).eq('empresa_id', callerProfile.empresa_id).eq('ativo', true).single();
    if (aprovadorError || !aprovador) throw new Error("Aprovador não encontrado");

    const { data: document, error: docError } = await supabase
      .from('documentos').select('nome, empresa_id').eq('id', documento_id).single();
    if (docError || !document) throw new Error("Documento não encontrado");

    const { data: empresa } = await supabase
      .from('empresas').select('nome, logo_url').eq('id', document.empresa_id).single();

    const companyName = empresa?.nome || "Akuris";

    const emailResponse = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [aprovador.email],
      subject: `[Akuris] Solicitação de Aprovação: ${document.nome}`,
      text: `Aprovação necessária: ${document.nome}. Solicitante: ${solicitante.nome}. Empresa: ${companyName}. Revise em https://akuris.pt/documentos?aprovar=${documento_id}`,
      html: sanitizeEmailDocument(operationalEmail("approval", {
      name: aprovador.nome, item: document.nome, author: solicitante.nome, company: companyName, url: `https://akuris.pt/documentos?aprovar=${documento_id}`
    })),
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(JSON.stringify({ success: true, message: "Notificação enviada com sucesso", emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erro na função send-approval-notification:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)), success: false }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
