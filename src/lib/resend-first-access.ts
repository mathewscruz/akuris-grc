import { supabase } from '@/integrations/supabase/client';

/** Reenvio individual e em lote só confirmam um envio reconhecido pelo servidor. */
export async function resendFirstAccessEmail(userId: string, fallbackMessage: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('resend-welcome-email', {
    body: { userId },
  });

  if (error) {
    let message = fallbackMessage;
    try {
      const response = error.context;
      if (response instanceof Response) {
        const body = await response.clone().json();
        if (typeof body?.error === 'string' && body.error) message = body.error;
      }
    } catch { /* Respostas sem JSON não devem esconder a mensagem de orientação. */ }
    throw new Error(message);
  }

  if (data?.success !== true) {
    throw new Error(typeof data?.error === 'string' && data.error ? data.error : fallbackMessage);
  }
}
