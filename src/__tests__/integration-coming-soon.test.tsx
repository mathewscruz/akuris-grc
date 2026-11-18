import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { IntegrationCollections } from "@/components/configuracoes/integrations/IntegrationCollections";
import { COLLECTION_PROVIDERS } from "@/lib/integration-platform";
import { persistExplicitLocale } from "@/lib/i18n-locale";

const invoke = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    from,
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

function mount() {
  return render(
    <MemoryRouter initialEntries={["/configuracoes?tab=integracoes&connection=old-id&integration_result=authorized"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <LanguageProvider>
        <IntegrationCollections empresaId="tenant-a" />
      </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  persistExplicitLocale("pt-BR");
  invoke.mockReset();
  invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: "integrations_coming_soon" }) } } });
  from.mockImplementation(() => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (result: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: [], error: null })),
    };
    return query;
  });
});

describe("integration release hold", () => {
  it("scopes the catalog connection reads to the current company", () => {
    mount();
    expect(from).toHaveBeenCalledWith("integration_connections");
    const query = from.mock.results[0].value;
    expect(query.eq).toHaveBeenCalledWith("empresa_id", "tenant-a");
    expect(query.eq).toHaveBeenCalledWith("status", "connected");
    expect(invoke.mock.calls.every(([, o]) => o.body.action === "list")).toBe(true);
  });
  it("shows all eight original brands as coming soon without starting queries or OAuth", () => {
    const { container } = mount();
    expect(screen.getAllByRole("article")).toHaveLength(8);
    expect(screen.getAllByText("Em breve")).toHaveLength(8);
    for (const provider of COLLECTION_PROVIDERS) {
      expect(screen.getByText(provider.name)).toBeVisible();
      const button = screen.getByRole("button", { name: `${provider.name}: Em breve` });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(container.querySelector(`img[src="/integrations/${provider.logo}"]`)).not.toBeNull();
    }
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Adicionar conexão" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(invoke.mock.calls.every(([, o]) => o.body.action === "list")).toBe(true);
  });

  it("keeps catalog search usable without contacting an unavailable backend", () => {
    mount();
    const search = screen.getByRole("textbox", { name: "Buscar ferramenta ou conexão" });
    fireEvent.change(search, { target: { value: "github" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(search, { target: { value: "unlisted-tool" } });
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma ferramenta encontrada.");
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByRole("article")).toHaveLength(8);
    expect(invoke.mock.calls.every(([, o]) => o.body.action === "list")).toBe(true);
  });

  it("translates the unavailable state for English users", () => {
    persistExplicitLocale("en");
    mount();
    expect(screen.getAllByText("Coming soon")).toHaveLength(8);
    expect(screen.getByText(/Connections and collections are not available yet/)).toBeVisible();
    expect(invoke.mock.calls.every(([, o]) => o.body.action === "list")).toBe(true);
  });
});
