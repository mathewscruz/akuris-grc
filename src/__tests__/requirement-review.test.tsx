import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequirementReviewPanel } from "@/components/gap-analysis/RequirementReviewPanel";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  state: {} as any,
  readError: false,
}));
vi.mock(
  "@/contexts/LanguageContext",
  () => ({ useLanguage: () => ({ t: (key: string) => key }) }),
);
vi.mock(
  "@/hooks/useEmpresaId",
  () => ({ useEmpresaId: () => ({ empresaId: "tenant" }) }),
);
vi.mock(
  "@/components/AuthProvider",
  () => ({
    useAuth: () => ({ user: { id: "reviewer" }, profile: { role: "admin" } }),
  }),
);
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => {
      const query: any = {};
      for (const method of ["select", "eq", "not", "order"]) {
        query[method] = () => query;
      }
      query.range = async () => ({
        data: [{ id: "plan", titulo: "Plano compartilhado" }],
        error: null,
      });
      return query;
    },
  },
}));
const clients: QueryClient[] = [];
function mount(
  props: Partial<React.ComponentProps<typeof RequirementReviewPanel>> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <RequirementReviewPanel
        evaluationId="evaluation"
        onPlanLinked={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mocks.state = {
    reviewed_at: null,
    changed: false,
    expired: false,
    events: [],
    pending_request: null,
    exception: null,
  };
  mocks.readError = false;
  mocks.rpc.mockReset().mockImplementation(async (name: string) =>
    name === "compliance_review_state"
      ? {
        data: mocks.readError ? null : mocks.state,
        error: mocks.readError ? new Error("read failed") : null,
      }
      : { data: "event", error: null }
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe("Human review and evidence reuse", () => {
  it("does not record anything until an evaluation has been saved", () => {
    mount({ evaluationId: null });
    expect(screen.getByText("evidenceIntelligence.saveFirst"))
      .toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a justification and records a review without a compliance status", async () => {
    mount();
    await screen.findByText("evidenceIntelligence.none");
    const save = screen.getByRole("button", {
      name: "evidenceIntelligence.confirm",
    });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("evidenceIntelligence.reason"), {
      target: { value: "Verifiquei os registros e a execução do controle." },
    });
    fireEvent.click(save);
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "compliance_record_review",
        expect.objectContaining({
          p_evaluation: "evaluation",
          p_kind: "review",
        }),
      )
    );
    const args =
      mocks.rpc.mock.calls.find((call) =>
        call[0] === "compliance_record_review"
      )![1];
    expect(args).not.toHaveProperty("conformity_status");
  });
  it("blocks review and linking when there are unsaved requirement changes", async () => {
    mount({ hasUnsavedChanges: true });
    await screen.findByText("evidenceIntelligence.none");
    expect(screen.getByText("evidenceIntelligence.saveChanges"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "evidenceIntelligence.confirm" }))
      .toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
  it("does not let the requester approve their own exception", async () => {
    mocks.state.pending_request = {
      id: "request",
      kind: "exception_requested",
      reason: "Exceção com controle compensatório",
      actor_id: "reviewer",
      valid_until: "2027-01-01",
    };
    mount();
    await screen.findByText("Exceção com controle compensatório");
    expect(
      screen.queryByRole("button", { name: "evidenceIntelligence.approve" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("evidenceIntelligence.requestByOther"))
      .toBeInTheDocument();
  });
  it("allows another admin to decide and shows when approved sources have changed", async () => {
    mocks.state.pending_request = {
      id: "request",
      kind: "exception_requested",
      reason: "Pedido para outra pessoa",
      actor_id: "requester",
      valid_until: "2027-01-01",
    };
    mocks.state.exception = {
      reason: "Exceção anterior",
      valid_until: "2027-01-01",
      expired: false,
      changed: true,
    };
    mount();
    await screen.findByText("Pedido para outra pessoa");
    expect(screen.getByRole("button", { name: "evidenceIntelligence.approve" }))
      .toBeDisabled();
    expect(screen.getByText(/evidenceIntelligence.exceptionChanged/))
      .toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("evidenceIntelligence.reason"), {
      target: { value: "Controle compensatório conferido pela revisão." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "evidenceIntelligence.approve" }),
    );
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "compliance_record_review",
        expect.objectContaining({
          p_kind: "exception_approved",
          p_request: "request",
        }),
      )
    );
  });
  it("reports failed reads and keeps decisions unavailable", async () => {
    mocks.readError = true;
    mount();
    await screen.findByText("evidenceIntelligence.readError");
    expect(screen.getByRole("button", { name: "evidenceIntelligence.confirm" }))
      .toBeDisabled();
  });
});
