import { operationalEmail } from "../_shared/operational-email.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Resend } from "npm:resend@2.0.0";
import { htmlToText, sanitizeEmailDocument } from "../_shared/email.ts";

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
    /*
      O cliente de e-mail so nasce quando ha e-mail para enviar.

      Estava aqui, na primeira linha do handler: `new Resend(undefined)` lanca
      quando `RESEND_API_KEY` falta, e o handler inteiro morria com 500 --
      levando com ele o AVISO NO SINO, que esta mais abaixo e cujo proprio
      comentario diz que existe porque "e-mail cai em spam, e uma denuncia com
      prazo de 7 dias nao pode depender disso".

      Medido, com a chave ausente: denuncia criada, protocolo emitido,
      `notifications` com ZERO linhas. A denuncia entrava e ninguem sabia.
      Tambem se perdia o `console.error` que assinala empresa sem comite.

      Agora a falta da chave custa o e-mail, e so o e-mail.
    */
    const chaveResend = Deno.env.get('RESEND_API_KEY');

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
      const { data: callerProfile } = await supabaseClient.from('profiles').select('empresa_id').eq('user_id', callerId).eq('ativo', true).single();
      const body = await req.clone().json();
      if (!callerProfile?.empresa_id || callerProfile.empresa_id !== body.empresa_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    const { denuncia_id, empresa_id }: NotificationRequest = await req.json();

    const { data: denuncia, error: denunciaError } = await supabaseClient.from('denuncias').select(`*, categoria:denuncias_categorias(nome), empresa:empresas(nome, logo_url)`).eq('id', denuncia_id).single();
    /*
      Falhar a LER nao e a denuncia nao existir.

      Esta linha dizia 'Denuncia nao encontrada' para os dois casos, e por isso
      escondeu durante todo este tempo o defeito real: `denuncias` nao tinha
      chave estrangeira para `empresas`, o embed devolvia PGRST200, e o aviso
      ao comite nunca saia. Quem lesse o log via uma denuncia que nao existe --
      e ela existia, com protocolo emitido.
    */
    if (denunciaError) {
      console.error('[send-denuncia-notification] leitura falhou:', denunciaError.message, denunciaError.code ?? '');
      throw new Error(`Nao foi possivel ler a denuncia: ${denunciaError.message}`);
    }
    if (!denuncia) throw new Error('Denúncia não encontrada');
    if (denuncia.empresa_id !== empresa_id) {
      return new Response(JSON.stringify({ error: 'Denúncia de outra empresa' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      ? await supabaseClient.from('profiles').select('user_id, email, nome').eq('notificar_por_email', true).eq('ativo', true).in('user_id', comiteIds)
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
    /* Sem chave nao ha e-mail -- mas o aviso no sino ja foi criado acima, que e
       o que nao pode faltar. Devolve-se sucesso com a contagem, para quem
       chamou saber o que aconteceu de facto. */
    if (!chaveResend) {
      console.warn('[send-denuncia-notification] RESEND_API_KEY ausente: avisos no sino criados, e-mail nao enviado');
      return new Response(JSON.stringify({ success: true, avisos_app: comiteIds.length, emails: 0, message: 'RESEND_API_KEY ausente' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const resend = new Resend(chaveResend);
    if (emailList.size === 0) return new Response(JSON.stringify({ success: true, avisos_app: comiteIds.length, message: 'Nenhum e-mail válido' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // O mapa de rótulos tem de aceitar o vocabulário gravado hoje (masculino)
    // sem perder os registos antigos que ainda cheguem no feminino.
    const gravidadeMap: Record<string, string> = {
      baixo: 'Baixa', medio: 'Média', alto: 'Alta', critico: 'Crítica',
      baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
    };
    const companyName = denuncia.empresa?.nome || 'Akuris';

    const emailHtml = operationalEmail("report", {
      item: denuncia.titulo, code: denuncia.protocolo, description: denuncia.descricao, company: companyName, severity: gravidadeMap[denuncia.gravidade] || denuncia.gravidade, type: denuncia.anonima ? "Anônima" : "Identificada", category: denuncia.categoria?.nome, date: new Date(denuncia.created_at).toLocaleString("pt-BR"), tone: severidadeCanonica(denuncia.gravidade) === "critico" ? "danger" : "warning", url: "https://akuris.pt/denuncia"
    });

    const emailPromises = Array.from(emailList).map(async (email) => {
      try {
        const { error: emailError } = await resend.emails.send({ from: 'Akuris <noreply@akuris.com.br>', to: [email], subject: `[Nova denúncia] Protocolo ${denuncia.protocolo}`, html: sanitizeEmailDocument(emailHtml), text: htmlToText(emailHtml) });
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
