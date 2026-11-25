import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { persistExplicitLocale } from "@/lib/i18n-locale";

const SUG: unknown[] = [];
const _unused = [{ id: "s1", provider: "microsoft", regra_id: "alerta_malware", estado: "aberta", probabilidade: 4, impacto: 5, relevancia: 2,
  alcance: { escopo: "x" }, risco_id: null, motivo_descarte: null, ultima_deteccao: "2026-11-25T10:00:00Z", corrigida_em: null,
  fonte: "Microsoft Defender XDR", severidade_tecnica: "alta", recorrencias: 0, suprimido_ate: null,
  evidencia: { total: 1, itens: ["Incident 29"], refs: [{ id: "29", nome: "Incident 29", url: "https://security.microsoft.com/incident2/29" }] } }];
const CON = [{ id: "c1", provider: "microsoft", settings: { tenant_id: undefined as string | undefined, risk_coverage: { at: "2026-11-25T10:00:00Z", rules: {
  alerta_malware: { status: "ok" }, recomendacoes_defender: { status: "permission_missing", motivo: "permission_missing" } } } } }];
const chain = (rows: unknown[]) => { const c: Record<string, unknown> = {}; for (const m of ["select", "eq", "in", "order"]) c[m] = () => c;
  (c as { then: unknown }).then = (r: (v: unknown) => void) => r({ data: rows, error: null }); return c; };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => chain(t === "integration_connections" ? CON : SUG), rpc: (...a: unknown[]) => rpc(...a),
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ profile: { empresa_id: "e1" } }) }));
import { RiscosSugeridos } from "@/components/riscos/RiscosSugeridos";

describe("Empty state honesty", () => {
  it("old Microsoft connection without tenant is not coverage; empty list is not 'no risks'", async () => {
    persistExplicitLocale("en");
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><LanguageProvider><RiscosSugeridos /></LanguageProvider></MemoryRouter></QueryClientProvider>);
    expect((await screen.findAllByText("No integration connected")).length).toBeGreaterThan(0);
    expect(screen.queryByText("No findings in the evaluated checks")).toBeNull();
    expect(screen.queryByRole("button", { name: "Check now" })).toBeNull();
  });
});
