import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCraText } from "@/hooks/useRegulatoryText";

export function CraEntry() {
  const { text } = useCraText();
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-gradient-to-r from-primary/5 to-background p-5">
      <div className="max-w-3xl">
        <p className="text-xs font-medium text-muted-foreground">
          {text(
            "regulatory.european_union_regulation_product_assessment_8b17b1",
          )}
        </p>
        <h2 className="mt-1 text-lg font-semibold">
          Cyber Resilience Act — CRA Readiness Assessment
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {text(
            "regulatory.from_applicability_to_remediation_products_versi_1d2ccb",
          )}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/gap-analysis/cra">
          {text("regulatory.explore_cra_3275f9")} →
        </Link>
      </Button>
    </section>
  );
}
