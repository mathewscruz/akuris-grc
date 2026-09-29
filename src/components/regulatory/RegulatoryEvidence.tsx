import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  regulatoryDb as db,
  type AssessmentItem,
  type EvidenceLink,
} from "@/lib/regulatory/types";
import { downloadStorageFile } from "@/lib/storage";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import {
  EvidenceAnalysisResult,
  type GroundedAnalysis,
} from "@/components/gap-analysis/EvidenceAnalysisResult";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Choice, Field } from "./shared";
import type { Library, Person } from "./RequirementDialog";
import { RegulatoryMappings } from "./RegulatoryMappings";

const safeExternal = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
};
export function RegulatoryEvidence({
  item,
  links,
  people,
  library,
  writable,
  onSaved,
  onSuggestion,
}: {
  item: AssessmentItem;
  links: EvidenceLink[];
  people: Person[];
  library: Library;
  writable: boolean;
  onSaved: () => Promise<unknown>;
  onSuggestion: (value: string) => void;
}) {
  const { text, label } = useCraText();
  const canCreate = usePermissions().canCreate("gap-analysis");
  const [uploadKey, setUploadKey] = useState(0);
  const [chosen, setChosen] = useState("none");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  async function link(existing?: string) {
    setError("");
    if (!existing && (!name.trim() || (!file && !safeExternal(url)))) {
      setError(
        text("regulatory.enter_a_name_and_a_file_or_valid_https_url_508de8"),
      );
      return;
    }
    if (file && file.size > 50 * 1024 * 1024) {
      setError(text("regulatory.files_must_be_50_mb_or_smaller_d2cb26"));
      return;
    }
    setBusy(true);
    try {
      const evidenceId =
        existing ||
        (
          await library.uploadAndCreate({
            nome: name.trim(),
            file,
            link_externo: file ? undefined : safeExternal(url)!,
            tags: ["CRA"],
            signedUpload: true,
          })
        )?.id;
      if (!evidenceId) throw new Error("upload");
      const { error: err } = await db
        .from("regulatory_evidence_links")
        .insert({
          empresa_id: item.empresa_id,
          product_id: item.product_id,
          item_id: item.id,
          evidence_id: evidenceId,
        })
        .select("id")
        .single();
      if (err) throw err;
      setChosen("none");
      setName("");
      setUrl("");
      setFile(null);
      setUploadKey((v) => v + 1);
      await onSaved();
    } catch {
      setError(
        text(
          "regulatory.could_not_link_check_whether_the_evidence_is_alr_9292ef",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const available = library.items.filter(
    (e) =>
      !links.some((l) => l.evidence_id === e.id) &&
      `${e.nome} ${e.arquivo_nome ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {text(
          "regulatory.reuse_your_organization_s_library_acceptance_app_b0165a",
        )}
      </p>
      {library.loadError && (
        <div role="alert">
          {text("regulatory.could_not_load_the_library_4e4ab6")}{" "}
          <Button variant="link" onClick={() => void library.fetchAll()}>
            {text("regulatory.retry_c625ae")}
          </Button>
        </div>
      )}
      {writable && canCreate && (
        <fieldset disabled={busy} className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">
            {text("regulatory.reuse_evidence_985b6b")}
          </h3>
          <Input
            aria-label={text("regulatory.search_evidence_a448f9")}
            placeholder={text("regulatory.search_library_1f5a78")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <div className="min-w-0 flex-1">
              <Choice
                id="existing-evidence"
                disabled={busy || library.loading}
                value={chosen}
                onChange={setChosen}
                options={[
                  {
                    value: "none",
                    label: text("regulatory.select_evidence_71e480"),
                  },
                  ...available.map((e) => ({ value: e.id, label: e.nome })),
                ]}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || chosen === "none"}
              onClick={() => void link(chosen)}
            >
              {text("regulatory.link_44071e")}
            </Button>
          </div>
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium">
              {text("regulatory.add_a_new_file_or_url_658b4e")}
            </summary>
            <div className="mt-4 space-y-3">
              <Field id="evidence-name" label={text("regulatory.name_8722c3")}>
                <Input
                  id="evidence-name"
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field
                id="evidence-file"
                label={text("regulatory.file_up_to_50_mb_931c52")}
              >
                <Input
                  id="evidence-file"
                  type="file"
                  key={uploadKey}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Field
                id="evidence-url"
                label={text("regulatory.or_https_url_c4e0df")}
              >
                <Input
                  id="evidence-url"
                  type="url"
                  disabled={!!file}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {text(
                  "regulatory.files_are_private_and_downloaded_as_attachments__0029c5",
                )}
              </p>
              <Button disabled={busy} onClick={() => void link()}>
                {text("regulatory.add_and_link_140ef4")}
              </Button>
            </div>
          </details>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {links.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          {text("regulatory.no_evidence_linked_yet_dd45f2")}
        </p>
      )}
      {links.map((link) => (
        <EvidenceReview
          key={`${link.id}:${link.updated_at}`}
          link={link}
          item={item}
          library={library}
          people={people}
          writable={writable}
          onSaved={onSaved}
          onSuggestion={onSuggestion}
        />
      ))}
      <RegulatoryMappings controls={item.snapshot.controls ?? []} />
    </div>
  );
}
function EvidenceReview({
  link,
  item,
  library,
  people,
  writable,
  onSaved,
  onSuggestion,
}: {
  link: EvidenceLink;
  item: AssessmentItem;
  library: Library;
  people: Person[];
  writable: boolean;
  onSaved: () => Promise<unknown>;
  onSuggestion: (value: string) => void;
}) {
  const { text, label } = useCraText();
  const evidence = library.items.find((e) => e.id === link.evidence_id);
  const [value, setValue] = useState({
    owner_id: link.owner_id,
    evidence_date: link.evidence_date,
    valid_until: link.valid_until,
    review_status: link.review_status,
    comment: link.comment,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GroundedAnalysis | null>(null);
  const [jobId, setJobId] = useState<string | null>(link.analysis_job_id);
  const previous = useQuery({
    queryKey: ["regulatory", item.empresa_id, "analysis", link.analysis_job_id],
    enabled: !!link.analysis_job_id,
    queryFn: async () => {
      const r = await invokeEdgeFunction<GroundedAnalysis>(
        "analyze-evidence-against-requirement",
        { body: { action: "status", jobId: link.analysis_job_id } },
      );
      if (r.error) throw r.error;
      return r.data;
    },
    retry: false,
  });
  async function save(remove = false) {
    setBusy(true);
    setError("");
    try {
      const { error: err } = await db
        .from("regulatory_evidence_links")
        .update(remove ? { removed_at: new Date().toISOString() } : value)
        .eq("id", link.id)
        .eq("empresa_id", item.empresa_id)
        .eq("updated_at", link.updated_at)
        .select("id")
        .single();
      if (err) throw err;
      await onSaved();
    } catch {
      setError(
        text(
          "regulatory.could_not_save_the_review_check_dates_permission_cf79d1",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const r = await invokeEdgeFunction<
        GroundedAnalysis & { status?: string; error?: string }
      >("analyze-evidence-against-requirement", {
        body: jobId
          ? { action: "status", jobId }
          : { assessmentItemId: item.id, evidenceLinkId: link.id },
      });
      if (r.error || !r.data) throw new Error("analysis");
      if (r.data.verdict) {
        setResult(r.data);
        setJobId(null);
        await onSaved();
      } else if (r.data.status === "running") {
        setJobId(r.data.job_id ?? null);
        setError(
          text(
            "regulatory.analysis_running_use_check_analysis_shortly_chec_8d8154",
          ),
        );
      } else {
        setJobId(null);
        throw new Error("analysis");
      }
    } catch {
      setError(
        text(
          "regulatory.the_analysis_did_not_complete_check_format_credi_ef8e04",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const open = async () => {
    if (
      evidence?.arquivo_url &&
      !(await downloadStorageFile(
        evidence.bucket || "gap-evidence-library",
        evidence.arquivo_url,
        evidence.arquivo_nome,
      ))
    )
      setError(text("regulatory.file_unavailable_a4af06"));
  };
  const analysis = result ?? previous.data;
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">
          {evidence?.nome ?? text("regulatory.evidence_unavailable_9b6f67")}
        </h4>
        <span className="text-sm text-muted-foreground">
          {label(link.review_status)}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {evidence?.arquivo_url && (
          <Button variant="outline" size="sm" onClick={() => void open()}>
            {text("regulatory.download_file_7e8598")}
          </Button>
        )}
        {evidence?.link_externo && safeExternal(evidence.link_externo) && (
          <a
            className="text-sm text-primary underline"
            href={safeExternal(evidence.link_externo)!}
            target="_blank"
            rel="noopener noreferrer"
          >
            {text("regulatory.open_external_reference_a969e8")}
          </a>
        )}
      </div>
      <details>
        <summary className="cursor-pointer text-sm">
          {text("regulatory.owner_validity_and_review_edfef0")}
        </summary>
        <fieldset
          disabled={!writable || busy}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <Field
            id={`owner-${link.id}`}
            label={text("regulatory.owner_865f50")}
          >
            <Choice
              id={`owner-${link.id}`}
              disabled={!writable || busy}
              value={value.owner_id ?? "none"}
              onChange={(v) =>
                setValue((s) => ({ ...s, owner_id: v === "none" ? null : v }))
              }
              options={[
                { value: "none", label: "—" },
                ...people.map((p) => ({ value: p.id, label: p.nome })),
              ]}
            />
          </Field>
          <Field
            id={`review-${link.id}`}
            label={text("regulatory.human_review_94ac30")}
          >
            <Choice
              id={`review-${link.id}`}
              disabled={!writable || busy}
              value={value.review_status}
              onChange={(v) =>
                setValue((s) => ({
                  ...s,
                  review_status: v as EvidenceLink["review_status"],
                }))
              }
              options={["unreviewed", "accepted", "rejected"].map((v) => ({
                value: v,
                label: label(v),
              }))}
            />
          </Field>
          {(["evidence_date", "valid_until"] as const).map((key, index) => (
            <Field
              key={key}
              id={`${key}-${link.id}`}
              label={
                index
                  ? text("regulatory.valid_until_19f35d")
                  : text("regulatory.evidence_date_ebc903")
              }
            >
              <Input
                id={`${key}-${link.id}`}
                type="date"
                value={value[key] ?? ""}
                onChange={(e) =>
                  setValue((s) => ({ ...s, [key]: e.target.value || null }))
                }
              />
            </Field>
          ))}
          <div className="sm:col-span-2">
            <Field
              id={`comment-${link.id}`}
              label={text("regulatory.comment_eac933")}
            >
              <Textarea
                id={`comment-${link.id}`}
                maxLength={6000}
                value={value.comment}
                onChange={(e) =>
                  setValue((s) => ({ ...s, comment: e.target.value }))
                }
              />
            </Field>
          </div>
          {writable && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void save()}
            >
              {text("regulatory.save_review_ebbe7c")}
            </Button>
          )}
        </fieldset>
      </details>
      {writable && (
        <div className="flex flex-wrap items-center gap-3">
          {evidence?.arquivo_url && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void analyze()}
            >
              {jobId
                ? text("regulatory.check_analysis_f5e9f1")
                : text("regulatory.analyze_with_ai_1_credit_84eaea")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void save(true)}
          >
            {text("regulatory.unlink_keep_in_library_9261c1")}
          </Button>
        </div>
      )}
      {analysis?.verdict && (
        <EvidenceAnalysisResult
          result={analysis}
          onOpen={() => void open()}
          onUsePlan={onSuggestion}
        />
      )}
      {error && (
        <p role="status" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
