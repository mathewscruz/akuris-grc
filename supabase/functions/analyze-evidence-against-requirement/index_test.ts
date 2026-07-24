/**
 * Contrato E2E de analyze-evidence-against-requirement.
 * Regressão importante: o SSRF guard exige que `fileUrl` seja HTTPS no host do
 * projeto Supabase e comece com `/storage/v1/`. Se o guard voltar a aceitar
 * URLs arbitrárias, este teste quebra.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN = `${SUPABASE_URL}/functions/v1/analyze-evidence-against-requirement`;

Deno.test("CORS preflight", async () => {
  const r = await fetch(FN, { method: "OPTIONS", headers: { apikey: ANON } });
  await r.text();
  assertEquals(r.status, 200);
});

Deno.test("Sem Authorization → 401", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({
      requirementId: "00000000-0000-0000-0000-000000000000",
      fileUrl: `${SUPABASE_URL}/storage/v1/object/public/evidencias/x.pdf`,
      empresaId: "00000000-0000-0000-0000-000000000000",
    }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("Body sem requirementId/fileUrl → 400", async () => {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({}),
  });
  const body = await r.json();
  assert(r.status === 400 || r.status === 401, `esperado 400 ou 401, veio ${r.status}`);
  assert(body.error);
});
