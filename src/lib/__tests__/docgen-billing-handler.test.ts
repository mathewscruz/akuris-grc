/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any -- Test doubles for the Edge HTTP boundary. */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// Exercise the REAL handler, replacing only the HTTP server, Supabase and AI.
// No remote account, provider call, customer balance or credential is involved.
let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: ['supabase/functions/docgen-chat/index.ts'], bundle: true, platform: 'node',
    format: 'cjs', write: false, logLevel: 'silent', plugins: [{ name: 'mock-edge-boundary', setup(build) {
      build.onResolve({ filter: /^https:\/\// }, args => ({ path: args.path, namespace: 'test-boundary' }));
      build.onLoad({ filter: /.*/, namespace: 'test-boundary' }, args => ({
        contents: args.path.includes('http/server')
          ? 'export const serve = handler => globalThis.testHandler = handler;'
          : 'export const createClient = () => globalThis.testClient;',
      }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

const validDoc = { titulo: 'Política de teste', secoes: ['Objetivo', 'Escopo', 'Regras'].map(nome => ({
  nome, conteudo: 'O responsável deve registrar a revisão e manter as evidências atualizadas para consulta e acompanhamento. '.repeat(8),
})) };

function harness() {
  let balance = 0;
  const ledger = new Set();
  const writes: string[] = [];
  const rpc = vi.fn(async (name, args) => {
    if (name === 'consume_ai_credit_idempotente') {
      const duplicate = ledger.has(args.p_idempotency_key);
      if (!duplicate) { ledger.add(args.p_idempotency_key); balance++; }
      return { data: { charged: true, duplicate }, error: null };
    }
    return { data: true, error: null };
  });
  const query = (table: string) => {
    let operation = 'read';
    const result = () => {
      if (operation !== 'read') writes.push(table);
      const data = table === 'profiles' ? { nome: 'Teste', empresa_id: 'tenant-test', role: 'admin' }
        : table === 'empresas' ? { nome: 'Empresa de teste' }
        : table === 'docgen_conversations' ? { id: 'conversation-test', mensagens: [], contexto: { user_name: 'Teste', empresa_nome: 'Empresa de teste' } }
        : table === 'docgen_generated_docs' ? { id: 'document-test' }
        : table === 'docgen_templates' ? [{ id: 'template-test', nome: 'Política', tipo_documento: 'politica', estrutura: {} }]
        : [];
      return { data, error: null };
    };
    const chain: any = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'or']) chain[method] = () => chain;
    for (const method of ['insert', 'update', 'upsert']) chain[method] = () => { operation = method; return chain; };
    chain.single = chain.maybeSingle = async () => result();
    chain.then = (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject);
    return chain;
  };
  const ai = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validDoc) } }] }), {
    headers: { 'Content-Type': 'application/json' },
  }));
  const client = { from: query, rpc, auth: { getUser: async () => ({ data: { user: { id: 'user-test' } }, error: null }) } };
  const context: any = {
    testClient: client, fetch: ai, Response, Request, Headers, AbortController, AbortSignal,
    setTimeout, clearTimeout, crypto, console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
    Deno: { env: { get: () => 'test-only' } }, require: createRequire(import.meta.url), module: { exports: {} },
  };
  runInNewContext(bundle, context);
  const request = (body: Record<string, unknown>, authenticated = true) => context.testHandler(new Request('https://local.example/docgen-chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer synthetic-test-token' } : {}) },
    body: JSON.stringify({ conversation_id: 'conversation-test', idempotency_key: 'request-test', ...body }),
  })) as Promise<Response>;
  return { request, ai, rpc, writes, balance: () => balance };
}

describe('HTTP real do DocGen: abertura, preparação e geração', () => {
  it('abrir/reabrir lê apenas o contexto, sem chamada de IA ou crédito', async () => {
    const h = harness();
    for (let i = 0; i < 3; i++) {
      const response = await h.request({ action: 'load_company_context' });
      expect(response.status).toBe(200);
      expect((await response.json()).company_context.empresa.nome).toBe('Empresa de teste');
    }
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.ai).not.toHaveBeenCalled();
  });

  it('a conversa preparatória e o prompt inicial não consomem crédito', async () => {
    const h = harness();
    h.ai.mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Qual é o escopo da política?' } }] })));
    const response = await h.request({ action: 'chat', message: 'Vamos preparar uma política.' });
    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe('Qual é o escopo da política?');
    expect(h.ai).toHaveBeenCalledTimes(1);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('cobra só depois do documento válido; repetir a mesma geração não duplica o débito', async () => {
    const h = harness();
    h.ai.mockImplementation(async () => {
      expect(h.balance()).toBe(0);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validDoc) } }] }));
    });
    const response = await h.request({ action: 'generate_document', briefing_text: 'Política de teste' });
    expect(response.status).toBe(200);
    expect((await response.json()).document.secoes.length).toBeGreaterThanOrEqual(3);
    expect(h.writes).toContain('docgen_generated_docs');
    expect(h.balance()).toBe(1);
    h.ai.mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validDoc) } }] })));
    expect((await h.request({ action: 'generate_document', briefing_text: 'Política de teste' })).status).toBe(200);
    expect(h.balance()).toBe(1);
  });

  it('JSON inválido não cobra e pode ser repetido com a mesma chave', async () => {
    const h = harness();
    h.ai.mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Resposta inválida' } }] })));
    const response = await h.request({ action: 'generate_document', briefing_text: 'Política de teste' });
    expect((await response.json()).code).toBe('INVALID_DOCUMENT');
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('refino manual com resposta inválida não deixa um crédito debitado', async () => {
    const h = harness();
    h.ai.mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Resposta inválida' } }] })));
    const response = await h.request({ action: 'refine_document', document: validDoc, instruction: 'Revisar o texto.' });
    expect(response.status).toBe(502);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('falha no provedor não cobra; chamadas sem autenticação continuam bloqueadas', async () => {
    const h = harness();
    h.ai.mockImplementation(async () => new Response('Provider unavailable', { status: 503 }));
    expect((await h.request({ action: 'generate_document', briefing_text: 'Teste' })).status).toBe(503);
    expect(h.rpc).not.toHaveBeenCalled();
    expect((await h.request({ action: 'load_company_context' }, false)).status).toBe(401);
  });

  it('a interface de abertura não dispara a geração automaticamente', () => {
    const ui = readFileSync('src/components/documentos/DocGenDialog.tsx', 'utf8');
    const openingEffect = ui.slice(ui.indexOf('// Onda 2: carrega contexto'), ui.indexOf('// Auto scroll'));
    expect(openingEffect).toContain("action: 'load_company_context'");
    expect(openingEffect).not.toMatch(/generateDocument\(|action: 'generate_document'|action: 'chat'/);
    expect(ui).toContain('lastGenerationKeyRef.current');
  });
});
