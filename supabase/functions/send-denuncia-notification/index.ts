import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Resend } from "npm:resend@2.0.0";

import { severidadeCanonica, isSevero } from '../_shared/severidade.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest { denuncia_id: string; empresa_id: string; }

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Auth: this function is triggered post-submission. Accept either:
    //   (a) a valid JWT from an admin/user of the same empresa, OR
    //   (b) the SERVICE_ROLE_KEY as bearer (DB trigger / internal call)
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const token = authHeader.replace('Bearer ', '');
    const isServiceCall = token === serviceKey;
    if (!isServiceCall) {
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: userData, error: claimsError } = await authClient.auth.getUser(token);
      if (claimsError || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const callerId = userData.user.id as string;
      const { data: callerProfile } = await supabaseClient.from('profiles').select('empresa_id').eq('user_id', callerId).single();
      const body = await req.clone().json();
      if (!callerProfile?.empresa_id || callerProfile.empresa_id !== body.empresa_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    const { denuncia_id, empresa_id }: NotificationRequest = await req.json();

    const { data: denuncia, error: denunciaError } = await supabaseClient.from('denuncias').select(`*, categoria:denuncias_categorias(nome), empresa:empresas(nome, logo_url)`).eq('id', denuncia_id).single();
    if (denunciaError || !denuncia) throw new Error('Denúncia não encontrada');

    const { data: config } = await supabaseClient.from('denuncias_configuracoes').select('*').eq('empresa_id', empresa_id).single();
    if (!config || !config.notificar_administradores) return new Response(JSON.stringify({ success: true, message: 'Notificações desabilitadas' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    /*
      Quem e avisado e o COMITE, nao os administradores.

      A onda 1 tirou a denuncia de toda a administracao: quem ve e quem esta em
      `denuncias_comite` ou foi designado responsavel (`pode_ver_denuncia`).
      Esta funcao continuava a procurar `profiles` com papel de admin — ou
      seja, avisava exactamente quem NAO consegue abrir o caso, e calava quem
      consegue.
    */
    const { data: membros } = await supabaseClient
      .from('denuncias_comite')
      .select('user_id')
      .eq('empresa_id', empresa_id);

    const comiteIds = (membros ?? []).map((m: { user_id: string }) => m.user_id);
    const { data: perfisComite } = comiteIds.length
      ? await supabaseClient.from('profiles').select('user_id, email, nome').in('user_id', comiteIds)
      : { data: [] as { user_id: string; email: string | null; nome: string | null }[] };

    const emailList = new Set<string>();
    (perfisComite ?? []).forEach((p) => { if (p.email) emailList.add(p.email); });

    /*
      O aviso dentro da aplicacao, alem do e-mail.

      E-mail cai em spam, e uma denuncia com prazo de 7 dias nao pode depender
      disso. `notifications` nao tem policy de INSERT — mas esta funcao corre
      com a chave de servico, que passa por cima da RLS.
    */
    if (comiteIds.length > 0) {
      const { error: erroAviso } = await supabaseClient.from('notifications').insert(
        comiteIds.map((userId: string) => ({
          user_id: userId,
          title: `Nova denuncia - ${denuncia.protocolo}`,
          message: denuncia.titulo,
          type: 'warning',
          link_to: '/denuncia',
          metadata: { modulo: 'denuncia', denuncia_id, protocolo: denuncia.protocolo },
        })),
      );
      if (erroAviso) console.error('Falha ao criar aviso na aplicacao:', erroAviso.message);
    }

    if (comiteIds.length === 0) {
      console.error(`Empresa ${empresa_id} recebeu denuncia e nao tem comite: ninguem sera avisado nem conseguira abrir o caso.`);
    }
    if (config.emails_notificacao?.length > 0) config.emails_notificacao.forEach((email: string) => { if (email?.includes('@')) emailList.add(email.trim()); });
    if (emailList.size === 0) return new Response(JSON.stringify({ success: true, avisos_app: comiteIds.length, message: 'Nenhum e-mail válido' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // O mapa de rótulos tem de aceitar o vocabulário gravado hoje (masculino)
    // sem perder os registos antigos que ainda cheguem no feminino.
    const gravidadeMap: Record<string, string> = {
      baixo: 'Baixa', medio: 'Média', alto: 'Alta', critico: 'Crítica',
      baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
    };
    const companyName = denuncia.empresa?.nome || 'Akuris';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0a1628; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: ${severidadeCanonica(denuncia.gravidade) === 'critico' ? '#dc2626' : severidadeCanonica(denuncia.gravidade) === 'alto' ? '#f97316' : '#f59e0b'}; padding: 16px 32px; text-align: center;">
      <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">🚨 Nova Denúncia - ${gravidadeMap[denuncia.gravidade] || denuncia.gravidade}</span>
    </div>
    <div style="text-align: center; padding: 24px 32px 16px;">
      <!-- Logotipo da EMPRESA. A consulta acima ja traz empresa(nome, logo_url);
           o template ignorava-o e punha a marca da Akuris fixa. Quem recebe
           este aviso trabalha na empresa denunciada, e num produto revendido
           mostrar a marca do fornecedor entrega ao cliente final quem lhe
           fornece a ferramenta. Sem logotipo, cai no nome em texto. -->
      ${denuncia.empresa?.logo_url
        ? `<img src="${denuncia.empresa.logo_url}" alt="${denuncia.empresa?.nome ?? ''}" style="display:block;margin:0 auto;max-height:60px;max-width:200px;" />`
        : `<div style="text-align:center;font-size:20px;font-weight:600;color:#1f2937;">${denuncia.empresa?.nome ?? 'Canal de Denúncias'}</div>`}
    </div>
    <div style="padding: 0 32px 32px;">
      <h1 style="font-size: 22px; color: #0a1628; margin: 0 0 24px; font-weight: 600;">Nova Denúncia Recebida</h1>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #64748b; margin: 0 0 4px; text-transform: uppercase;">Protocolo</p>
          <p style="font-size: 18px; color: #0a1628; margin: 0; font-weight: 700; font-family: Monaco, Consolas, monospace;">${denuncia.protocolo}</p>
        </div>
        <div style="margin-bottom: 12px;">
          <p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">Título</p>
          <p style="font-size: 15px; color: #0a1628; margin: 0; font-weight: 600;">${denuncia.titulo}</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div><p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">Gravidade</p>
            <span style="display: inline-block; padding: 4px 12px; background-color: ${severidadeCanonica(denuncia.gravidade) === 'critico' ? '#fee2e2' : severidadeCanonica(denuncia.gravidade) === 'alto' ? '#ffedd5' : '#fef3c7'}; color: ${severidadeCanonica(denuncia.gravidade) === 'critico' ? '#991b1b' : severidadeCanonica(denuncia.gravidade) === 'alto' ? '#9a3412' : '#92400e'}; border-radius: 4px; font-size: 12px; font-weight: 600;">${gravidadeMap[denuncia.gravidade] || denuncia.gravidade}</span></div>
          <div><p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">Tipo</p><p style="font-size: 14px; color: #0a1628; margin: 0;">${denuncia.anonima ? 'Anônima' : 'Identificada'}</p></div>
        </div>
        ${denuncia.categoria ? `<div style="margin-bottom: 12px;"><p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">Categoria</p><p style="font-size: 14px; color: #0a1628; margin: 0;">${denuncia.categoria.nome}</p></div>` : ''}
        <div><p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">Data/Hora</p><p style="font-size: 14px; color: #0a1628; margin: 0;">${new Date(denuncia.created_at).toLocaleString('pt-BR')}</p></div>
      </div>
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="font-size: 12px; color: #64748b; margin: 0 0 8px; text-transform: uppercase;">Descrição</p>
        <p style="font-size: 14px; color: #475569; margin: 0; white-space: pre-wrap;">${denuncia.descricao}</p>
      </div>
      <div style="background-color: #fffbeb; border-radius: 8px; padding: 16px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #92400e; margin: 0;"><strong>Ação Necessária:</strong> Uma nova denúncia foi registrada e requer sua atenção.</p>
      </div>
      <div style="text-align: center;">
        <a href="https://akuris.com.br/denuncia" style="display: inline-block; background-color: #7552ff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Acessar Canal de Denúncias</a>
      </div>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">Esta é uma mensagem automática do sistema Akuris.<br>Trate esta informação com confidencialidade.</p>
      <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0;">© ${new Date().getFullYear()} Akuris. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    const emailPromises = Array.from(emailList).map(async (email) => {
      try {
        const { error: emailError } = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [email], subject: `Nova Denúncia - Protocolo ${denuncia.protocolo}`, html: emailHtml });
        if (emailError) return { email, success: false, error: emailError };
        return { email, success: true };
      } catch (error) { return { email, success: false, error }; }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({ success: true, sent: successCount, total: results.length, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Erro na função de notificação:', error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) || 'Erro interno do servidor' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
};

serve(handler);
