/**
 * avisar-denunciante — diz a quem denunciou que há novidade, e mais nada.
 *
 * O canal não avisava ninguém do lado de fora. O comité respondia, acusava o
 * recebimento, mudava o estado, e a pessoa só descobria se voltasse ao portal
 * por vontade própria e reescrevesse protocolo e código. Num processo de três
 * meses, é assim que o retorno é dado e nunca é recebido.
 *
 * ## O que este e-mail NÃO leva
 *
 * Nem o título da denúncia, nem o texto da mensagem do comité, nem o estado,
 * nem a categoria. E nem o código de acompanhamento, que é a credencial: quem
 * o recebeu já o tem, e quem intercepta a caixa não o deve ganhar de graça.
 *
 * A razão é simples: o e-mail sai do perímetro e a caixa pode não ser só da
 * pessoa. Muita gente denuncia a partir do e-mail da empresa que está a
 * denunciar. O que vai é o mínimo que faz a pessoa voltar: houve novidade, é
 * aqui.
 *
 * Pela mesma razão o assunto não diz «denúncia». Diz que há uma atualização no
 * processo, com o protocolo — que a pessoa já conhece e que, sozinho, não abre
 * nada.
 *
 * ## Quem não recebe
 *
 * Quem escolheu não se identificar. Não é falha: é a promessa do canal a ser
 * cumprida — não há contacto guardado, e não vai passar a haver. A decisão de
 * quem pode ser avisado está em `destinatario_do_aviso_ao_denunciante`, no
 * banco, e não aqui: é a mesma regra para qualquer chamador.
 */
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Resend } from 'npm:resend@2.0.0';
import { htmlToText, sanitizeEmailDocument } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

/**
 * Por que motivo se avisa.
 *
 * Serve só para a primeira linha do e-mail dizer o género da novidade sem
 * dizer o conteúdo: «respondeu-lhe» é diferente de «marcou uma reunião», e
 * nenhum dos dois revela o caso.
 */
const MOTIVOS: Record<string, { pt: string; en: string }> = {
  mensagem: {
    pt: 'O comité respondeu na conversa do seu processo.',
    en: 'The committee has replied in the conversation about your case.',
  },
  recebimento: {
    pt: 'O recebimento do seu processo foi confirmado.',
    en: 'Receipt of your case has been acknowledged.',
  },
  estado: {
    pt: 'O andamento do seu processo mudou.',
    en: 'The progress of your case has changed.',
  },
  reuniao: {
    pt: 'Há novidades sobre a reunião que pediu.',
    en: 'There is news about the meeting you requested.',
  },
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, chaveServico);

    /*
      Duas portas, como em `send-denuncia-notification`: um membro do comité
      com sessão, ou uma chamada interna com a chave de serviço.
    */
    const cabecalho = req.headers.get('Authorization');
    if (!cabecalho?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const token = cabecalho.replace('Bearer ', '');
    const chamadaInterna = token === chaveServico;

    const { denuncia_id, motivo, idioma } = await req.json();
    if (!denuncia_id) return json({ error: 'denuncia_id em falta' }, 400);

    const { data: denuncia, error: erroDenuncia } = await supabase
      .from('denuncias')
      .select('id, empresa_id')
      .eq('id', denuncia_id)
      .maybeSingle();
    if (erroDenuncia) return json({ error: 'leitura falhou', detalhe: erroDenuncia.code }, 500);
    if (!denuncia) return json({ error: 'nao_encontrada' }, 404);

    if (!chamadaInterna) {
      const verificador = createClient(supabaseUrl, chaveServico);
      const { data: sessao, error: erroSessao } = await verificador.auth.getUser(token);
      if (erroSessao || !sessao?.user?.id) return json({ error: 'Unauthorized' }, 401);

      /*
        Só quem está no comité daquela empresa. Não basta ser da empresa: quem
        não pode abrir a denúncia também não pode fazer sair um e-mail sobre
        ela — é a mesma fronteira que a RLS impõe com `pode_ver_denuncia`.
      */
      const { data: membro } = await supabase
        .from('denuncias_comite')
        .select('user_id')
        .eq('empresa_id', denuncia.empresa_id)
        .eq('user_id', sessao.user.id)
        .maybeSingle();
      if (!membro) return json({ error: 'Forbidden' }, 403);
    }

    const { data: destino, error: erroDestino } = await supabase.rpc(
      'destinatario_do_aviso_ao_denunciante',
      { p_denuncia_id: denuncia_id },
    );
    if (erroDestino) return json({ error: 'leitura falhou', detalhe: erroDestino.code }, 500);

    /* Anónima, sem e-mail, ou aviso desligado no canal. Não é erro. */
    if (!destino) return json({ enviado: false, motivo: 'sem_destinatario' });

    const chaveResend = Deno.env.get('RESEND_API_KEY');
    if (!chaveResend) {
      console.error('RESEND_API_KEY ausente: aviso ao denunciante nao enviado');
      return json({ enviado: false, motivo: 'sem_chave_de_email' });
    }

    const en = String(idioma ?? 'pt').startsWith('en');
    const linha = (MOTIVOS[String(motivo ?? '')] ?? MOTIVOS.estado)[en ? 'en' : 'pt'];
    const site = Deno.env.get('SITE_URL') ?? 'https://akuris.pt';
    const url = `${site}/${destino.empresa_slug}/denuncia/consulta`;

    const assunto = en
      ? `Update on your case ${destino.protocolo}`
      : `Atualização no seu processo ${destino.protocolo}`;

    const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">${linha}</p>
  <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 24px">
    ${en
      ? `Open the channel of ${destino.empresa_nome} and look it up with your protocol number and the tracking code you received when you submitted it. We do not include either the code or any detail of the case in this email.`
      : `Abra o canal de ${destino.empresa_nome} e consulte com o número de protocolo e o código de acompanhamento que recebeu ao submeter. Não incluímos aqui nem o código nem qualquer detalhe do caso.`}
  </p>
  <p style="margin:0 0 24px">
    <a href="${url}" style="display:inline-block;background:#7552ff;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">
      ${en ? 'Open the channel' : 'Abrir o canal'}
    </a>
  </p>
  <p style="font-size:12px;line-height:1.6;color:#888;margin:0">
    ${en
      ? `Protocol ${destino.protocolo}. If you did not submit anything, ignore this message.`
      : `Protocolo ${destino.protocolo}. Se não submeteu nada, ignore esta mensagem.`}
  </p>
</div>`;

    const resend = new Resend(chaveResend);
    const { error: erroEmail } = await resend.emails.send({
      from: 'Akuris <noreply@akuris.com.br>',
      to: [destino.email],
      subject: assunto,
      html: sanitizeEmailDocument(html),
      text: htmlToText(html),
    });
    if (erroEmail) {
      console.error('Aviso ao denunciante falhou:', erroEmail);
      return json({ enviado: false, motivo: 'envio_falhou' });
    }

    return json({ enviado: true });
  } catch (e) {
    console.error('avisar-denunciante:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
