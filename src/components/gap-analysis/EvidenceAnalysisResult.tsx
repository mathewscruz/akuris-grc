import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
export interface GroundedAnalysis {
  verdict: "conforme" | "parcial" | "nao_conforme" | "indeterminado";
  score: number | null;
  justification: string;
  evidence_kind?: "policy" | "execution" | "mixed" | "unknown";
  missing?: string[];
  next_steps?: string[];
  completion_criteria?: string[];
  citations?: {
    source_id: string;
    label: string;
    quote: string;
    method: string;
  }[];
  warnings?: string[];
  analyzed_at?: string;
  cached?: boolean;
  job_id?: string;
}
export function EvidenceAnalysisResult(
  { result, onOpen, onUsePlan }: {
    result: GroundedAnalysis;
    onOpen: () => void;
    onUsePlan: (text: string) => void;
  },
) {
  const { t } = useLanguage();
  const plan = [
    ...(result.next_steps || []),
    ...(result.completion_criteria?.length
      ? [t("evidenceIntelligence.criteria"), ...result.completion_criteria]
      : []),
  ].join("\n");
  return (
    <section
      className="space-y-3 rounded-md border bg-background p-3 text-xs"
      aria-label={t("evidenceIntelligence.analysis")}
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold">{t("evidenceIntelligence.analysis")}</h4>
        <Button variant="link" size="sm" onClick={onOpen}>
          {t("evidenceIntelligence.original")}
        </Button>
      </div>
      <p className="font-medium">
        {t("evidenceIntelligence.suggestedResult")}: {t(
          `gapUi.verdict.${
            {
              conforme: "conforme",
              parcial: "parcialmenteConforme",
              nao_conforme: "naoConforme",
              indeterminado: "indeterminado",
            }[result.verdict]
          }`,
        )}
      </p>
      {result.evidence_kind && (
        <p className="text-muted-foreground">
          {t(`evidenceIntelligence.kind.${result.evidence_kind}`)}
        </p>
      )}
      <p>{result.justification}</p>
      {(result.warnings || []).map((warning, i) => (
        <p key={i} className="text-warning">{warning}</p>
      ))}
      {!!result.citations?.length && (
        <div className="space-y-2">
          <h5 className="font-medium">{t("evidenceIntelligence.sources")}</h5>
          {result.citations.map((source, i) => (
            <blockquote key={i} className="border-l-2 border-primary/30 pl-3">
              <p className="text-muted-foreground">{source.label}</p>
              <p className="mt-1 whitespace-pre-wrap">“{source.quote}”</p>
            </blockquote>
          ))}
        </div>
      )}
      {!!result.missing?.length && (
        <div>
          <h5 className="font-medium">{t("evidenceIntelligence.missing")}</h5>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {result.missing.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {!!result.next_steps?.length && (
        <div>
          <h5 className="font-medium">{t("evidenceIntelligence.next")}</h5>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            {result.next_steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
      {!!result.completion_criteria?.length && (
        <div>
          <h5 className="font-medium">{t("evidenceIntelligence.criteria")}</h5>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {result.completion_criteria.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {plan && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUsePlan(plan)}
        >
          {t("evidenceIntelligence.usePlan")}
        </Button>
      )}
      <p className="border-t pt-2 text-muted-foreground">
        {t("evidenceIntelligence.human")}
        {result.cached ? ` ${t("evidenceIntelligence.cached")}` : ""}
      </p>
    </section>
  );
}
