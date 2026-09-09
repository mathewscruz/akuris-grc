/**
 * Contrato E2E de evidence-cross-match.
 * Regressões que este arquivo trava:
 *  - Não pode aceitar chamada sem JWT (evita cross-tenant e gasto de crédito)
 *  - Autenticação antecede validação do corpo e acesso a dados/IA
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Local by default; an external smoke target must be explicitly selected.
// Never silently load the production target or secrets from a .env file.
const SUPABASE_URL = Deno.env.get("QA_SUPABASE_URL") || "http://127.0.0.1:54321";
const FN = `${SUPABASE_URL}/functions/v1/evidence-cross-match`;

Deno.test("CORS preflight", async () => {
  const r = await fetch(FN, { method: "OPTIONS" });
  await r.text();
  assertEquals(r.status, 200);
});

Deno.test("Sem Authorization → 401", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evidence_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assertEquals(body.error, "Unauthorized: missing bearer token");
});

Deno.test("Body sem evidence_id e sem sessão → 401, não erro interno", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assert(body.error);
});

Deno.test("JWT inválido → 401, não erro interno", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer invalid-qa-token" },
    body: JSON.stringify({}),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assert(body.error);
});
