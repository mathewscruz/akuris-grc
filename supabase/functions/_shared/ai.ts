// Shared helpers for AI Gateway calls: timeout, model catalog, credit safety.
import { MODELOS } from './modelos.ts';

export const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Modelos suportados centralizados. Usar SEMPRE via DEFAULT_CHAT_MODEL.
/* Os níveis vivem em `modelos.ts`. Estes dois nomes ficam por compatibilidade
   — e apontavam AMBOS para o mesmo `-preview`, ou seja o «lite» nunca foi
   mais leve do que o outro. */
export const DEFAULT_CHAT_MODEL = MODELOS.PADRAO;
export const DEFAULT_CHAT_MODEL_LITE = MODELOS.MECANICO;


// ---------- registo de uso por modelo (tabela ia_uso_modelos) ----------
let FUNCAO_IA = 'desconhecida';
/** Cada função chama uma vez no topo: identifica as suas chamadas no registo. */
export function rotularFuncaoIA(nome: string) { FUNCAO_IA = nome; }

function lerModelo(init: RequestInit): string {
  try { return String(JSON.parse(String(init.body ?? '{}')).model ?? 'desconhecido'); } catch { return 'desconhecido'; }
}

/** Grava a chamada sem atrasar a resposta. Nunca lança. */
export function registarUsoIA(r: { modelo: string; resposta?: Response | null; inicio: number; reserva?: boolean; empresaId?: string | null; funcionalidade?: string }) {
  const tarefa = (async () => {
    try {
      const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) return;
      let tin: number | null = null, tout: number | null = null;
      const resp = r.resposta;
      if (resp?.ok && (resp.headers.get('content-type') ?? '').includes('json')) {
        const j = await resp.clone().json().catch(() => null);
        tin = j?.usage?.prompt_tokens ?? null; tout = j?.usage?.completion_tokens ?? null;
      }
      await fetch(`${url}/rest/v1/ia_uso_modelos`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          empresa_id: r.empresaId ?? null, funcionalidade: r.funcionalidade ?? FUNCAO_IA, modelo: r.modelo,
          reserva: !!r.reserva, tokens_entrada: tin, tokens_saida: tout,
          duracao_ms: Date.now() - r.inicio, sucesso: !!resp?.ok, status_http: resp?.status ?? null,
        }),
      });
    } catch (_) { /* registo nunca derruba a funcionalidade */ }
  })();
  const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  rt?.waitUntil ? rt.waitUntil(tarefa) : void tarefa;
}

/** `fetch` ao gateway que regista modelo, tokens, tempo e sucesso. */
export async function fetchIA(url: string, init: RequestInit = {}): Promise<Response> {
  const inicio = Date.now(); const modelo = lerModelo(init);
  try {
    const r = await fetch(url, init);
    registarUsoIA({ modelo, resposta: r, inicio });
    return r;
  } catch (e) { registarUsoIA({ modelo, resposta: null, inicio }); throw e; }
}

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
  const inicio = Date.now(); const modelo = payload.model || DEFAULT_CHAT_MODEL;
  const r = await fetchWithTimeout(AI_GATEWAY_URL, {
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
  }, timeoutMs).catch((e) => { registarUsoIA({ modelo, inicio }); throw e; });
  registarUsoIA({ modelo, resposta: r, inicio });
  return r;
}

/**
 * Chamada das análises de topo com plano B. Tenta o modelo pedido; se o
 * fornecedor falhar (5xx, 408 ou timeout/rede), repete UMA vez em
 * `MODELOS.RESERVA`, noutro fornecedor. A resposta da reserva traz o
 * cabeçalho `x-akuris-reserva: 1` (resultado simplificado).
 * 402/403/429/4xx não mudam de modelo: não são avaria do fornecedor.
 */
export async function fetchAnaliseComReserva(url: string, init: RequestInit, timeoutMs = 90000): Promise<Response> {
  const inicio = Date.now(); const modelo = lerModelo(init);
  try {
    const r = await fetchWithTimeout(url, init, timeoutMs);
    registarUsoIA({ modelo, resposta: r, inicio });
    if (r.status < 500 && r.status !== 408) return r;
    await r.body?.cancel().catch(() => {});
  } catch (_) { registarUsoIA({ modelo, inicio }); /* rede/timeout: segue para a reserva */ }
  const corpo = JSON.parse(String(init.body ?? '{}'));
  corpo.model = MODELOS.RESERVA;
  if (corpo.max_tokens !== undefined) { corpo.max_completion_tokens = corpo.max_tokens; delete corpo.max_tokens; }
  delete corpo.temperature;
  const inicio2 = Date.now();
  const r2 = await fetchWithTimeout(url, { ...init, body: JSON.stringify(corpo) }, timeoutMs);
  registarUsoIA({ modelo: MODELOS.RESERVA, resposta: r2, inicio: inicio2, reserva: true });
  const h = new Headers(r2.headers); h.set('x-akuris-reserva', '1');
  return new Response(r2.body, { status: r2.status, statusText: r2.statusText, headers: h });
}
