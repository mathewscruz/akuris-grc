import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import {
  regulatoryDb as db,
  type Assessment,
  type Sbom,
} from "@/lib/regulatory/types";
import { parseSbom, SBOM_MAX_BYTES } from "@/lib/regulatory/sbom";
import { downloadStorageFile } from "@/lib/storage";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Choice } from "./shared";
import type { Library } from "./RequirementDialog";
export function SbomPanel({
  assessment,
  sboms,
  library,
  writable,
  onSaved,
}: {
  assessment: Assessment;
  sboms: Sbom[];
  library: Library;
  writable: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { text, label, locale } = useCraText();
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > SBOM_MAX_BYTES) throw new Error("size");
      const metadata = parseSbom(await file.text());
      const evidence = await library.uploadAndCreate({
        file,
        nome: `SBOM · ${file.name}`,
        tags: ["CRA", "SBOM"],
        signedUpload: true,
      });
      if (!evidence) throw new Error("upload");
      const r = await db
        .from("regulatory_sboms")
        .insert({
          empresa_id: assessment.empresa_id,
          product_id: assessment.product_id,
          product_version_id: assessment.product_version_id,
          evidence_id: evidence.id,
          ...metadata,
        })
        .select("id")
        .single();
      if (r.error) throw r.error;
      setFile(null);
      setUploadKey((v) => v + 1);
      await onSaved();
    } catch {
      setError(
        text(
          "regulatory.could_not_import_use_cyclonedx_1_4_1_7_or_spdx_2_479756",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function status(row: Sbom, value: string) {
    setBusy(true);
    setError("");
    try {
      const r = await db
        .from("regulatory_sboms")
        .update({ status: value as Sbom["status"] })
        .eq("id", row.id)
        .eq("empresa_id", assessment.empresa_id)
        .eq("updated_at", row.updated_at)
        .select("id")
        .single();
      if (r.error) throw r.error;
      await onSaved();
    } catch {
      setError(text("regulatory.could_not_update_af4722"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Software Bill of Materials</h2>
        <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
          {text(
            "regulatory.history_is_scoped_to_the_selected_product_versio_e88a03",
          )}
        </p>
      </div>
      {writable && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="max-w-md flex-1">
            <label htmlFor="sbom-file" className="mb-2 block text-sm">
              {text("regulatory.json_file_up_to_12_mb_bdfc62")}
            </label>
            <Input
              id="sbom-file"
              key={uploadKey}
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button disabled={!file || busy} onClick={() => void upload()}>
            {busy
              ? text("regulatory.importing_5b3447")
              : text("regulatory.import_sbom_995960")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DataTable
        data={sboms}
        searchable={false}
        columns={[
          {
            key: "format",
            label: text("regulatory.format_dbc1ae"),
            render: (_, r) => `${r.format} ${r.spec_version}`,
          },
          {
            key: "component_count",
            label: text("regulatory.declared_components_6c5f11"),
          },
          { key: "tool", label: text("regulatory.tool_73115a") },
          {
            key: "generated_at",
            label: text("regulatory.generated_at_2ab8e5"),
            render: (v) => (v ? new Date(v).toLocaleString(locale) : "—"),
          },
          {
            key: "created_at",
            label: text("regulatory.imported_at_8630b1"),
            render: (v) => new Date(v).toLocaleString(locale),
          },
          {
            key: "status",
            label: "Status",
            render: (_, r) =>
              writable ? (
                <Choice
                  id={`sbom-${r.id}`}
                  disabled={busy}
                  value={r.status}
                  onChange={(v) => void status(r, v)}
                  options={["uploaded", "reviewed", "superseded"].map((v) => ({
                    value: v,
                    label: label(v),
                  }))}
                />
              ) : (
                label(r.status)
              ),
          },
          {
            key: "actions",
            label: text("regulatory.file_91dd6a"),
            render: (_, r) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const e = library.items.find((e) => e.id === r.evidence_id);
                  if (
                    !e ||
                    !(await downloadStorageFile(
                      e.bucket || "gap-evidence-library",
                      e.arquivo_url,
                      e.arquivo_nome,
                    ))
                  )
                    setError(text("regulatory.file_unavailable_a4af06"));
                }}
              >
                {text("regulatory.download_07509d")}
              </Button>
            ),
          },
        ]}
        emptyState={{
          title: text("regulatory.no_sbom_imported_for_this_version_f17939"),
        }}
      />
    </div>
  );
}
