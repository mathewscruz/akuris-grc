import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { persistExplicitLocale } from "@/lib/i18n-locale";

const SUG = [{ id: "s1", provider: "microsoft", regra_id: "alerta_malware", estado: "aberta", probabilidade: 4, impacto: 5, relevancia: 2,
  alcance: { escopo: "x" }, risco_id: null, motivo_descarte: null, ultima_deteccao: "2026-11-25T10:00:00Z", corrigida_em: null,
  fonte: "Microsoft Defender XDR", severidade_tecnica: "alta", recorrencias: 0, suprimido_ate: null,
  evidencia: { total: 1, itens: ["Incident 29"], refs: [{ id: "29", nome: "Incident 29", url: "https://security.microsoft.com/incident2/29" }, { id: "device:google:cloud:devices/abc", nome: "LAPTOP-FIN-07 · SN 5CD123", url: null }] } }];
const CON = [{ id: "g1", provider: "google_workspace", settings: { risk_coverage: { at: "2026-11-25T10:00:00Z", rules: { google_alert_center: { status: "not_evaluated", motivo: "nao_coletado" }, google_drive_compartilhamento: { status: "not_evaluated", motivo: "nao_coletado" }, google_politicas: { status: "not_evaluated", motivo: "nao_coletado" } } } } }, { id: "c1", provider: "microsoft", settings: { tenant_id: "t1", risk_coverage: { at: "2026-11-25T10:00:00Z", rules: {
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

describe("Integration risk suggestions", () => {
  it("shows technical severity and coverage, no fixed 5x5 level, no automatic actions", async () => {
    persistExplicitLocale("en");
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><LanguageProvider><RiscosSugeridos /></LanguageProvider></MemoryRouter></QueryClientProvider>);
    expect(await screen.findAllByText("Active malware on devices or accounts")).toBeTruthy();
    expect(screen.queryByText("Suggested level")).toBeNull();
    expect(screen.queryByText("Crítico")).toBeNull();
    expect(screen.getAllByText("Technical severity").length).toBeGreaterThan(0);
    expect(screen.getByText("Missing permission")).toBeTruthy();
    expect(screen.getByText(/Microsoft Defender for Endpoint · SecurityRecommendation.Read.All/)).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("row")[1]);
    const link = await screen.findByRole("link", { name: "Incident 29" });
    expect(link.getAttribute("href")).toBe("https://security.microsoft.com/incident2/29");
    expect(screen.getByText("LAPTOP-FIN-07 · SN 5CD123")).toBeTruthy();
    expect(screen.getByText("Google · device:google:cloud:devices/abc")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("labels the three not-collected Google checks explicitly, never 'Titulo'", async () => {
    persistExplicitLocale("pt");
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><LanguageProvider><RiscosSugeridos /></LanguageProvider></MemoryRouter></QueryClientProvider>);
    for (const l of [/^Alert Center do Google$/, /extern[oa] no Drive$/, /^Políticas de segurança do Google$/]) expect(await screen.findByText(l)).toBeTruthy();
    expect(screen.queryByText(/^T[ií]tulo$/i)).toBeNull();
    expect(screen.getByText(/A ausência de sugestões se refere apenas/)).toBeTruthy();
  });
});
