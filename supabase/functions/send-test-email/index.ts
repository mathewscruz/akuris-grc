import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { htmlToText } from "../_shared/email.ts";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { TestEmail } from "./_templates/test-email.tsx";
import { requireUserContext, requireValidMfa, authErrorResponse } from "../_shared/auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
    const ctx = await requireUserContext(req);
    await requireValidMfa(ctx);
    if (ctx.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Apenas super administradores' }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('email')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    const email = String(profile?.email || '').trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("E-mail do perfil inválido");

    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ctx.userId));
    const fingerprint = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const { data: allowed, error: rateError } = await ctx.supabase.rpc('consume_security_rate_limit', {
      p_scope: 'send-test-email',
      p_fingerprint_hash: fingerprint,
      p_max_requests: 5,
      p_window_seconds: 600,
    });
    if (rateError || allowed !== true) {
      return new Response(JSON.stringify({ error: rateError ? 'Serviço indisponível' : 'Muitas tentativas' }), {
        status: rateError ? 503 : 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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
    if (error?.status) return authErrorResponse(error, corsHeaders);
    console.error("Erro na função send-test-email:", error);
    return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail de teste', success: false }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
