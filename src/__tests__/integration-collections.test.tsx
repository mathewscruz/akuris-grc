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
async function cardOf(name: string): Promise<HTMLElement> {
  await screen.findAllByRole("article");
  const card = (await screen.findAllByRole("article")).find((a) => a.querySelector("h4")?.textContent === name);
  if (!card) throw new Error(`card ${name} not found`);
  return card;
}

describe("collection connections", () => {
  it("explains missing platform setup instead of pretending the connection is ready", async () => {
    invoke.mockResolvedValue({
      data: { connections: [], availability: {}, scheduler_ready: false },
      error: null,
    });
    mount();
    const github = await screen.findByText("GitHub");
    const card = github.closest("article")!;
    expect(card).toHaveAttribute("data-state", "unavailable");
    expect(card).toHaveTextContent("Em breve");
    fireEvent.click(card);
    expect(
      screen.queryByRole("button", { name: "Autorizar conexão" }),
    ).toBeNull();
    expect(
      invoke.mock.calls.every((call) => call[1].body.action === "list"),
    ).toBe(true);
  });
  it("Conectar opens the authorization window directly, with no intermediate dialog", async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: "" } };
    vi.stubGlobal("open", vi.fn(() => popup));
    invoke.mockImplementation(async (_n: string, o: { body: { action: string } }) =>
      o.body.action === "start"
        ? { data: { connection_id: "c1", authorize_url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" }, error: null }
        : { data: { connections: [], availability: { google_workspace: true }, scheduler_ready: false }, error: null });
    mount();
    await waitFor(async () => expect(await cardOf("Google Workspace")).toHaveAttribute("data-state", "disconnected"));
    fireEvent.click(await cardOf("Google Workspace"));
    await waitFor(() => expect(popup.location.href).toContain("accounts.google.com"));
    expect(invoke.mock.calls.find(([, o]) => o.body.action === "start")![1].body.provider).toBe("google_workspace");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("ignores authorization messages from another origin", async () => {
    invoke.mockResolvedValue({ data: { connections: [], availability: {}, scheduler_ready: false }, error: null });
    mount();
    await screen.findByText("GitHub");
    await new Promise((r) => setTimeout(r, 100));
    const before = invoke.mock.calls.length;
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", data: { type: "akuris-oauth", result: "authorized" } }));
    await new Promise((r) => setTimeout(r, 50));
    expect(invoke.mock.calls.length).toBe(before);
  });
  it("card button reflects each connection state", async () => {
    invoke.mockResolvedValue({
      data: {
        connections: [{ ...connection, status: "error" }],
        availability: { github: true, aws: true },
        scheduler_ready: false,
      },
      error: null,
    });
    mount();
    await waitFor(async () => expect(await cardOf("GitHub")).toHaveAttribute("data-state", "error"));
    const gh = await cardOf("GitHub");
    expect(gh).toHaveTextContent("Falhou");
    expect(gh).toHaveTextContent("Desconectar"); // connected cards only offer Disconnect
    const aws = await cardOf("Amazon Web Services");
    expect(aws).toHaveAttribute("data-state", "disconnected");
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
    await waitFor(async () => expect(await cardOf("GitHub")).toHaveAttribute("data-state", "connected"));
    const gh = await cardOf("GitHub");
    expect(gh).toHaveTextContent("Conectado");
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
    const before = invoke.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(invoke.mock.calls.length).toBeGreaterThan(before));
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
