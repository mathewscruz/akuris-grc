/**
 * A franquia do plano decide ANTES de o modelo ser chamado.
 *
 * Como estava: cada função chamava o modelo, recebia a resposta, entregava-a,
 * e só então pedia `consume_ai_credit`. Essa função devolve `false` quando a
 * franquia acabou — e treze das quinze **ignoravam o retorno**. O resultado:
 * com a franquia esgotada a IA corria na mesma, a resposta chegava ao
 * utilizador, e nada ficava registado. Consumo acima do plano, invisível no
 * painel e pago pela casa.
 *
 * Duas travas, porque protegem coisas diferentes:
 *
 *  · **Antes** (`temCreditoIA`) — a chamada ao modelo custa dinheiro no
 *    instante em que sai, resposta ou não. Perguntar primeiro é o que evita o
 *    gasto.
 *  · **Depois** (`consume_ai_credit` a devolver `false`) — entre a pergunta e
 *    o débito pode ter entrado outro pedido da mesma empresa. Quem chega a
 *    seguir não leva a resposta.
 *
 * A conta continua a ser feita no banco, com `SECURITY DEFINER` e o consumo
 * atribuído a `auth.uid()`: quem consome é quem chama.
 */

/** Cliente do Supabase, no mínimo que aqui se usa. */
interface ClienteMinimo {
  from(tabela: string): any;
}

/**
 * Há franquia por gastar nesta empresa?
 *
 * Falha ABERTA de propósito: se a leitura da franquia falhar, deixa passar.
 * Recusar por não conseguir ler seria transformar um problema nosso numa
 * porta fechada na cara de quem pagou — e o débito a seguir ainda trava.
 */
export async function temCreditoIA(
  supabase: ClienteMinimo,
  empresaId: string | null | undefined,
): Promise<boolean> {
  if (!empresaId) return true;
  try {
    const { data, error } = await supabase
      .from('empresas')
      .select('creditos_consumidos, planos:plano_id(creditos_franquia)')
      .eq('id', empresaId)
      .maybeSingle();

    if (error || !data) return true;

    const franquia = data.planos?.creditos_franquia;
    if (franquia === null || franquia === undefined) return true;

    return (data.creditos_consumidos ?? 0) < franquia;
  } catch {
    return true;
  }
}

/** A resposta que o produto já usa para franquia esgotada. */
export function semCreditoIA(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Créditos de IA esgotados.', code: 'CREDITS_EXHAUSTED' }),
    { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
