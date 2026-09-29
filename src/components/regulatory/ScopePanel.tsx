import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { regulatoryDb as db, type Assessment } from "@/lib/regulatory/types";
import {
  applicabilityStates,
  applicabilityQuestions,
} from "@/lib/regulatory/applicability";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Choice, Field } from "./shared";
export function ScopePanel({
  assessment: a,
  writable,
  onSaved,
}: {
  assessment: Assessment;
  writable: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { text, label, locale } = useCraText();
  const [value, setValue] = useState({
    applicability: a.applicability,
    decision_rationale: a.decision_rationale,
    status: a.status,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    try {
      const r = await db
        .from("regulatory_assessments")
        .update(value)
        .eq("id", a.id)
        .eq("empresa_id", a.empresa_id)
        .eq("revision", a.revision)
        .select("id")
        .single();
      if (r.error) throw r.error;
      await onSaved();
    } catch {
      setMessage(
        text(
          "regulatory.could_not_save_check_permissions_and_concurrent__ecfeeb",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="max-w-4xl space-y-5">
      <h2 className="text-xl font-semibold">
        {text("regulatory.scope_decision_973c7c")}
      </h2>
      <p className="text-sm">
        {a.roles.map(label).join(" · ")} · {label(a.classification)}
      </p>
      <p className="text-sm text-muted-foreground">
        {text(
          "regulatory.scope_and_the_requirement_set_are_preserved_to_c_da4a58",
        )}
      </p>
      <fieldset disabled={!writable || busy} className="space-y-4">
        <Field
          id="scope-applicability"
          label={text("regulatory.reviewed_applicability_ca059d")}
        >
          <Choice
            id="scope-applicability"
            disabled={!writable || busy}
            value={value.applicability}
            onChange={(v) =>
              setValue((s) => ({
                ...s,
                applicability: v as Assessment["applicability"],
              }))
            }
            options={applicabilityStates.map((v) => ({
              value: v,
              label: label(v),
            }))}
          />
        </Field>
        <Field
          id="scope-rationale"
          label={text("regulatory.review_rationale_ee0871")}
        >
          <Textarea
            id="scope-rationale"
            rows={5}
            maxLength={6000}
            value={value.decision_rationale}
            onChange={(e) =>
              setValue((s) => ({ ...s, decision_rationale: e.target.value }))
            }
          />
        </Field>
        <Field
          id="scope-status"
          label={text("regulatory.assessment_status_588d5d")}
        >
          <Choice
            id="scope-status"
            disabled={!writable || busy}
            value={value.status}
            onChange={(v) =>
              setValue((s) => ({ ...s, status: v as Assessment["status"] }))
            }
            options={["in_progress", "review_ready", "archived"].map((v) => ({
              value: v,
              label: label(v),
            }))}
          />
        </Field>
      </fieldset>
      {writable && (
        <Button
          disabled={busy || value.decision_rationale.trim().length < 20}
          onClick={() => void save()}
        >
          {text("regulatory.save_scope_review_491600")}
        </Button>
      )}
      {message && <p role="alert">{message}</p>}
      <details className="border-t pt-4">
        <summary className="cursor-pointer font-medium">
          {text(
            "regulatory.screening_answers_and_original_recommendation_ccfe6c",
          )}
        </summary>
        <p className="my-4 text-sm">
          {label(a.preliminary.applicability)} ·{" "}
          {label(a.preliminary.classification)} · {a.preliminary.rules_version}
        </p>
        <dl className="divide-y">
          {applicabilityQuestions.map(([key, pt, en]) => (
            <div
              key={key}
              className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_12rem]"
            >
              <dt>{locale === "en" ? en : pt}</dt>
              <dd className="font-medium">{label(a.answers[key])}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
