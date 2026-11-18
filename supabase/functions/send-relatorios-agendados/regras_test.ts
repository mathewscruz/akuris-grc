import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { devidoHoje, proximoEnvio } from "./regras.ts";

const d = (s: string) => new Date(s + "T00:00:00Z");

Deno.test("semanal usa dia da semana (1=segunda)", () => {
  assertEquals(devidoHoje("semanal", 3, d("2026-11-18"), null), true); // quarta
  assertEquals(devidoHoje("semanal", 1, d("2026-11-18"), null), false);
});
Deno.test("não reenvia no mesmo dia", () => {
  assertEquals(devidoHoje("mensal", 18, d("2026-11-18"), "2026-11-18T11:00:00Z"), false);
});
Deno.test("trimestral só em jan/abr/jul/out", () => {
  assertEquals(devidoHoje("trimestral", 5, d("2026-10-05"), null), true);
  assertEquals(devidoHoje("trimestral", 5, d("2026-11-05"), null), false);
});
Deno.test("próximo envio", () => {
  assertEquals(proximoEnvio("semanal", 1, d("2026-11-18")), "2026-11-23");
  assertEquals(proximoEnvio("mensal", 10, d("2026-11-18")), "2026-12-10");
  assertEquals(proximoEnvio("trimestral", 1, d("2026-11-18")), "2027-01-01");
});
