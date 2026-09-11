/**
 * DocGen cobra a entrega, não a abertura nem a preparação do documento.
 * Refinos automáticos fazem parte da geração. Ações manuais pós-geração
 * mantêm a cobrança já anunciada no produto.
 */
const BILLABLE_ACTIONS: Record<string, string> = {
  generate_document: 'Geração de documento',
  refine_section: 'Refino de seção',
  refine_document: 'Refino de documento',
  quick_adherence: 'Análise de aderência',
};

export class DocGenBillingError extends Error {
  constructor(public code: string, public httpStatus: number, message: string) {
    super(message);
    this.name = 'DocGenBillingError';
  }
}

interface BillingClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
interface Delivery {
  action: string;
  payload: Record<string, unknown>;
  client: BillingClient;
  empresaId: string;
  userId: string;
  idempotencyKey: string;
  signal: AbortSignal;
  headers: Record<string, string>;
}

function checkSignal(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DocGenBillingError('GENERATION_ABORTED', 504, 'A geração foi interrompida. Tente novamente.');
  }
}

export async function deliverDocGenResult(input: Delivery): Promise<Response> {
  const { action, payload, client, empresaId, userId, idempotencyKey, signal, headers } = input;
  checkSignal(signal);
  // Serialize BEFORE charging: malformed/circular results cannot consume credit.
  const response = new Response(JSON.stringify(payload), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!Object.prototype.hasOwnProperty.call(BILLABLE_ACTIONS, action)) return response;
  // A failed adherence analysis historically returns a friendly empty result.
  // Preserve that response, but never charge it as a completed analysis.
  if (action === 'quick_adherence') {
    const result = payload.adherence as { requisitos_analisados?: unknown[] } | undefined;
    if (!Array.isArray(result?.requisitos_analisados) || !result.requisitos_analisados.length) return response;
  } else {
    const doc = payload.document as { secoes?: Array<{ conteudo?: unknown }> } | undefined;
    if (!Array.isArray(doc?.secoes) || !doc.secoes.some(section => typeof section?.conteudo === 'string' && section.conteudo.trim())) {
      throw new DocGenBillingError('INVALID_DOCUMENT', 502, 'Não foi possível concluir o documento. Tente novamente.');
    }
  }

  const { data, error } = await client.rpc('consume_ai_credit_idempotente', {
    p_empresa_id: empresaId,
    p_user_id: userId,
    p_funcionalidade: 'docgen-chat:' + action,
    p_idempotency_key: idempotencyKey,
    p_descricao: 'DocGen - ' + BILLABLE_ACTIONS[action],
  });
  const receipt = data as { charged?: boolean; duplicate?: boolean; reason?: string } | null;
  if (error || receipt?.charged !== true) {
    if (!error && receipt?.reason === 'CREDITS_EXHAUSTED') {
      throw new DocGenBillingError('CREDITS_EXHAUSTED', 402, 'Créditos de IA esgotados.');
    }
    throw new DocGenBillingError('BILLING_UNAVAILABLE', 503, 'Não foi possível confirmar o crédito da geração. Tente novamente.');
  }

  if (signal.aborted && receipt.duplicate !== true) {
    // Only reverse THIS invocation's new debit. An aborted duplicate must
    // never refund a document successfully delivered by an earlier attempt.
    const refund = await client.rpc('estornar_ai_credit', {
      p_empresa_id: empresaId, p_idempotency_key: idempotencyKey,
    });
    if (refund.error || refund.data !== true) {
      console.error('DocGen: estorno de geração interrompida não confirmado', { empresaId, idempotencyKey });
    }
  }
  checkSignal(signal);
  return response;
}
