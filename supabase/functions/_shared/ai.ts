// Shared helpers for AI Gateway calls: timeout, model catalog, credit safety.
import { MODELOS } from './modelos.ts';

export const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Modelos suportados centralizados. Usar SEMPRE via DEFAULT_CHAT_MODEL.
/* Os níveis vivem em `modelos.ts`. Estes dois nomes ficam por compatibilidade
   — e apontavam AMBOS para o mesmo `-preview`, ou seja o «lite» nunca foi
   mais leve do que o outro. */
export const DEFAULT_CHAT_MODEL = MODELOS.PADRAO;
export const DEFAULT_CHAT_MODEL_LITE = MODELOS.MECANICO;

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

/**
 * Chamada das análises de topo com plano B. Tenta o modelo pedido; se o
 * fornecedor falhar (5xx, 408 ou timeout/rede), repete UMA vez em
 * `MODELOS.RESERVA`, noutro fornecedor. A resposta da reserva traz o
 * cabeçalho `x-akuris-reserva: 1` (resultado simplificado).
 * 402/403/429/4xx não mudam de modelo: não são avaria do fornecedor.
 */
export async function fetchAnaliseComReserva(url: string, init: RequestInit, timeoutMs = 90000): Promise<Response> {
  try {
    const r = await fetchWithTimeout(url, init, timeoutMs);
    if (r.status < 500 && r.status !== 408) return r;
    await r.body?.cancel().catch(() => {});
  } catch (_) { /* rede/timeout: segue para a reserva */ }
  const corpo = JSON.parse(String(init.body ?? '{}'));
  corpo.model = MODELOS.RESERVA;
  if (corpo.max_tokens !== undefined) { corpo.max_completion_tokens = corpo.max_tokens; delete corpo.max_tokens; }
  delete corpo.temperature;
  const r2 = await fetchWithTimeout(url, { ...init, body: JSON.stringify(corpo) }, timeoutMs);
  const h = new Headers(r2.headers); h.set('x-akuris-reserva', '1');
  return new Response(r2.body, { status: r2.status, statusText: r2.statusText, headers: h });
}
