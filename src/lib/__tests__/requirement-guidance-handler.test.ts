/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated HTTP boundary doubles. */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: ['supabase/functions/populate-requirement-guidance/index.ts'], bundle: true,
    platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
    plugins: [{ name: 'supabase-test-boundary', setup(builder) {
      builder.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: 'boundary' }));
      builder.onLoad({ filter: /.*/, namespace: 'boundary' }, () => ({ contents: 'export const createClient = () => globalThis.testClient;' }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

const id = '11111111-1111-4111-8111-111111111111';
const questions = JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ pergunta: `A devolução ${i + 1} está registrada?`, peso: 2 })));
const content = {
  orientacao_implementacao: '## Entenda o requisito\nFormalize a devolução de ativos.\n## Faça nesta ordem\n1. Confira o inventário.\n2. Formalize a devolução.\n3. Atualize os registros.\n## Considere concluído quando\n- Houver registro da entrega.',
  exemplos_evidencias: '- Termo de devolução\n- Registro de baixa do ativo',
  perguntas_diagnostico: questions,
};
const providerText = `===ORIENTACAO_START===${content.orientacao_implementacao}===ORIENTACAO_END===
===EVIDENCIAS_START===${content.exemplos_evidencias}===EVIDENCIAS_END===
===DIAGNOSTICO_START===${questions}===DIAGNOSTICO_END===`;

function harness(initial: Record<string, unknown> = {}) {
  let row: any = { id, codigo: 'A.5.11', titulo: 'Devolução de ativos', descricao: 'Devolução dos ativos da organização.', categoria: 'Ativos', ...initial };
  let claimed = false;
  const writes = vi.fn();
  const settings = { failWrite: false };
  const rpc = vi.fn(async (name, args) => {
    if (name === 'has_super_admin_role') return { data: false, error: null };
    if (name !== 'consume_security_rate_limit') throw new Error(`Unexpected RPC (including customer billing): ${name}`);
    if (args.p_scope === 'requirement-guidance:content') {
      const allowed = !claimed; claimed = true; return { data: allowed, error: null };
    }
    return { data: true, error: null };
  });
  const query = (table: string) => {
    let update: any;
    let profileUser = '';
    const chain: any = {};
    chain.select = () => chain;
    chain.eq = (key: string, value: string) => { if (key === 'user_id') profileUser = value; return chain; };
    chain.update = (payload: any) => { update = payload; return chain; };
    chain.single = async () => {
      if (table === 'profiles') return { data: { empresa_id: `tenant-of-${profileUser}`, credits: 0 }, error: null };
      if (table !== 'gap_analysis_requirements') throw new Error(`Unexpected table: ${table}`);
      if (update) {
        if (settings.failWrite) return { data: null, error: new Error('write failed') };
        writes(update); row = { ...row, ...update };
      }
      return { data: { ...row }, error: null };
    };
    return chain;
  };
  const ai = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: providerText } }] })));
  const context: any = {
    testClient: { from: query, rpc, auth: { getUser: async (token: string) => ({ data: { user: { id: token } }, error: null }) } },
    fetch: ai, Request, Response, Headers, AbortSignal, TextEncoder, crypto,
    console: { error: vi.fn() },
    Deno: { env: { get: () => 'synthetic-test-only' }, serve: (handler: unknown) => { context.handler = handler; } },
  };
  runInNewContext(bundle, context);
  const request = (body: Record<string, unknown> = {}, user: string | null = 'user-one') => context.handler(new Request('https://test.example/guidance', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) },
    body: JSON.stringify({ requirement_id: id, locale: 'pt', ...body }),
  })) as Promise<Response>;
  return { request, ai, rpc, writes, settings, row: () => row };
}

describe('real HTTP handler: platform-funded shared guidance', () => {
  it('generates and persists for the first user, then serves the same catalogue content to a user of another company without credits', async () => {
    const h = harness();
    const first = await h.request();
    expect(first.status).toBe(200);
    expect(h.writes).toHaveBeenCalledOnce();
    expect(h.row()).toMatchObject(content);
    const second = await h.request({}, 'user-two');
    expect(await second.json()).toMatchObject({ ...content, cached: true });
    expect(h.ai).toHaveBeenCalledOnce();
    expect(h.rpc.mock.calls.every(([name]) => name === 'consume_security_rate_limit')).toBe(true);
  });
  it('reads complete saved guidance without calling the provider or checking customer balance', async () => {
    const h = harness(content);
    expect((await h.request()).status).toBe(200);
    expect(h.ai).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it('waits for a concurrent generation and reads its saved result on retry', async () => {
    const h = harness();
    let release!: () => void;
    const pause = new Promise<void>(resolve => { release = resolve; });
    h.ai.mockImplementation(async () => { await pause; return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: providerText } }] })); });
    const first = h.request();
    await vi.waitFor(() => expect(h.ai).toHaveBeenCalledOnce());
    const concurrent = await h.request({}, 'user-two');
    expect(concurrent.status).toBe(202); expect(await concurrent.json()).toMatchObject({ pending: true });
    release(); expect((await first).status).toBe(200);
    expect(await (await h.request({}, 'user-two')).json()).toMatchObject({ cached: true });
    expect(h.ai).toHaveBeenCalledOnce(); expect(h.writes).toHaveBeenCalledOnce();
  });
  it('repairs missing guidance without replacing previously answered diagnostic questions', async () => {
    const previous = '[{"pergunta":"O registro anterior está atualizado?","peso":3}]';
    const h = harness({ perguntas_diagnostico: previous });
    expect((await h.request()).status).toBe(200);
    expect(h.row().perguntas_diagnostico).toBe(previous);
    expect(h.row().orientacao_implementacao).toBe(content.orientacao_implementacao);
  });
  it('does not save truncated or incomplete model output', async () => {
    const h = harness();
    h.ai.mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: providerText } }] })));
    expect((await h.request()).status).toBe(502); expect(h.writes).not.toHaveBeenCalled();
  });
  it('does not report successful generation when database persistence fails', async () => {
    const h = harness(); h.settings.failWrite = true;
    expect((await h.request()).status).toBe(503); expect(h.writes).not.toHaveBeenCalled();
  });
  it('requires a session and refuses customer overwrite or bulk generation of shared content', async () => {
    const h = harness();
    expect((await h.request({}, null)).status).toBe(401);
    expect((await h.request({ force: true })).status).toBe(403);
    expect((await h.request({ requirement_id: null })).status).toBe(403);
    expect(h.ai).not.toHaveBeenCalled(); expect(h.writes).not.toHaveBeenCalled();
  });
});
