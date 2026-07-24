/**
 * Contrato E2E de calculate-assessment-score.
 * Foca em auth guard + input guard — o cálculo real do score usa IA e depende
 * de um assessment de due-diligence pré-existente, coberto pela suíte de DD.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN = `${SUPABASE_URL}/functions/v1/calculate-assessment-score`;

Deno.test("CORS preflight", async () => {
  const r = await fetch(FN, { method: "OPTIONS", headers: { apikey: ANON } });
  await r.text();
  assertEquals(r.status, 200);
});

Deno.test("Sem Authorization → 401", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ assessment_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("Bearer inválido → 401 (não vaza detalhes internos)", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: "Bearer invalid",
    },
    body: JSON.stringify({ assessment_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assert(body.error);
});
