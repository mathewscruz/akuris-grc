import { operationalEmail } from "../_shared/operational-email.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'npm:resend@2.0.0';
import { htmlToText, sanitizeEmailDocument } from '../_shared/email.ts';

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

    // === AUTH: exige JWT válido ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const { data: callerProfile } = await supabaseClient
      .from('profiles').select('empresa_id').eq('user_id', userData.user.id).eq('ativo', true).maybeSingle();
    const callerEmpresaId = callerProfile?.empresa_id;
    if (!callerEmpresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { reviewId }: SendNotificationRequest = await req.json();

    const { data: review, error: reviewError } = await supabaseClient.from('access_reviews').select(`*, sistema:sistemas_privilegiados(nome_sistema), responsavel:profiles!access_reviews_responsavel_revisao_fkey(nome, email, empresa_id, ativo, notificar_por_email)`).eq('id', reviewId).single();
    if (reviewError) throw reviewError;
    if (!review.responsavel?.email || !review.responsavel?.ativo) return new Response(JSON.stringify({ error: 'Responsável não possui e-mail cadastrado ou está inativo' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    /*
       Quem dispensou o aviso por e-mail nao o recebe.

       Aqui o destinatario vem por `embed` e nao por consulta propria, por
       isso a preferencia le-se do objecto em vez de filtrar na consulta. O
       aviso dentro do produto continua a ser gravado: dispensar o e-mail
       nao e dispensar a informacao.
    */
    const aceitaEmail = review.responsavel?.notificar_por_email !== false;

    // Isolamento por tenant: caller e responsável devem estar na mesma empresa
    if (review.empresa_id !== callerEmpresaId || review.responsavel.empresa_id !== callerEmpresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden: revisão de outro tenant' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    let companyName = 'Akuris';
    if (review.responsavel.empresa_id) {
      const { data: empresaData } = await supabaseClient.from('empresas').select('nome').eq('id', review.responsavel.empresa_id).single();
      if (empresaData) { companyName = empresaData.nome || companyName; }
    }

    const reviewLink = `https://akuris.pt/review/${review.link_token}`;
    const formatDate = (dateStr?: string): string => { if (!dateStr) return 'Não definida'; try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return dateStr; } };

    const htmlContent = operationalEmail("review", {
      name: review.responsavel.nome || "Usuário", item: review.nome_revisao, system: review.sistema?.nome_sistema || "N/A", count: review.total_contas || 0, deadline: formatDate(review.data_limite), description: review.descricao, url: reviewLink
    });

    const emailResponse = aceitaEmail ? await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [review.responsavel.email], subject: `[Revisão de acesso] ${review.nome_revisao}`, html: sanitizeEmailDocument(htmlContent), text: htmlToText(htmlContent) }) : { skipped: 'destinatario dispensou o aviso por e-mail' };
    console.log('E-mail:', emailResponse);

    await supabaseClient.from('notifications').insert({ user_id: review.responsavel_revisao, title: 'Nova Revisão de Acesso Atribuída', message: `Você foi atribuído como responsável pela revisão "${review.nome_revisao}" do sistema ${review.sistema?.nome_sistema || 'N/A'}.`, type: 'info', link_to: '/revisao-acessos', metadata: { review_id: reviewId, tipo: 'revisao_atribuida' } });

    return new Response(JSON.stringify({ success: true, message: 'Notificação enviada com sucesso', emailResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
