// Shared helpers for AI Gateway calls: timeout, model catalog, credit safety.

export const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Modelos suportados centralizados. Usar SEMPRE via DEFAULT_CHAT_MODEL.
export const DEFAULT_CHAT_MODEL = 'google/gemini-3-flash-preview';
export const DEFAULT_CHAT_MODEL_LITE = 'google/gemini-3-flash-preview';

/**
 * fetch com AbortController + timeout. Retorna Response ou lança Error("timeout").
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return resp;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`AI Gateway timeout após ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chama o AI Gateway com timeout e retorna a Response bruta.
 * Não consome crédito — quem chama deve consumir SOMENTE após response.ok.
 */
export async function callAiGateway(payload: {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: any;
}, apiKey: string, timeoutMs = 30000): Promise<Response> {
  return fetchWithTimeout(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: payload.model || DEFAULT_CHAT_MODEL,
      messages: payload.messages,
      ...(payload.temperature !== undefined ? { temperature: payload.temperature } : {}),
      ...(payload.max_tokens !== undefined ? { max_tokens: payload.max_tokens } : {}),
      ...(payload.response_format ? { response_format: payload.response_format } : {}),
    }),
  }, timeoutMs);
}
