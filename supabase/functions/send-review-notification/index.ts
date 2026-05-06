import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendNotificationRequest { reviewId: string; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const resend = new Resend(resendApiKey);
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { reviewId }: SendNotificationRequest = await req.json();

    const { data: review, error: reviewError } = await supabaseClient.from('access_reviews').select(`*, sistema:sistemas_privilegiados(nome_sistema), responsavel:profiles!access_reviews_responsavel_revisao_fkey(nome, email, empresa_id)`).eq('id', reviewId).single();
    if (reviewError) throw reviewError;
    if (!review.responsavel?.email) return new Response(JSON.stringify({ error: 'Responsável não possui e-mail cadastrado' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    let companyName = 'Akuris';
    if (review.responsavel.empresa_id) {
      const { data: empresaData } = await supabaseClient.from('empresas').select('nome').eq('id', review.responsavel.empresa_id).single();
      if (empresaData) { companyName = empresaData.nome || companyName; }
    }

    const reviewLink = `https://akuris.com.br/review/${review.link_token}`;
    const formatDate = (dateStr?: string): string => { if (!dateStr) return 'Não definida'; try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return dateStr; } };

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0a1628; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://akuris-grc.lovable.app/akuris-logo-email.png" alt="Akuris" width="200" height="60" style="display: block; margin: 0 auto;" />
    </div>
    <h1 style="font-size: 22px; color: #0a1628; text-align: center; margin-bottom: 24px; font-weight: 600;">🔐 Nova Revisão de Acesso Atribuída</h1>
    <p style="font-size: 15px; margin-bottom: 20px;">Olá <strong>${review.responsavel.nome || 'Usuário'}</strong>,</p>
    <p style="font-size: 15px; margin-bottom: 24px;">Você foi designado como responsável por uma nova revisão de acessos privilegiados.</p>
    <div style="background-color: #f0eeff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #7552ff;">
      <h2 style="font-size: 16px; color: #0a1628; margin: 0 0 12px 0; font-weight: 600;">${review.nome_revisao}</h2>
      <div style="font-size: 14px; color: #475569; margin-bottom: 8px;"><strong>🖥️ Sistema:</strong> ${review.sistema?.nome_sistema || 'N/A'}</div>
      <div style="font-size: 14px; color: #475569; margin-bottom: 8px;"><strong>📊 Total de Contas:</strong> ${review.total_contas || 0} contas para revisar</div>
      <div style="font-size: 14px; color: #475569;"><strong>📅 Prazo:</strong> ${formatDate(review.data_limite)}</div>
    </div>
    ${review.descricao ? `<div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;"><p style="font-size: 13px; color: #64748b; margin: 0;"><strong>Descrição:</strong> ${review.descricao}</p></div>` : ''}
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${reviewLink}" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Iniciar Revisão</a>
    </div>
    <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 24px;">Você pode acessar a revisão diretamente através do link acima, sem necessidade de login.</p>
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Por favor, não responda a este e-mail.</p>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    const emailResponse = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [review.responsavel.email], subject: `[Akuris] Nova Revisão de Acesso: ${review.nome_revisao}`, html: htmlContent });
    console.log('E-mail enviado com sucesso:', emailResponse);

    await supabaseClient.from('notifications').insert({ user_id: review.responsavel_revisao, title: 'Nova Revisão de Acesso Atribuída', message: `Você foi atribuído como responsável pela revisão "${review.nome_revisao}" do sistema ${review.sistema?.nome_sistema || 'N/A'}.`, type: 'info', link_to: '/revisao-acessos', metadata: { review_id: reviewId, tipo: 'revisao_atribuida' } });

    return new Response(JSON.stringify({ success: true, message: 'Notificação enviada com sucesso', emailResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
