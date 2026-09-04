import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText } from "../_shared/email.ts";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { TestEmail } from "./_templates/test-email.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const { email } = await req.json();
    if (!email || !email.includes("@")) throw new Error("E-mail inválido");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Usuário não autenticado");

    const html = await renderAsync(
      React.createElement(TestEmail, {
        email,
        dateTime: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      })
    );

    const { error: emailError } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [email],
      subject: '[TESTE] Akuris — Teste de E-mail',
      html,
      text: htmlToText(html),
    });

    if (emailError) throw emailError;

    return new Response(JSON.stringify({ success: true, message: "E-mail de teste enviado com sucesso!" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Erro na função send-test-email:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)), success: false }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
