import { z } from "zod";

const inputSchema = z.array(
  z
    .object({
      requirementId: z.string().min(1),
      domain: z.string().min(1),
      status: z.enum([
        "conforme",
        "parcial",
        "nao_conforme",
        "nao_aplicavel",
        "nao_avaliado",
      ]),
      weight: z.number().finite().positive().max(100),
    })
    .strict(),
);
export type ReadinessResponse = z.infer<typeof inputSchema>[number];

const points = { conforme: 100, parcial: 50, nao_conforme: 0 } as const;

/** New, explicitly named method. Never replaces the existing organizational score. */
export function calculateReadinessScore(input: ReadinessResponse[]) {
  const responses = inputSchema.parse(input);
  if (
    new Set(responses.map((r) => r.requirementId)).size !== responses.length
  ) {
    throw new Error("Duplicate assessment requirement");
  }
  const summarize = (items: ReadinessResponse[]) => {
    const applicable = items.filter((r) => r.status !== "nao_aplicavel");
    const assessed = applicable.filter((r) => r.status !== "nao_avaliado");
    const denominator = assessed.reduce((sum, r) => sum + r.weight, 0);
    const numerator = assessed.reduce(
      (sum, r) => sum + points[r.status as keyof typeof points] * r.weight,
      0,
    );
    return {
      score:
        denominator > 0
          ? Math.round((numerator / denominator) * 10) / 10
          : null,
      total: items.length,
      applicable: applicable.length,
      notApplicable: items.length - applicable.length,
      assessed: assessed.length,
      pending: applicable.length - assessed.length,
      assessmentCoverage:
        applicable.length > 0
          ? Math.round((assessed.length / applicable.length) * 1000) / 10
          : null,
    };
  };
  return {
    method: "assessed_weighted_v1" as const,
    ...summarize(responses),
    domains: [...new Set(responses.map((r) => r.domain))].map((domain) => ({
      domain,
      ...summarize(responses.filter((r) => r.domain === domain)),
    })),
  };
}
