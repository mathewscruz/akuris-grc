// Guarda para funções que não são para o público.
//
// ## O buraco que isto fecha
//
// Há funções de borda que existem para serem chamadas por um agendador ou por
// outra função — nunca por um browser anónimo. Estavam publicadas com
// `verify_jwt = false` e sem qualquer verificação própria, o que quer dizer que
// qualquer pessoa na internet, sabendo o URL, as podia disparar à vontade:
// e-mails de lembrete em catadupa a partir do domínio de confiança da
// plataforma, com o custo e o descrédito que isso traz.
//
// `verify_jwt = false` tem de continuar em algumas delas — um agendador externo
// não traz JWT de utilizador. Por isso a porta fecha-se aqui dentro, no código.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export class AcessoNegado extends Error {
  status: number;
  constructor(message = "Não autorizado", status = 401) {
    super(message);
    this.status = status;
  }
}

/** O token que veio no cabeçalho, ou null. */
function tokenDoPedido(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length).trim() || null;
}

/**
 * Só passa quem chama por dentro: outra função de borda ou um agendador, ambos
 * de posse da chave de serviço.
 *
 * A comparação é feita com a chave inteira e em tempo constante, para não dar
 * pistas por diferença de tempo de resposta.
 */
export function exigeChamadaInterna(req: Request): void {
  const esperado = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const recebido = tokenDoPedido(req);
  if (!esperado || !recebido || !comparaEmTempoConstante(recebido, esperado)) {
    throw new AcessoNegado("Esta função é interna");
  }
}

/**
 * Passa quem chama por dentro (chave de serviço) OU um utilizador autenticado
 * da plataforma — para as funções que também têm um botão no produto.
 *
 * Devolve o `empresaId` do utilizador quando a chamada vem de uma sessão, e
 * `null` quando vem de dentro (aí quem chama já sabe de que empresa trata).
 */
export async function exigeInternaOuUtilizador(
  req: Request,
): Promise<{
  interna: boolean;
  userId: string | null;
  empresaId: string | null;
  role: string | null;
  mfaValida: boolean;
}> {
  const recebido = tokenDoPedido(req);
  if (!recebido) throw new AcessoNegado("Falta o token");

  const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (servico && comparaEmTempoConstante(recebido, servico)) {
    return {
      interna: true,
      userId: null,
      empresaId: null,
      role: null,
      mfaValida: true,
    };
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || servico!;
  const verificador = createClient(url, anon);
  const { data, error } = await verificador.auth.getUser(recebido);
  if (error || !data?.user) throw new AcessoNegado("Sessão inválida");

  const admin = createClient(url, servico!);
  const { data: perfil, error: perfilErro } = await admin
    .from("profiles")
    .select("empresa_id, role, ativo")
    .eq("user_id", data.user.id)
    .single();

  if (perfilErro || !perfil?.empresa_id || perfil.ativo !== true) {
    throw new AcessoNegado("Perfil inativo ou sem empresa", 403);
  }

  const clienteDaSessao = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${recebido}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: mfaValida } = await clienteDaSessao.rpc("has_valid_mfa_session");

  return {
    interna: false,
    userId: data.user.id,
    empresaId: perfil.empresa_id,
    role: perfil.role ?? null,
    mfaValida: mfaValida === true,
  };
}

/** Resposta uniforme, sem detalhe interno para quem não devia ter passado. */
export function respostaAcessoNegado(err: unknown, corsHeaders: Record<string, string>) {
  const status = err instanceof AcessoNegado ? err.status : 500;
  const message = err instanceof AcessoNegado ? err.message : "Erro interno";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function comparaEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}
