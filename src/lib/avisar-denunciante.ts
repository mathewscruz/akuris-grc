/**
 * Avisar quem denunciou de que há novidade.
 *
 * O canal só falava para dentro. Quem denunciou tinha de voltar ao portal por
 * iniciativa própria e reescrever protocolo e código para descobrir se alguém
 * lhe tinha respondido — num processo que dura três meses.
 *
 * Está aqui, e não em cada ecrã, porque os pontos de atualização são quatro e
 * hão-de ser cinco: a conversa, a acusação de recebimento, a mudança de estado
 * e a reunião. Um aviso escrito quatro vezes é um aviso que falta no quinto.
 *
 * ## Falha em silêncio, de propósito
 *
 * O trabalho do comité não pode ser desfeito porque um e-mail não saiu. Se o
 * envio falhar — chave em falta, Resend em baixo, denúncia anónima — a acção
 * que o originou permanece e o utilizador não vê erro nenhum. O que se perde é
 * o aviso, e isso fica no log.
 *
 * Nunca leva conteúdo: quem decide o que vai no e-mail é a função de borda, e
 * o que vai é o mínimo (ver `supabase/functions/avisar-denunciante`).
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { getAppLocale } from '@/lib/i18n-locale';

/** O género da novidade — nunca o seu conteúdo. */
export type MotivoDoAviso = 'mensagem' | 'recebimento' | 'estado' | 'reuniao';

export async function avisarDenunciante(
  denunciaId: string,
  motivo: MotivoDoAviso,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('avisar-denunciante', {
      body: { denuncia_id: denunciaId, motivo, idioma: getAppLocale() },
    });
    if (error) throw error;
    /* «Sem destinatário» é o caso normal de uma denúncia anónima, não um
       problema: fica no log como informação, não como erro. */
    if (data && data.enviado === false) {
      logger.info('Aviso ao denunciante não enviado', { motivo, razao: data.motivo });
    }
  } catch (e) {
    logger.error('Falha ao avisar o denunciante', {
      motivo,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
