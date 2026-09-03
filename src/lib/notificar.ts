/**
 * Envio de notificação in-app pela aplicação.
 *
 * Seis ecrãs faziam `supabase.from('notifications').insert(...)` diretamente e
 * descartavam o resultado. A tabela tem RLS com policies só de SELECT e UPDATE,
 * por isso TODOS eram recusados — e como o `await` era descartado, ninguém
 * ficava a saber: o risco era "enviado para aprovação" e o aprovador nunca
 * recebia nada.
 *
 * A escrita passa agora pela função `criar_notificacao`, que corre com
 * privilégio elevado mas só aceita destinatário da mesma empresa de quem chama.
 *
 * A falha não desfaz a ação: quando isto é chamado, o risco JÁ foi enviado e o
 * comentário JÁ foi gravado. O que não pode é continuar invisível — daí o aviso.
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { tGlobal } from '@/lib/i18n-global';
import { logger } from '@/lib/logger';

export interface Notificacao {
  /** `profiles.user_id` — é o que a policy de leitura compara com `auth.uid()`. */
  destinatario: string;
  titulo: string;
  mensagem?: string;
  tipo?: 'info' | 'success' | 'warning' | 'error';
  linkPara?: string;
  metadados?: Record<string, unknown>;
}

/** Escreve a notificação. Não avisa o utilizador — quem chama decide como. */
async function enviar(n: Notificacao): Promise<boolean> {
  if (!n.destinatario) return false;

  const { error } = await supabase.rpc('criar_notificacao', {
    p_user_id: n.destinatario,
    p_title: n.titulo,
    p_message: n.mensagem ?? null,
    p_type: n.tipo ?? 'info',
    p_link_to: n.linkPara ?? null,
    p_metadata: (n.metadados ?? {}) as never,
  });

  if (error) {
    logger.error('Falha ao criar notificação', error);
    return false;
  }
  return true;
}

/**
 * Cria a notificação. Devolve `true` em caso de sucesso.
 *
 * Nunca lança: quem chama já concluiu a operação principal e não deve reverter
 * por causa do aviso. Em caso de falha mostra um toast e regista no logger.
 */
export async function notificar(n: Notificacao): Promise<boolean> {
  const ok = await enviar(n);
  if (!ok && n.destinatario) toast.warning(tGlobal('notifications.sendFailed'));
  return ok;
}

/**
 * Notifica vários destinatários com um único aviso no fim — um toast por
 * menção falhada encheria o ecrã num comentário que mencione a equipa toda.
 * Devolve quantos falharam.
 */
export async function notificarVarios(
  destinatarios: string[],
  base: Omit<Notificacao, 'destinatario'>,
): Promise<number> {
  const r = await Promise.all(destinatarios.map((d) => enviar({ ...base, destinatario: d })));
  const falhas = r.filter((ok) => !ok).length;
  if (falhas > 0) toast.warning(tGlobal('notifications.sendFailedMany', { total: falhas }));
  return falhas;
}
