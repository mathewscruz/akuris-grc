import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { AssessmentItem, EvidenceLink } from "@/lib/regulatory/types";
import { saveRegulatoryResponse } from "@/hooks/useRegulatory";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Choice, Field, LocalizedText } from "./shared";
import { RegulatoryEvidence } from "./RegulatoryEvidence";
import type { useEvidenceLibrary } from "@/hooks/useEvidenceLibrary";

export type Library = ReturnType<typeof useEvidenceLibrary>;
export type Person = { id: string; user_id: string; nome: string };
export function RequirementDialog({
  item,
  links,
  people,
  library,
  writable,
  onClose,
  onSaved,
}: {
  item: AssessmentItem;
  links: EvidenceLink[];
  people: Person[];
  library: Library;
  writable: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { text, label } = useCraText();
  const [current, setCurrent] = useState(item);
  const [values, setValues] = useState({
    status: item.status,
    notes: item.notes,
    owner_id: item.owner_id,
    due_on: item.due_on,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const dirty = Object.entries(values).some(
    ([key, value]) => value !== current[key as keyof typeof values],
  );
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const snapshot = item.snapshot;
  async function save() {
    setBusy(true);
    setError("");
    try {
      const row = await saveRegulatoryResponse(current, values);
      setCurrent(row);
      await onSaved();
    } catch {
      setError(
        text(
          "regulatory.could_not_save_someone_may_have_updated_this_ite_d957d8",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {snapshot.code} ·{" "}
              <LocalizedText pt={snapshot.title} en={snapshot.title_en} />
            </DialogTitle>
            <DialogDescription>
              <LocalizedText
                pt={snapshot.domain_name}
                en={snapshot.domain_name_en}
              />{" "}
              · {snapshot.legal_reference}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="understand">
            <TabsList className="mb-4">
              <TabsTrigger value="understand">
                {text("regulatory.understand_924f2a")}
              </TabsTrigger>
              <TabsTrigger value="assess">
                {text("regulatory.assess_1d0ca8")}
              </TabsTrigger>
              <TabsTrigger value="evidence">
                {text("regulatory.evidence_25df98")} ({links.length})
              </TabsTrigger>
            </TabsList>
            <div className="max-h-[62dvh] overflow-y-auto px-1">
              <TabsContent value="understand" className="space-y-6">
                <section>
                  <h3 className="mb-2 font-semibold">
                    {text("regulatory.what_this_requirement_asks_471aa9")}
                  </h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    <LocalizedText
                      pt={snapshot.description}
                      en={snapshot.description_en}
                    />
                  </p>
                </section>
                {(
                  [
                    [
                      "Como implementar",
                      "Implementation guidance",
                      snapshot.guidance,
                      snapshot.guidance_en,
                    ],
                    [
                      "Evidências esperadas",
                      "Expected evidence",
                      snapshot.evidence,
                      snapshot.evidence_en,
                    ],
                    [
                      "Orientação para remediar",
                      "Remediation guidance",
                      snapshot.remediation,
                      snapshot.remediation_en,
                    ],
                  ] as const
                ).map(([pt, en, content, english]) => (
                  <section key={en}>
                    <h3 className="mb-2 font-semibold">{text(pt, en)}</h3>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                      <LocalizedText pt={content} en={english} />
                    </p>
                  </section>
                ))}
                <p className="text-sm">
                  {text("regulatory.universal_controls_893303")}:{" "}
                  {(snapshot.controls ?? []).map((c) => c.code).join(", ") ||
                    "—"}
                </p>
                <a
                  href={snapshot.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  {text("regulatory.read_legal_reference_d449b1")}
                </a>
              </TabsContent>
              <TabsContent value="assess" className="space-y-5">
                <h3 className="text-lg font-semibold">
                  <LocalizedText
                    pt={snapshot.question}
                    en={snapshot.question_en}
                  />
                </h3>
                <fieldset disabled={!writable || busy} className="space-y-4">
                  <Field
                    id="cra-answer"
                    label={text("regulatory.reviewer_decision_f908a0")}
                  >
                    <Choice
                      id="cra-answer"
                      disabled={!writable || busy}
                      value={values.status}
                      onChange={(v) =>
                        setValues((s) => ({
                          ...s,
                          status: v as AssessmentItem["status"],
                        }))
                      }
                      options={[
                        "nao_avaliado",
                        "conforme",
                        "parcial",
                        "nao_conforme",
                        "nao_aplicavel",
                      ].map((v) => ({ value: v, label: label(v) }))}
                    />
                  </Field>
                  <Field
                    id="cra-notes"
                    label={text(
                      "regulatory.rationale_observed_implementation_and_gaps_2c912b",
                    )}
                    hint={text(
                      "regulatory.at_least_10_characters_for_a_decision_not_applic_072eec",
                    )}
                  >
                    <Textarea
                      id="cra-notes"
                      rows={6}
                      maxLength={16000}
                      value={values.notes}
                      onChange={(e) =>
                        setValues((s) => ({ ...s, notes: e.target.value }))
                      }
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="cra-owner"
                      label={text("regulatory.owner_865f50")}
                    >
                      <Choice
                        id="cra-owner"
                        disabled={!writable || busy}
                        value={values.owner_id ?? "none"}
                        onChange={(v) =>
                          setValues((s) => ({
                            ...s,
                            owner_id: v === "none" ? null : v,
                          }))
                        }
                        options={[
                          {
                            value: "none",
                            label: text("regulatory.unassigned_9dc70f"),
                          },
                          ...people.map((p) => ({
                            value: p.id,
                            label: p.nome,
                          })),
                        ]}
                      />
                    </Field>
                    <Field
                      id="cra-due"
                      label={text("regulatory.target_date_7985d7")}
                    >
                      <Input
                        id="cra-due"
                        type="date"
                        value={values.due_on ?? ""}
                        onChange={(e) =>
                          setValues((s) => ({
                            ...s,
                            due_on: e.target.value || null,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {text(
                      "regulatory.partial_and_non_compliant_answers_create_a_track_106dbc",
                    )}
                  </p>
                </fieldset>
              </TabsContent>
              <TabsContent value="evidence">
                <RegulatoryEvidence
                  item={item}
                  links={links}
                  people={people}
                  library={library}
                  writable={writable}
                  onSaved={onSaved}
                  onSuggestion={(value) =>
                    setValues((s) => ({
                      ...s,
                      notes: `${s.notes}\n\n${value}`.trim().slice(0, 16000),
                    }))
                  }
                />
              </TabsContent>
            </div>
          </Tabs>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              {text("regulatory.close_d842a8")}
            </Button>
            {writable && (
              <Button
                onClick={() => void save()}
                disabled={
                  busy ||
                  !dirty ||
                  (values.status !== "nao_avaliado" &&
                    values.notes.trim().length < 10)
                }
              >
                {busy
                  ? text("regulatory.saving_126974")
                  : text("regulatory.save_assessment_f249d3")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {text("regulatory.discard_changes_74f3de")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {text(
                "regulatory.your_assessment_has_not_been_saved_evidence_alre_7a2512",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {text("regulatory.keep_editing_34a99c")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>
              {text("regulatory.discard_7f6f5a")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
