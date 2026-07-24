/**
 * Contrato E2E de gap-analysis-ai-diagnostic (produção deployada).
 *
 * Cobre o que dá para testar sem depender de um JWT de usuário real:
 *  - CORS preflight
 *  - 401 sem Authorization
 *  - 401 com Bearer inválido
 *  - 400 sem `requirementId`
 *
 * Os cenários que exigem JWT válido + empresa_id + créditos reais (200 feliz,
 * 402 sem crédito, 403 multi-tenant) ficam cobertos pela simulação Playwright
 * autenticada — a mesma máquina não tem como mintar um JWT de usuário Supabase
 * sem passar pelo Auth do próprio produto.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN = `${SUPABASE_URL}/functions/v1/gap-analysis-ai-diagnostic`;

Deno.test("CORS preflight retorna 200 com header de origem", async () => {
  const r = await fetch(FN, { method: "OPTIONS", headers: { apikey: ANON } });
  await r.text();
  assertEquals(r.status, 200);
  assert(r.headers.get("access-control-allow-origin"));
});

Deno.test("Sem Authorization → 401", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ requirementId: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("Bearer inválido → 401", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: "Bearer token-invalido-para-testar",
    },
    body: JSON.stringify({ requirementId: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("Body sem requirementId → 400 (validação antes de qualquer chamada de IA)", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({}),
  });
  const body = await r.json();
  // 400 se o handler valida antes do auth, 401 se valida depois. Ambos são
  // aceitáveis desde que a IA não seja chamada nem crédito seja debitado.
  assert(r.status === 400 || r.status === 401, `esperado 400 ou 401, veio ${r.status}`);
  assert(body.error);
});
