import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  regulatoryDb as db,
  type Product,
  type ProductVersion,
} from "@/lib/regulatory/types";
import {
  buildRegulatoryReport,
  type RegulatoryReportData,
} from "@/lib/regulatory/report";
import { readAllPagesByIds } from "@/lib/read-all-pages";
import { useCraText } from "@/hooks/useRegulatoryText";

import type { Library, Person } from "./RequirementDialog";
export function ReportButton({
  data,
  product,
  version,
  library,
  people,
}: {
  data: RegulatoryReportData;
  product: Product;
  version: ProductVersion;
  library: Library;
  people: Person[];
}) {
  const { text, locale } = useCraText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const company = await db
        .from("empresas")
        .select("nome")
        .eq("id", data.assessment.empresa_id)
        .single();
      if (company.error) throw company.error;
      const ids = data.findings.flatMap((f) =>
        f.action_plan_id ? [f.action_plan_id] : [],
      );
      const actions = await readAllPagesByIds(ids, (batch, from, to) =>
        db
          .from("planos_acao")
          .select("id,titulo,status,prazo")
          .eq("empresa_id", data.assessment.empresa_id)
          .in("id", batch)
          .order("id")
          .range(from, to),
      );
      if (actions.error) throw actions.error;
      const report = buildRegulatoryReport({
        data,
        product,
        version,
        evidence: library.items,
        locale,
        company: company.data.nome,
        people,
        actions: actions.data,
      });
      const { buildDocGenPdfBlob } = await import("@/lib/docgen-pdf");
      const blob = await buildDocGenPdfBlob(report.document, report.options);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `CRA-${product.name}-${version.version}.pdf`.replace(
        /[\\/:*?"<>|]/g,
        "-",
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError(
        text(
          "regulatory.could_not_generate_the_report_retry_after_refres_00ee5d",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        disabled={
          busy || library.loading || library.loadError || !product || !version
        }
        onClick={() => void download()}
      >
        {busy
          ? text("regulatory.preparing_report_af7c92")
          : text("regulatory.export_pdf_report_e984ed")}
      </Button>
      {error && (
        <p role="alert" className="max-w-sm text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
