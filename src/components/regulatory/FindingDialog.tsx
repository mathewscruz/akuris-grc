import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  regulatoryDb as db,
  findingStates,
  type Finding,
} from "@/lib/regulatory/types";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Choice, Field } from "./shared";
import type { Person } from "./RequirementDialog";
export function FindingDialog({
  finding,
  people,
  writable,
  canCreateAction,
  onClose,
  onSaved,
}: {
  finding: Finding;
  people: Person[];
  writable: boolean;
  canCreateAction: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { text, label } = useCraText();
  const [current, setCurrent] = useState(finding);
  const [value, setValue] = useState({
    title: finding.title,
    description: finding.description,
    impact: finding.impact,
    recommendation: finding.recommendation,
    missing_evidence: finding.missing_evidence,
    risk: finding.risk,
    owner_id: finding.owner_id,
    due_on: finding.due_on,
    status: finding.status,
    decision_note: finding.decision_note,
    department: finding.department,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(createAction = false) {
    setBusy(true);
    setError("");
    try {
      const saved = await db
        .from("regulatory_findings")
        .update(value)
        .eq("id", current.id)
        .eq("empresa_id", current.empresa_id)
        .eq("revision", current.revision)
        .select("*")
        .single();
      if (saved.error || !saved.data) throw new Error("save");
      setCurrent(saved.data);
      if (createAction) {
        const result = await db.rpc("regulatory_create_action", {
          p_finding: current.id,
          p_title: value.title.slice(0, 200),
          p_description: [value.description, value.impact, value.recommendation]
            .filter(Boolean)
            .join("\n\n"),
          p_owner: people.find((p) => p.id === value.owner_id)?.user_id ?? null,
          p_due: value.due_on,
        });
        if (result.error) throw result.error;
        setCurrent((v) => ({ ...v, action_plan_id: result.data }));
      }
      await onSaved();
      onClose();
    } catch {
      setError(
        text(
          "regulatory.could_not_complete_check_action_plan_permissions_abd8f1",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const valid =
    value.title.trim().length >= 3 &&
    (!["completed", "risk_accepted"].includes(value.status) ||
      value.decision_note.trim().length >= 20);
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {text("regulatory.finding_and_remediation_cacab1")}
          </DialogTitle>
          <DialogDescription>
            {text(
              "regulatory.completing_an_action_or_accepting_risk_does_not__a85bee",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65dvh] overflow-y-auto px-1">
          <fieldset disabled={!writable || busy} className="space-y-4">
            <Field id="finding-title" label={text("regulatory.title_d3689c")}>
              <Input
                id="finding-title"
                maxLength={300}
                value={value.title}
                onChange={(e) =>
                  setValue((v) => ({ ...v, title: e.target.value }))
                }
              />
            </Field>
            {(
              [
                ["description", "Descrição", "Description"],
                [
                  "impact",
                  "Impacto no produto/negócio",
                  "Product/business impact",
                ],
                ["recommendation", "Recomendação", "Recommendation"],
                [
                  "missing_evidence",
                  "Evidências faltantes",
                  "Missing evidence",
                ],
              ] as const
            ).map(([key, pt, en]) => (
              <Field key={key} id={`finding-${key}`} label={text(pt, en)}>
                <Textarea
                  id={`finding-${key}`}
                  maxLength={key === "description" ? 16000 : 8000}
                  value={value[key]}
                  onChange={(e) =>
                    setValue((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </Field>
            ))}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="finding-risk" label={text("regulatory.risk_9994f1")}>
                <Choice
                  id="finding-risk"
                  disabled={!writable || busy}
                  value={value.risk}
                  onChange={(r) =>
                    setValue((v) => ({ ...v, risk: r as Finding["risk"] }))
                  }
                  options={["critical", "high", "medium", "low"].map((v) => ({
                    value: v,
                    label: label(v),
                  }))}
                />
              </Field>
              <Field
                id="finding-status"
                label={text("regulatory.remediation_stage_2ccd54")}
              >
                <Choice
                  id="finding-status"
                  disabled={!writable || busy}
                  value={value.status}
                  onChange={(s) =>
                    setValue((v) => ({ ...v, status: s as Finding["status"] }))
                  }
                  options={findingStates
                    .filter(
                      (s) => s !== "resolved" || current.status === "resolved",
                    )
                    .map((v) => ({ value: v, label: label(v) }))}
                />
              </Field>
              <Field id="finding-owner" label={text("regulatory.owner_865f50")}>
                <Choice
                  id="finding-owner"
                  disabled={!writable || busy}
                  value={value.owner_id ?? "none"}
                  onChange={(s) =>
                    setValue((v) => ({
                      ...v,
                      owner_id: s === "none" ? null : s,
                    }))
                  }
                  options={[
                    { value: "none", label: "—" },
                    ...people.map((p) => ({ value: p.id, label: p.nome })),
                  ]}
                />
              </Field>
              <Field
                id="finding-date"
                label={text("regulatory.target_date_7985d7")}
              >
                <Input
                  id="finding-date"
                  type="date"
                  value={value.due_on ?? ""}
                  onChange={(e) =>
                    setValue((v) => ({ ...v, due_on: e.target.value || null }))
                  }
                />
              </Field>
            </div>
            <Field
              id="finding-department"
              label={text("regulatory.department_c33387")}
            >
              <Input
                id="finding-department"
                maxLength={300}
                value={value.department}
                onChange={(e) =>
                  setValue((v) => ({ ...v, department: e.target.value }))
                }
              />
            </Field>
            <Field
              id="finding-decision"
              label={text("regulatory.comments_and_decision_rationale_de3138")}
              hint={text(
                "regulatory.completion_or_risk_acceptance_requires_at_least__04095a",
              )}
            >
              <Textarea
                id="finding-decision"
                maxLength={6000}
                value={value.decision_note}
                onChange={(e) =>
                  setValue((v) => ({ ...v, decision_note: e.target.value }))
                }
              />
            </Field>
          </fieldset>
        </div>
        {current.action_plan_id && (
          <Link
            to={`/planos-acao?plano=${current.action_plan_id}`}
            className="text-sm text-primary underline"
          >
            {text("regulatory.open_linked_action_plan_e22bca")}
          </Link>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {text("regulatory.close_d842a8")}
          </Button>
          {writable && (
            <>
              <Button
                variant="outline"
                disabled={
                  busy || !valid || !canCreateAction || !!current.action_plan_id
                }
                onClick={() => void save(true)}
              >
                {text("regulatory.save_and_create_action_e2a489")}
              </Button>
              <Button disabled={busy || !valid} onClick={() => void save()}>
                {text("regulatory.save_finding_a9d983")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
