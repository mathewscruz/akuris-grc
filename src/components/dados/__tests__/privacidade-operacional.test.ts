import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prazoResposta } from "@/lib/jurisdicao";

describe("prazos regulatórios da privacidade", () => {
  it("usa um mês civil no RGPD, inclusive no fim do mês", () => {
    const prazo = prazoResposta(new Date(2026, 0, 31, 12), "PT_EU");
    expect(prazo.getFullYear()).toBe(2026);
    expect(prazo.getMonth()).toBe(1);
    expect(prazo.getDate()).toBe(28);
  });

  it("mantém o prazo LGPD de quinze dias", () => {
    const prazo = prazoResposta(new Date(2026, 8, 4, 12), "BR");
    expect(prazo.getFullYear()).toBe(2026);
    expect(prazo.getMonth()).toBe(8);
    expect(prazo.getDate()).toBe(19);
  });

  it("dobra o prazo LGPD quando o enquadramento de pequeno porte foi confirmado", () => {
    const prazo = prazoResposta(new Date(2026, 8, 4, 12), "BR", true);
    expect(prazo.getFullYear()).toBe(2026);
    expect(prazo.getMonth()).toBe(9);
    expect(prazo.getDate()).toBe(4);
  });
});

describe("migration do programa de privacidade", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260904140000_privacidade_operacional.sql",
    ),
    "utf8",
  );

  it("protege escritas por tenant e permissão de ação", () => {
    expect(sql).toContain("AS RESTRICTIVE");
    expect(sql).toContain("usuario_tem_permissao_modulo(''dados'', %L)");
    expect(sql).toContain("get_user_empresa_id()");
  });

  it("mantém a criação pública limitada e sem acesso direto às tabelas", () => {
    expect(sql).toContain("criar_solicitacao_privacidade_publica");
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toContain(">= 3");
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.criar_solicitacao_privacidade_publica[\s\S]*TO anon/,
    );
  });

  it("automatiza os prazos de incidente por jurisdição", () => {
    expect(sql).toContain("interval '72 hours'");
    expect(sql).toContain("somar_dias_uteis(NEW.conhecimento_em, 3)");
    expect(sql).toContain("somar_dias_uteis(NEW.conhecimento_em, 6)");
    expect(sql).toContain("interval '5 years'");
  });

  it("consolida o carregamento do centro de privacidade em uma única leitura", () => {
    expect(sql).toContain("obter_centro_privacidade");
    expect(sql).toContain("SECURITY INVOKER");
    expect(sql).toContain("usuario_tem_permissao_modulo('dados','read')");
  });

  it("agenda alertas operacionais sem expor a função aos usuários", () => {
    expect(sql).toContain("processar_alertas_privacidade");
    expect(sql).toContain("daily-privacy-deadline-alerts");
    expect(sql).toContain("'0 11 * * *'");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.processar_alertas_privacidade() FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.processar_alertas_privacidade() TO service_role",
    );
  });
});
