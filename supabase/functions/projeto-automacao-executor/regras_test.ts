import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizarTipo, passaCondicoes, montarMensagem, acaoCompleta } from "./regras.ts";

Deno.test("mudar_prioridade é aplicado como definir_prioridade", () => {
  assertEquals(normalizarTipo("mudar_prioridade"), "definir_prioridade");
});
Deno.test("condições por prioridade e responsável", () => {
  const t = { prioridade: "alta", responsavel_id: "u1", coluna_id: "c1" };
  assertEquals(passaCondicoes({ prioridade: "alta", responsavel_id: "u1" }, t), true);
  assertEquals(passaCondicoes({ prioridade: "baixa" }, t), false);
  assertEquals(passaCondicoes({ coluna_id: "" }, t), true);
});
Deno.test("mensagem com título", () => {
  assertEquals(montarMensagem("Veja {titulo}", "A1"), "Veja A1");
});
Deno.test("ações incompletas não contam", () => {
  assertEquals(acaoCompleta({ tipo: "notificar_usuario" }), false);
  assertEquals(acaoCompleta({ tipo: "mudar_prioridade", prioridade: "alta" }), true);
});
