import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { comRepeticao, dividirEmLotes, juntarLotes, IaIndisponivelError } from "./lotes.ts";

const semEspera = () => Promise.resolve();

Deno.test("lotes — 121 requisitos em lotes de 25 dão 5 lotes", () => {
  const l = dividirEmLotes(Array.from({ length: 121 }, (_, i) => i), 25);
  assertEquals(l.length, 5);
  assertEquals(l[4].length, 21);
});

Deno.test("retry — 503 repete e depois sucede", async () => {
  let n = 0;
  const r = await comRepeticao(async () => (++n < 3 ? new Response("x", { status: 503 }) : new Response("ok")), 2, semEspera);
  assertEquals(r.status, 200);
  assertEquals(n, 3);
});

Deno.test("retry — 400 não repete", async () => {
  let n = 0;
  const r = await comRepeticao(async () => { n++; return new Response("x", { status: 400 }); }, 2, semEspera);
  assertEquals(r.status, 400);
  assertEquals(n, 1);
});

Deno.test("retry — 503 persistente devolve 503 após 3 tentativas", async () => {
  let n = 0;
  const r = await comRepeticao(async () => { n++; return new Response("x", { status: 503 }); }, 2, semEspera);
  assertEquals(r.status, 503);
  assertEquals(n, 3);
});

Deno.test("retry — erro de rede persistente vira IaIndisponivelError", async () => {
  await assertRejects(() => comRepeticao(() => Promise.reject(new Error("rede")), 1, semEspera), IaIndisponivelError);
});

Deno.test("juntar — soma requisitos e conta lotes falhados", () => {
  const j = juntarLotes([
    { requisitos_analisados: [{ requisito_codigo: "A" }], recomendacoes: ["Rever", "rever"] },
    null,
    { requisitos_analisados: [{ requisito_codigo: "B" }], recomendacoes: ["Outra"] },
  ]);
  assertEquals(j.requisitos_analisados.length, 2);
  assertEquals(j.recomendacoes.length, 2);
  assertEquals(j.lotes_falhados, 1);
});

import { dividirTexto, orcamentoResumo, proximosPendentes } from './lotes.ts';

Deno.test('dividirTexto: documento pequeno fica inteiro', () => {
  const r = dividirTexto('a'.repeat(5000));
  if (r.length !== 1) throw new Error('esperava 1 trecho');
});

Deno.test('dividirTexto: documento enorme cobre todo o texto', () => {
  const texto = Array.from({ length: 20000 }, (_, i) => `linha ${i}`).join('\n'); // ~190k chars
  const r = dividirTexto(texto, 12000, 500);
  if (r.length < 15) throw new Error(`poucos trechos: ${r.length}`);
  if (!r[r.length - 1].includes('linha 19999')) throw new Error('fim do documento perdido');
  if (r.some((t) => t.length > 12000)) throw new Error('trecho acima do tamanho');
});

Deno.test('orcamentoResumo: soma cabe ~60k e tem mínimo', () => {
  if (orcamentoResumo(5) !== 12000) throw new Error('5 trechos');
  if (orcamentoResumo(200) !== 1200) throw new Error('mínimo');
});

Deno.test('proximosPendentes: retoma só o que falta', () => {
  const r = proximosPendentes(['ok', null, 'ok'], 5, 3);
  if (JSON.stringify(r) !== '[1,3,4]') throw new Error(JSON.stringify(r));
});
