import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: empresas, error: empresasError } = await supabase.from('empresas').select('id, nome').eq('ativo', true);
    if (empresasError) throw empresasError;

    const hoje = new Date();
    const resultados: any[] = [];

    for (const empresa of empresas || []) {
      const { data: licencas, error: licencasError } = await supabase.from('ativos_licencas').select('*').eq('empresa_id', empresa.id).eq('status', 'ativa').not('data_vencimento', 'is', null);
      if (licencasError) { console.error(`Erro ao buscar licenças da empresa ${empresa.id}:`, licencasError); continue; }

      for (const licenca of licencas || []) {
        const dataVencimento = new Date(licenca.data_vencimento);
        const diasRestantes = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        let tipoNotificacao = '';
        if (diasRestantes < 0) tipoNotificacao = 'vencido';
        else if (diasRestantes <= 7) tipoNotificacao = 'vencimento_7d';
        else if (diasRestantes <= 15) tipoNotificacao = 'vencimento_15d';
        else if (diasRestantes <= 30) tipoNotificacao = 'vencimento_30d';
        if (!tipoNotificacao) continue;

        const { data: jaEnviado } = await supabase.from('ativos_notificacoes_enviadas').select('id').eq('empresa_id', empresa.id).eq('modulo', 'licencas').eq('registro_id', licenca.id).eq('tipo_notificacao', tipoNotificacao).gte('enviado_em', new Date(hoje.getTime() - 24 * 60 * 60 * 1000).toISOString()).single();
        if (jaEnviado) continue;

        const { data: admins } = await supabase.from('profiles').select('email, nome').eq('empresa_id', empresa.id).in('role', ['admin', 'super_admin']);

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            try {
              const mensagem = diasRestantes < 0 ? `A licença "${licenca.nome}" venceu há ${Math.abs(diasRestantes)} dias` : `A licença "${licenca.nome}" vence em ${diasRestantes} dias`;

              await resend.emails.send({
                from: "Akuris <noreply@akuris.com.br>",
                to: [admin.email],
                subject: diasRestantes < 0 ? `⚠️ Licença Vencida - ${licenca.nome}` : `🔔 Licença Vencendo - ${licenca.nome}`,
                html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
<div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
  <div style="background-color: #0a1628; text-align: center; padding: 32px;">
    <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
  </div>
  <div style="height: 3px; background: linear-gradient(90deg, #7552ff, #5a3fd6, #7552ff);"></div>
  <div style="padding: 32px;">
    <h2 style="color: #0a1628; margin: 0 0 16px;">Alerta de Vencimento de Licença</h2>
    <p>Olá ${admin.nome},</p>
    <p>${mensagem}</p>
    <div style="background-color: #f0eeff; border-left: 4px solid #7552ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px;"><strong>Nome:</strong> ${licenca.nome}</p>
      <p style="margin: 0 0 8px;"><strong>Tipo:</strong> ${licenca.tipo_licenca}</p>
      <p style="margin: 0 0 8px;"><strong>Data de Vencimento:</strong> ${new Date(licenca.data_vencimento).toLocaleDateString('pt-BR')}</p>
      <p style="margin: 0;"><strong>Fornecedor:</strong> ${licenca.fornecedor || 'N/A'}</p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://akuris.com.br/ativos/licencas" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">Renovar Licença</a>
    </div>
  </div>
  <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
    <p style="font-size: 12px; color: #8898aa; margin: 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
  </div>
</div>
</body></html>`,
              });

              await supabase.from('ativos_notificacoes_enviadas').insert({ empresa_id: empresa.id, modulo: 'licencas', registro_id: licenca.id, tipo_notificacao: tipoNotificacao, canal: 'email', destinatario_email: admin.email, status: 'enviado' });
              resultados.push({ licenca: licenca.nome, email: admin.email, tipo: tipoNotificacao, status: 'enviado' });
            } catch (emailError) {
              console.error('Erro ao enviar email:', emailError);
              resultados.push({ licenca: licenca.nome, email: admin.email, tipo: tipoNotificacao, status: 'erro', erro: emailError });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, resultados }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Erro no processamento:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
