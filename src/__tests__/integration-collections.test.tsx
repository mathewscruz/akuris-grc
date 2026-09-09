import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { IntegrationCollections } from "@/components/configuracoes/integrations/IntegrationCollections";
import {
  connectionNeedsAttention,
  type CollectionConnection,
} from "@/lib/integration-platform";
import { persistExplicitLocale } from "@/lib/i18n-locale";
const invoke = vi.hoisted(() => vi.fn());
// Exercise the prepared connection flows independently from the release hold.
vi.mock("@/lib/integration-release", () => ({ INTEGRATION_COLLECTIONS_ENABLED: true }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  },
}));
const connection: CollectionConnection = {
  id: "connection-a",
  provider: "github",
  name: "Engineering",
  status: "authorized",
  scope_ids: [],
  frequency: "manual",
  settings: {},
  last_success_at: null,
  next_run_at: null,
  error_code: null,
};
const mount = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
          })
        }
      >
        <LanguageProvider>
          <IntegrationCollections empresaId="tenant-a" />
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  localStorage.clear();
  persistExplicitLocale("pt-BR");
  invoke.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("collection connections", () => {
  it("explains missing platform setup instead of pretending the connection is ready", async () => {
    invoke.mockResolvedValue({
      data: { connections: [], availability: {}, scheduler_ready: false },
      error: null,
    });
    mount();
    await screen.findByText("Nenhuma conexão nesta visão.");
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: "Adicionar conexão" }),
      { button: 0, ctrlKey: false },
    );
    const github = await screen.findByText("GitHub");
    const button = github.closest("article")!.querySelector("button")!;
    fireEvent.click(button);
    expect(
      await screen.findByText("Configuração da plataforma necessária"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Autorizar conexão" }),
    ).toBeNull();
    expect(
      invoke.mock.calls.every((call) => call[1].body.action === "list"),
    ).toBe(true);
  });
  it("authorized does not display as a complete collection", async () => {
    invoke.mockResolvedValue({
      data: {
        connections: [connection],
        availability: { github: true },
        scheduler_ready: false,
      },
      error: null,
    });
    mount();
    expect(await screen.findByText("Autorizada · falta coletar")).toBeTruthy();
    expect(screen.queryByText("Coleta completa")).toBeNull();
  });
  it("failures do not look like an empty successful account", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: { json: async () => ({ error: "authorization_required" }) },
      },
    });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível consultar as conexões",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
  });
  it("marks stale scheduled data but not paused or manual connections", () => {
    const old = {
      ...connection,
      status: "connected" as const,
      frequency: "daily" as const,
      last_success_at: "2026-01-01T00:00:00Z",
    };
    expect(connectionNeedsAttention(old, Date.parse("2026-01-04"))).toBe(true);
    expect(connectionNeedsAttention({ ...old, frequency: "manual" })).toBe(
      false,
    );
    expect(connectionNeedsAttention({ ...old, status: "paused" })).toBe(false);
  });
});
