import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { safeReturnOrigin } from "./return-origin.ts";
Deno.test("OAuth returns only to Akuris origins", () => {
  assertEquals(safeReturnOrigin("https://akuris.pt"), "https://akuris.pt");
  assertEquals(safeReturnOrigin("https://id-preview--e64d00f7-1631-421a-bcc8-86aa27d8fb2a.lovable.app"), "https://id-preview--e64d00f7-1631-421a-bcc8-86aa27d8fb2a.lovable.app");
  assertEquals(safeReturnOrigin("https://evil.com"), null);
  assertEquals(safeReturnOrigin("https://akuris.pt.evil.com"), null);
  assertEquals(safeReturnOrigin("https://x--other-project.lovable.app"), null);
  assertEquals(safeReturnOrigin("https://akuris.pt/configuracoes?x=1"), null);
  assertEquals(safeReturnOrigin(undefined), null);
});
