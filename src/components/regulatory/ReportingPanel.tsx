import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  regulatoryDb as db,
  type ReportingWorkflow,
} from "@/lib/regulatory/types";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Field } from "./shared";
export function ReportingPanel({
  workflows,
  writable,
  onSaved,
}: {
  workflows: ReportingWorkflow[];
  writable: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { text } = useCraText();
  return (
    <div className="space-y-6">
      <div className="max-w-4xl space-y-2">
        <h2 className="text-xl font-semibold">CRA Reporting Readiness</h2>
        <p className="text-sm text-muted-foreground">
          {text(
            "regulatory.prepare_people_procedures_and_exercises_for_arti_369b56",
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {text(
            "regulatory.the_deadlines_below_describe_manufacturer_obliga_c62565",
          )}
        </p>
        <a
          href="https://eur-lex.europa.eu/eli/reg/2024/2847/oj"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          {text("regulatory.source_cra_article_14_6d1463")}
        </a>
      </div>
      {workflows.map((w) => (
        <Workflow
          key={`${w.id}:${w.updated_at}`}
          workflow={w}
          writable={writable}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}
function Workflow({
  workflow: w,
  writable,
  onSaved,
}: {
  workflow: ReportingWorkflow;
  writable: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { text, label } = useCraText();
  const [value, setValue] = useState({
    responsible_team: w.responsible_team,
    psirt: w.psirt,
    legal_contact: w.legal_contact,
    management_contact: w.management_contact,
    initial_procedure: w.initial_procedure,
    detailed_procedure: w.detailed_procedure,
    final_procedure: w.final_procedure,
    last_exercise_on: w.last_exercise_on,
    notes: w.notes,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await db
        .from("regulatory_reporting_workflows")
        .update(value)
        .eq("id", w.id)
        .eq("empresa_id", w.empresa_id)
        .eq("updated_at", w.updated_at)
        .select("id")
        .single();
      if (r.error) throw r.error;
      await onSaved();
      setMessage(text("regulatory.procedure_saved_dd3d1b"));
    } catch {
      setMessage(
        text(
          "regulatory.could_not_save_reload_to_check_concurrent_change_6404b8",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h3 className="text-lg font-semibold">{label(w.event_type)}</h3>
      <dl className="grid gap-4 border-y py-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">
            {text("regulatory.early_warning_ab5fd9")}
          </dt>
          <dd className="mt-1 font-medium">
            {text(
              "regulatory.without_undue_delay_within_24h_of_awareness_44ddeb",
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {text("regulatory.detailed_notification_3d5e8a")}
          </dt>
          <dd className="mt-1 font-medium">
            {text(
              "regulatory.without_undue_delay_within_72h_of_awareness_48ccb3",
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {text("regulatory.final_report_29f262")}
          </dt>
          <dd className="mt-1 font-medium">
            {w.event_type === "exploited_vulnerability"
              ? text(
                  "regulatory.within_14_days_after_a_corrective_or_mitigating__bc809f",
                )
              : text(
                  "regulatory.within_1_month_of_the_detailed_notification_if_o_5b7a59",
                )}
          </dd>
        </div>
      </dl>
      <fieldset
        disabled={!writable || busy}
        className="grid gap-4 sm:grid-cols-2"
      >
        {(
          [
            [
              "responsible_team",
              "Equipe de resposta a incidentes",
              "Incident response team",
            ],
            [
              "psirt",
              "PSIRT / segurança do produto",
              "PSIRT / product security",
            ],
            ["legal_contact", "Jurídico", "Legal"],
            ["management_contact", "Gestão", "Management"],
          ] as const
        ).map(([key, pt, en]) => (
          <Field key={key} id={`${w.id}-${key}`} label={text(pt, en)}>
            <Input
              id={`${w.id}-${key}`}
              maxLength={500}
              value={value[key]}
              onChange={(e) =>
                setValue((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </Field>
        ))}
        {(
          [
            [
              "initial_procedure",
              "Procedimento inicial",
              "Early-warning procedure",
            ],
            [
              "detailed_procedure",
              "Procedimento detalhado",
              "Detailed notification procedure",
            ],
            [
              "final_procedure",
              "Relatório final e aprovações",
              "Final report and approvals",
            ],
            [
              "notes",
              "Exceções, exercícios e observações",
              "Exceptions, exercises and notes",
            ],
          ] as const
        ).map(([key, pt, en]) => (
          <div key={key} className="sm:col-span-2">
            <Field id={`${w.id}-${key}`} label={text(pt, en)}>
              <Textarea
                id={`${w.id}-${key}`}
                rows={3}
                maxLength={key === "notes" ? 6000 : 4000}
                value={value[key]}
                onChange={(e) =>
                  setValue((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            </Field>
          </div>
        ))}
        <Field
          id={`${w.id}-exercise`}
          label={text("regulatory.last_exercise_performed_f87e48")}
        >
          <Input
            id={`${w.id}-exercise`}
            type="date"
            value={value.last_exercise_on ?? ""}
            onChange={(e) =>
              setValue((v) => ({
                ...v,
                last_exercise_on: e.target.value || null,
              }))
            }
          />
        </Field>
      </fieldset>
      {writable && (
        <Button variant="outline" disabled={busy} onClick={() => void save()}>
          {text("regulatory.save_procedure_761efc")}
        </Button>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
