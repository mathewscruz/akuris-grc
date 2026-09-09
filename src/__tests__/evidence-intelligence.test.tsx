import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EvidenceAnalysisResult } from "@/components/gap-analysis/EvidenceAnalysisResult";
import { contextAction, safeContextPath } from "@/lib/compliance-context";
vi.mock(
  "@/contexts/LanguageContext",
  () => ({ useLanguage: () => ({ t: (key: string) => key }) }),
);
describe("Source-grounded evidence experience", () => {
  it("shows sources, limitations and next steps without invented percentages", () => {
    const onUsePlan = vi.fn();
    const onOpen = vi.fn();
    render(
      <EvidenceAnalysisResult
        result={{
          verdict: "indeterminado",
          score: null,
          justification: "Leitura parcial",
          citations: [{
            source_id: "S1",
            label: "Página 2",
            quote: "Revisão trimestral",
            method: "text",
          }],
          warnings: ["Conferir original"],
          next_steps: ["Anexar registros"],
          completion_criteria: ["Responsável confirma execução"],
        }}
        onOpen={onOpen}
        onUsePlan={onUsePlan}
      />,
    );
    expect(screen.getByText("Página 2")).toBeInTheDocument();
    expect(screen.getByText("Conferir original")).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "evidenceIntelligence.usePlan" }),
    );
    expect(onUsePlan).toHaveBeenCalledWith(
      expect.stringContaining("Responsável confirma execução"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "evidenceIntelligence.original" }),
    );
    expect(onOpen).toHaveBeenCalledOnce();
  });
  it("uses known module paths and explicit UUIDs only", () => {
    expect(safeContextPath("https://evil.example")).toBeNull();
    expect(safeContextPath("//evil.example")).toBeNull();
    expect(safeContextPath("/riscos?view=table")).toBe("/riscos?view=table");
    expect(
      contextAction({
        key: "contract:11111111-1111-4111-8111-111111111111",
        rule: "contract_assessment",
        title: "Contrato",
        priority: "high",
        facts: {},
        sources: [],
      }),
    ).toEqual({
      modulo: "contratos",
      registroId: "11111111-1111-4111-8111-111111111111",
      registroTitulo: "Contrato",
      prioridade: "alta",
    });
  });
});
