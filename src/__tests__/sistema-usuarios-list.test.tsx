import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { persistExplicitLocale } from "@/lib/i18n-locale";

const rows = {
  sistemas_privilegiados: [{ id: "s1", nome_sistema: "Google Workspace – akuris.com.br" }],
  sistemas_usuarios: [
    { id: "u1", nome_usuario: "Ana Admin", email_usuario: "ana@akuris.com.br", departamento: null, cargo: null, tipo_acesso: "administrativo",
      nivel_privilegio: "alto", data_concessao: null, data_expiracao: null, ativo: true, sistema_id: "s1",
      sistema: { nome_sistema: "Google Workspace – akuris.com.br" }, origem: "google_workspace", sincronizado_em: null,
      integration_signals: { mfa_registered: true, privileged: true, last_login_at: "2026-11-20T10:00:00Z" } },
    { id: "u2", nome_usuario: "Bruno", email_usuario: null, departamento: null, cargo: null, tipo_acesso: "leitura",
      nivel_privilegio: "baixo", data_concessao: null, data_expiracao: null, ativo: false, sistema_id: "s1",
      sistema: null, origem: "google_workspace", sincronizado_em: null, integration_signals: null },
  ],
} as Record<string, unknown[]>;
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ profile: { role: "admin", empresa_id: "tenant-a" }, user: { id: "u" } }) }));
vi.mock("@/hooks/useEmpresaId", () => ({ useEmpresaId: () => ({ empresaId: "tenant-a" }) }));
vi.mock("@/lib/read-all-pages", () => ({
  readAllPages: async (build: (f: number, t: number) => { __table: string }) => ({ data: rows[build(0, 999).__table] ?? [], error: null }),
}));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): any => new Proxy({ __table: table }, {
    get: (target, k) => (k in target ? (target as any)[k] : k === "then" ? undefined : () => chain(table)),
  });
  return { supabase: {
    from: (t: string) => chain(t),
    functions: { invoke: async () => ({ data: null, error: null }) },
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  } };
});
vi.mock("@/components/revisao-acessos/SincronizarDiretorio", () => ({ SincronizarDiretorio: () => null }));
import { SistemaUsuariosList } from "@/components/revisao-acessos/SistemaUsuariosList";

const mount = () => render(
  <MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <LanguageProvider><SistemaUsuariosList /></LanguageProvider>
  </QueryClientProvider></MemoryRouter>);

describe("SistemaUsuariosList with Google accounts", () => {
  beforeEach(() => { localStorage.clear(); persistExplicitLocale("pt-BR"); });
  it("renders rows (not values) with system, Google origin, signals and null fields", async () => {
    mount();
    await screen.findAllByText("Ana Admin");
    expect(screen.getAllByText("ana@akuris.com.br").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Google Workspace – akuris.com.br").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Google Workspace").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("MFA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Último login/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bruno").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /mais ações|more actions/i }).length).toBeGreaterThanOrEqual(2);
  });
  it("search filters the Google accounts", async () => {
    mount();
    await screen.findAllByText("Ana Admin");
    const box = screen.getAllByRole("textbox")[0];
    fireEvent.change(box, { target: { value: "bruno" } });
    expect(screen.queryAllByText("Ana Admin").length).toBe(0);
    expect(screen.getAllByText("Bruno").length).toBeGreaterThan(0);
  });
});
