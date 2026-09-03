import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';

interface InvokeOptions {
  body?: Record<string, unknown>;
  /** Custom error messages per status code */
  errorMessages?: Partial<Record<number, string>>;
  /** Whether to show toast on error (default true) */
  showToast?: boolean;
  /** Marca a chamada como consumidora de créditos de IA — emite eventos para o useAiCredits */
  isAiCall?: boolean;
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

const DEFAULT_ERROR_MESSAGES: Record<number, string> = {
  402: 'Créditos de IA esgotados. Entre em contato com o administrador da sua conta.',
  429: 'Muitas requisições. Aguarde um momento e tente novamente.',
  401: 'Sessão expirada. Faça login novamente.',
  403: 'Você não tem permissão para esta ação.',
  500: 'Erro interno no servidor. Tente novamente.',
};

/**
 * O status HTTP de um erro de Edge Function, sem precisar de `await`.
 *
 * O supabase-js embrulha a resposta num `FunctionsHttpError` e guarda o status
 * em `error.context.status` — quem lê `error.status` recebe sempre `undefined`.
 * Foi assim que o aviso de "créditos de IA esgotados" deixou de aparecer no
 * painel de orientação do Gap Analysis: a condição nunca era verdadeira e a
 * falha ficava muda.
 */
export function statusDeErroDeFuncao(error: unknown): number | null {
  const e = error as any;
  if (typeof e?.status === 'number') return e.status;
  const ctx = e?.context;
  if (typeof ctx?.status === 'number') return ctx.status;
  if (typeof Response !== 'undefined' && ctx instanceof Response) return ctx.status;
  return null;
}

/** Tenta extrair o status HTTP real da resposta da Edge Function */
async function extractStatus(error: any): Promise<number> {
  const direct = (error as any)?.status;
  if (typeof direct === 'number') return direct;
  // FunctionsHttpError expõe o response em error.context
  const ctx = (error as any)?.context;
  if (ctx?.status && typeof ctx.status === 'number') return ctx.status;
  if (ctx instanceof Response) return ctx.status;
  return 500;
}

/**
 * Centralized wrapper for invoking Supabase Edge Functions
 * with consistent error handling and AI-credit awareness.
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<InvokeResult<T>> {
  const { body, errorMessages = {}, showToast = true, isAiCall = false } = options;

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body || {},
    });

    if (error) {
      const statusCode = await extractStatus(error);
      const messages = { ...DEFAULT_ERROR_MESSAGES, ...errorMessages };
      const message = messages[statusCode] || `Erro ao executar ${functionName}.`;

      // Emite evento global de créditos esgotados para o banner / hook
      if (statusCode === 402 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai-credits-exhausted', { detail: { functionName } }));
      }

      if (showToast) toast.error(message);
      return { data: null, error: new Error(message) };
    }

    // Sucesso: se foi chamada de IA, decrementa o saldo localmente
    if (isAiCall && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-credit-consumed', { detail: { functionName } }));
    }

    return { data: data as T, error: null };
  } catch (err) {
    const isNetworkError =
      !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'));

    const message = isNetworkError
      ? 'Sem conexão com o servidor. Verifique sua internet.'
      : `Erro inesperado ao executar ${functionName}.`;

    if (showToast) toast.error(message);
    return { data: null, error: err instanceof Error ? err : new Error(message) };
  }
}
