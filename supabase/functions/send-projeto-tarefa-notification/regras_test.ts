import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deveAvisarEvento, lembreteDevido } from "./regras.ts";

const base = {
  data_fim: "2026-10-24", prazo: null, concluida_em: null, progresso_pct: 0,
  responsavel_id: "u1", lembrete_3d_enviado_em: null, lembrete_dia_enviado_em: null,
};

Deno.test("lembrete de 3 dias antes", () => assertEquals(lembreteDevido(base, "2026-10-21", true, false), "3d"));
Deno.test("sem lembrete a 4 dias", () => assertEquals(lembreteDevido(base, "2026-10-20", true, false), null));
Deno.test("lembrete no dia", () => assertEquals(lembreteDevido(base, "2026-10-24", true, false), "dia"));
Deno.test("não repete o de 3 dias", () =>
  assertEquals(lembreteDevido({ ...base, lembrete_3d_enviado_em: "x" }, "2026-10-22", true, false), null));
Deno.test("concluída não recebe", () =>
  assertEquals(lembreteDevido({ ...base, progresso_pct: 100 }, "2026-10-24", true, false), null));
Deno.test("fase/domínio não recebe", () => assertEquals(lembreteDevido(base, "2026-10-24", false, false), null));
Deno.test("quem fez a ação não é avisado", () => {
  assertEquals(deveAvisarEvento("u1", "u1"), false);
  assertEquals(deveAvisarEvento("u1", "u2"), true);
  assertEquals(deveAvisarEvento("u1", null), true);
});

import { autoria } from "./regras.ts";
Deno.test("autoria: nome, só e-mail, automação", () => {
  assertEquals(autoria({ nome: "Mathews Cruz", email: "m@x.com" }).nome, "Mathews Cruz");
  assertEquals(autoria({ nome: null, email: "m@x.com" }).nome, "m@x.com");
  assertEquals(autoria(null), { nome: "Uma automação do projeto", automacao: true });
});
