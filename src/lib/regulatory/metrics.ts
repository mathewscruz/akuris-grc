import type { AssessmentItem, EvidenceLink, Finding } from "./types";
import { calculateReadinessScore } from "./readiness-score";
import { formatarDiaParaDB } from "@/lib/date-utils";

export function regulatoryMetrics(
  items: AssessmentItem[],
  links: EvidenceLink[],
  findings: Finding[],
  validity: Map<string, string | null>,
  today = formatarDiaParaDB(new Date()),
) {
  const score = calculateReadinessScore(
    items.map((i) => ({
      requirementId: i.requirement_id,
      domain: i.snapshot.domain,
      status: i.status,
      weight: i.snapshot.weight,
    })),
  );
  const covered = new Set(
    links
      .filter(
        (l) =>
          !l.removed_at &&
          l.review_status === "accepted" &&
          validity.has(l.evidence_id) &&
          (!l.valid_until || l.valid_until >= today) &&
          (!validity.get(l.evidence_id) ||
            validity.get(l.evidence_id)! >= today),
      )
      .map((l) => l.item_id),
  );
  const applicable = items.filter((i) => i.status !== "nao_aplicavel");
  const evidenceCovered = applicable.filter((i) => covered.has(i.id)).length;
  const unresolved = findings.filter((f) => f.status !== "resolved");
  return {
    score,
    evidenceCovered,
    evidenceCoverage: applicable.length
      ? Math.round((evidenceCovered / applicable.length) * 1000) / 10
      : null,
    riskCounts: Object.fromEntries(
      ["critical", "high", "medium", "low"].map((r) => [
        r,
        unresolved.filter((f) => f.risk === r).length,
      ]),
    ),
    remediationTotal: findings.length,
    remediationCompleted: findings.filter(
      (f) => f.status === "completed" || f.status === "resolved",
    ).length,
    acceptedRisks: findings.filter((f) => f.status === "risk_accepted").length,
  };
}
