import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { IntegrationCollections } from "@/components/configuracoes/integrations/IntegrationCollections";
import { COLLECTION_PROVIDERS } from "@/lib/integration-platform";
import { INTEGRATION_COLLECTIONS_ENABLED } from "@/lib/integration-release";
import { persistExplicitLocale } from "@/lib/i18n-locale";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

function mount() {
  // No query provider: the unavailable catalog must never mount remote queries.
  return render(
    <MemoryRouter initialEntries={["/configuracoes?tab=integracoes&connection=old-id&integration_result=authorized"]}>
      <LanguageProvider>
        <IntegrationCollections empresaId="tenant-a" />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  persistExplicitLocale("pt-BR");
  invoke.mockReset();
});

describe("integration release hold", () => {
  it("shows all eight original brands as coming soon without starting queries or OAuth", () => {
    expect(INTEGRATION_COLLECTIONS_ENABLED).toBe(false);
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
    expect(invoke).not.toHaveBeenCalled();
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
    expect(invoke).not.toHaveBeenCalled();
  });

  it("translates the unavailable state for English users", () => {
    persistExplicitLocale("en");
    mount();
    expect(screen.getAllByText("Coming soon")).toHaveLength(8);
    expect(screen.getByText(/Connections and collections are not available yet/)).toBeVisible();
    expect(invoke).not.toHaveBeenCalled();
  });
});
