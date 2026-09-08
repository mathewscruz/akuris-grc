import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { sanitizeEmailDocument } from "../_shared/email.ts";
import { exigeChamadaInterna, respostaAcessoNegado, AcessoNegado } from "../_shared/interna.ts";

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
    // Função interna: só a chave de serviço entra. Estava publicada sem
    // qualquer verificação, disparável por qualquer pessoa na internet.
    exigeChamadaInterna(req);

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

        const { data: admins } = await supabase.from('profiles').select('email, nome').eq('notificar_por_email', true).eq('empresa_id', empresa.id).in('role', ['admin', 'super_admin']);

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            try {
              const mensagem = diasRestantes < 0 ? `A licença "${licenca.nome}" venceu há ${Math.abs(diasRestantes)} dias` : `A licença "${licenca.nome}" vence em ${diasRestantes} dias`;

              await resend.emails.send({
                from: "Akuris <noreply@akuris.com.br>",
                to: [admin.email],
                subject: diasRestantes < 0 ? `[Ação necessária] Licença vencida: ${licenca.nome}` : `[Ação necessária] Licença próxima do vencimento: ${licenca.nome}`,
                text: `${mensagem}. Acesse https://akuris.pt/ativos/licencas`,
                html: sanitizeEmailDocument(operationalEmail("license", {
      name: admin.nome, item: licenca.nome, intro: mensagem, type: licenca.tipo_licenca, deadline: new Date(licenca.data_vencimento).toLocaleDateString("pt-BR"), supplier: licenca.fornecedor || "N/A", tone: diasRestantes < 0 ? "danger" : "warning", url: "https://akuris.pt/ativos/licencas"
    })),
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
    // Acesso negado responde 401, não 500 -- e sem detalhe interno.
    if (error instanceof AcessoNegado) return respostaAcessoNegado(error, corsHeaders);
    console.error("Erro no processamento:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
