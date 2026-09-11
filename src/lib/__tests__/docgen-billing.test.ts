/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { deliverDocGenResult } from '../../../supabase/functions/_shared/docgen-billing';

const document = { titulo: 'Documento de teste', secoes: [{ nome: 'Objetivo', conteudo: 'Texto gerado.' }] };
function setup(action = 'generate_document') {
  const controller = new AbortController();
  const rpc = vi.fn().mockResolvedValue({ data: { charged: true, duplicate: false }, error: null });
  const input = { action, payload: { document }, client: { rpc }, empresaId: 'empresa-teste', userId: 'usuario-teste',
    idempotencyKey: 'geracao-unica', signal: controller.signal, headers: {} };
  return { input, rpc, controller };
}

describe('DocGen: crédito somente após entrega', () => {
  it.each(['load_company_context', 'chat', 'quality_gate', 'auto_refine'])('%s não cobra nem quando retorna conteúdo', async action => {
    const { input, rpc } = setup(action);
    expect((await deliverDocGenResult(input)).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['generate_document', 'refine_section', 'refine_document'])('%s cobra uma entrega válida, com identidade autenticada e chave do pedido', async action => {
    const { input, rpc } = setup(action);
    const response = await deliverDocGenResult(input);
    expect((await response.json()).document).toEqual(document);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('consume_ai_credit_idempotente', expect.objectContaining({
      p_empresa_id: input.empresaId, p_user_id: input.userId, p_idempotency_key: input.idempotencyKey,
      p_funcionalidade: 'docgen-chat:' + action,
    }));
  });

  it('não cobra resultado vazio ou que não possa ser serializado', async () => {
    const { input, rpc } = setup();
    await expect(deliverDocGenResult({ ...input, payload: { document: {} } })).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(deliverDocGenResult({ ...input, payload: circular })).rejects.toBeInstanceOf(TypeError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('análise sem resultado não consome crédito', async () => {
    const { input, rpc } = setup('quick_adherence');
    await deliverDocGenResult({ ...input, payload: { adherence: { requisitos_analisados: [] } } });
    expect(rpc).not.toHaveBeenCalled();
    await deliverDocGenResult({ ...input, payload: { adherence: { requisitos_analisados: [{ requisito_codigo: 'A.5.1' }] } } });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('cancelamento antes da entrega não cobra', async () => {
    const { input, rpc, controller } = setup();
    controller.abort();
    await expect(deliverDocGenResult(input)).rejects.toMatchObject({ code: 'GENERATION_ABORTED' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('estorna apenas o débito novo se cancelar durante a confirmação', async () => {
    const { input, rpc, controller } = setup();
    rpc.mockImplementationOnce(async () => {
      controller.abort();
      return { data: { charged: true, duplicate: false }, error: null };
    }).mockResolvedValueOnce({ data: true, error: null });
    await expect(deliverDocGenResult(input)).rejects.toMatchObject({ code: 'GENERATION_ABORTED' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'estornar_ai_credit', { p_empresa_id: input.empresaId, p_idempotency_key: input.idempotencyKey });
  });

  it('um retry cancelado nunca estorna uma geração anterior entregue', async () => {
    const { input, rpc, controller } = setup();
    rpc.mockImplementationOnce(async () => {
      controller.abort();
      return { data: { charged: true, duplicate: true }, error: null };
    });
    await expect(deliverDocGenResult(input)).rejects.toMatchObject({ code: 'GENERATION_ABORTED' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('honra saldo esgotado e erro do débito sem fingir sucesso', async () => {
    const { input, rpc } = setup();
    rpc.mockResolvedValueOnce({ data: { charged: false, reason: 'CREDITS_EXHAUSTED' }, error: null });
    await expect(deliverDocGenResult(input)).rejects.toMatchObject({ code: 'CREDITS_EXHAUSTED', httpStatus: 402 });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Falha simulada' } });
    await expect(deliverDocGenResult(input)).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE', httpStatus: 503 });
  });

  it('repetições preservam a chave e debitam uma única vez no contrato idempotente', async () => {
    const { input, rpc } = setup();
    const ledger = new Set();
    let balance = 0;
    rpc.mockImplementation(async (_name, args) => {
      const duplicate = ledger.has(args.p_idempotency_key);
      if (!duplicate) { ledger.add(args.p_idempotency_key); balance += 1; }
      return { data: { charged: true, duplicate }, error: null };
    });
    await Promise.all([deliverDocGenResult(input), deliverDocGenResult(input)]);
    expect(balance).toBe(1);
  });
});
