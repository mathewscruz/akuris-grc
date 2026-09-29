import { useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  applicabilityQuestions,
  initialApplicabilityAnswers,
  evaluateApplicability,
  applicabilityStates,
  classificationStates,
  roles,
  type ApplicabilityAnswers,
  type TriState,
} from "@/lib/regulatory/applicability";
import {
  regulatoryDb as db,
  type Product,
  type ProductVersion,
  type Assessment,
} from "@/lib/regulatory/types";
import { readinessDisclaimer } from "@/lib/regulatory/presentation";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Field, Choice } from "./shared";

export function AssessmentWizard({
  empresaId,
  products,
  versions,
  frameworkVersionId,
  onClose,
  onCreated,
}: {
  empresaId: string;
  products: Product[];
  versions: ProductVersion[];
  frameworkVersionId: string;
  onClose: () => void;
  onCreated: (id: string) => Promise<unknown>;
}) {
  const { text, label, locale } = useCraText();
  const creationId = useRef(crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ApplicabilityAnswers>(
    initialApplicabilityAnswers,
  );
  const [productId, setProductId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [name, setName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [applicability, setApplicability] = useState<
    Assessment["applicability"]
  >("legal_review_required");
  const [classification, setClassification] =
    useState<Assessment["classification"]>("review_required");
  const [rationale, setRationale] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const preliminary = evaluateApplicability(answers);
  const steps = [
    text("regulatory.applicability_36579b"),
    text("regulatory.product_and_version_29efde"),
    text("regulatory.classification_95a9bb"),
    text("regulatory.scope_review_44b8b2"),
  ];
  const queryList = (indices: readonly number[]) =>
    indices.map((index) => {
      const [q, pt, en] = applicabilityQuestions[index];
      return (
        <Field key={q} id={`cra-${q}`} label={locale === "en" ? en : pt}>
          <Choice
            id={`cra-${q}`}
            disabled={saving}
            value={answers[q]}
            options={["unknown", "yes", "no"].map((v) => ({
              value: v,
              label: label(v),
            }))}
            onChange={(value) => {
              setAnswers((a) => ({ ...a, [q]: value as TriState }));
              setReviewed(false);
            }}
          />
        </Field>
      );
    });
  async function create() {
    if (
      !reviewed ||
      !selectedRoles.length ||
      rationale.trim().length < 20 ||
      !versionId ||
      name.trim().length < 3
    )
      return;
    setSaving(true);
    setError("");
    try {
      const { data: existing } = await db
        .from("regulatory_assessments")
        .select("id")
        .eq("id", creationId.current)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (existing) {
        await onCreated(existing.id);
        return;
      }
      const { data, error: err } = await db
        .from("regulatory_assessments")
        .insert({
          id: creationId.current,
          empresa_id: empresaId,
          product_id: productId,
          product_version_id: versionId,
          framework_version_id: frameworkVersionId,
          name: name.trim(),
          answers,
          roles: selectedRoles,
          applicability,
          classification,
          decision_rationale: rationale.trim(),
        })
        .select("id")
        .single();
      if (err || !data) throw err;
      await onCreated(data.id);
    } catch {
      setError(
        text(
          "regulatory.could_not_create_the_assessment_check_permission_06eaec",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  const nextDisabled =
    (step === 1 && (!versionId || name.trim().length < 3)) ||
    (step === 2 &&
      (!selectedRoles.length ||
        (preliminary.manufacturer_review &&
          !selectedRoles.includes("manufacturer"))));
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {text("regulatory.start_cra_readiness_assessment_6c0e2b")}
          </DialogTitle>
          <DialogDescription>
            {text(
              "regulatory.define_scope_before_assessing_requirements_compl_eb52ee",
            )}
          </DialogDescription>
        </DialogHeader>
        <ol className="grid grid-cols-2 gap-2 border-b pb-4 sm:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={`text-sm ${i === step ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              <span className="mr-2 tabular-nums">0{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="max-h-[60dvh] space-y-5 overflow-y-auto px-1">
          {step === 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {text(
                  "regulatory.answer_for_the_actual_product_when_uncertain_cho_713c76",
                )}
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {queryList([0, 1, 2, 3, 4, 5, 6, 7, 8, 19, 20, 21])}
              </div>
            </>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <Field
                id="assessment-name"
                label={text("regulatory.assessment_name_eae6a3")}
              >
                <Input
                  id="assessment-name"
                  maxLength={200}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setReviewed(false);
                  }}
                />
              </Field>
              <Field
                id="assessment-product"
                label={text("regulatory.product_61f803")}
              >
                <Choice
                  id="assessment-product"
                  value={productId || "choose"}
                  onChange={(v) => {
                    setProductId(v);
                    setVersionId("");
                    setReviewed(false);
                  }}
                  options={[
                    {
                      value: "choose",
                      label: text("regulatory.select_a_product_826671"),
                    },
                    ...products
                      .filter((p) => p.status === "active")
                      .map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </Field>
              <Field
                id="assessment-version"
                label={text("regulatory.product_version_9ec6c8")}
              >
                <Choice
                  id="assessment-version"
                  value={versionId || "choose"}
                  onChange={(v) => {
                    setVersionId(v === "choose" ? "" : v);
                    setReviewed(false);
                  }}
                  options={[
                    {
                      value: "choose",
                      label: text("regulatory.select_a_version_4f6854"),
                    },
                    ...versions
                      .filter(
                        (v) =>
                          v.product_id === productId &&
                          v.lifecycle_status !== "archived",
                      )
                      .map((v) => ({ value: v.id, label: v.version })),
                  ]}
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                {text(
                  "regulatory.add_products_and_versions_on_the_previous_page_d_b22f3f",
                )}
              </p>
            </div>
          )}
          {step === 2 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                {queryList([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 22, 23])}
              </div>
              <fieldset className="space-y-3 border-t pt-4">
                <legend className="font-medium">
                  {text(
                    "regulatory.confirmed_roles_for_this_assessment_24cbb1",
                  )}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {roles.map((role) => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={(checked) => {
                          setReviewed(false);
                          setSelectedRoles((old) =>
                            checked
                              ? [...old, role]
                              : old.filter((r) => r !== role),
                          );
                        }}
                      />
                      <Label htmlFor={`role-${role}`}>{label(role)}</Label>
                    </div>
                  ))}
                </div>
                {preliminary.manufacturer_review && (
                  <p className="text-sm text-warning">
                    {text(
                      "regulatory.own_branding_or_substantial_modification_require_a949dd",
                    )}
                  </p>
                )}
              </fieldset>
              <Field
                id="core-category"
                label={text(
                  "regulatory.core_function_category_under_annexes_iii_iv_0964da",
                )}
                hint={text(
                  "regulatory.an_incidental_login_or_iam_feature_does_not_make_046d2b",
                )}
              >
                <Choice
                  id="core-category"
                  value={answers.primary_category}
                  onChange={(v) => {
                    setReviewed(false);
                    setAnswers((a) => ({
                      ...a,
                      primary_category:
                        v as ApplicabilityAnswers["primary_category"],
                    }));
                  }}
                  options={[
                    ["unknown", text("regulatory.not_confirmed_6d874b")],
                    ["other", label("default")],
                    ["annex_iii_i", label("important_class_i")],
                    ["annex_iii_ii", label("important_class_ii")],
                    ["annex_iv", label("critical")],
                  ].map(([value, label]) => ({ value, label }))}
                />
              </Field>
              <a
                className="text-sm text-primary underline"
                href="https://eur-lex.europa.eu/eli/reg_impl/2025/2392/oj"
                target="_blank"
                rel="noopener noreferrer"
              >
                {text("regulatory.read_official_technical_descriptions_b22120")}
              </a>
            </>
          )}
          {step === 3 && (
            <>
              <section className="space-y-2 border-l-2 border-primary pl-4">
                <h3 className="font-semibold">
                  {text("regulatory.preliminary_recommendation_75d010")}
                </h3>
                <p>
                  {label(preliminary.applicability)} ·{" "}
                  {label(preliminary.classification)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {text(
                    "regulatory.screening_considers_digital_elements_connectivit_a1ab25",
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setApplicability(preliminary.applicability);
                    setClassification(preliminary.classification);
                    setReviewed(false);
                  }}
                >
                  {text("regulatory.use_recommendation_as_decision_26621f")}
                </Button>
              </section>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="final-applicability"
                  label={text("regulatory.reviewed_applicability_ca059d")}
                >
                  <Choice
                    id="final-applicability"
                    value={applicability}
                    onChange={(v) => {
                      setApplicability(v as Assessment["applicability"]);
                      setReviewed(false);
                    }}
                    options={applicabilityStates.map((v) => ({
                      value: v,
                      label: label(v),
                    }))}
                  />
                </Field>
                <Field
                  id="final-classification"
                  label={text("regulatory.reviewed_classification_8987cf")}
                >
                  <Choice
                    id="final-classification"
                    value={classification}
                    onChange={(v) => {
                      setClassification(v as Assessment["classification"]);
                      setReviewed(false);
                    }}
                    options={classificationStates.map((v) => ({
                      value: v,
                      label: label(v),
                    }))}
                  />
                </Field>
              </div>
              <Field
                id="decision-rationale"
                label={text(
                  "regulatory.rationale_and_remaining_review_needs_2ff351",
                )}
                hint={text(
                  "regulatory.record_core_functionality_sources_and_reasons_fo_397ef1",
                )}
              >
                <Textarea
                  id="decision-rationale"
                  value={rationale}
                  maxLength={6000}
                  onChange={(e) => {
                    setRationale(e.target.value);
                    setReviewed(false);
                  }}
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                {text(...readinessDisclaimer)}
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="human-scope-review"
                  checked={reviewed}
                  onCheckedChange={(v) => setReviewed(v === true)}
                />
                <Label htmlFor="human-scope-review" className="leading-relaxed">
                  {text(
                    "regulatory.i_reviewed_the_product_version_roles_and_decisio_532ede",
                  )}
                </Label>
              </div>
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => (step ? setStep((s) => s - 1) : onClose())}
          >
            {step
              ? text("regulatory.back_16774a")
              : text("regulatory.cancel_116461")}
          </Button>
          {step < 3 ? (
            <Button
              disabled={nextDisabled || saving}
              onClick={() => setStep((s) => s + 1)}
            >
              {text("regulatory.continue_3706d1")}
            </Button>
          ) : (
            <Button
              onClick={() => void create()}
              disabled={saving || !reviewed || rationale.trim().length < 20}
            >
              {saving
                ? text("regulatory.creating_assessment_cf4f41")
                : text("regulatory.create_assessment_7a43fd")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
