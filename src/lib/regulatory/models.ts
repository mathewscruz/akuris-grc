import { z } from "zod";

export const criticalitySchema = z.enum(["low", "medium", "high", "critical"]);
export const mappingStrengthSchema = z.enum(["full", "partial", "supporting"]);
export const regulatoryRoleSchema = z.enum([
  "manufacturer",
  "importer",
  "distributor",
  "authorised_representative",
]);
export const productClassificationSchema = z.enum([
  "default",
  "important_class_i",
  "important_class_ii",
  "critical",
  "review_required",
]);

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    // Calendar values have no timezone and must not be converted to UTC timestamps.
    const [year, month, day] = value.split("-").map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return (
      year >= 1 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= days[month - 1]
    );
  }, "Invalid calendar date");

// Repository credentials never belong in a product record or its audit trail.
const repositorySchema = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    if (
      !/^https:\/\/[a-z0-9][a-z0-9.-]*(:[0-9]{1,5})?(\/[^\s?#]*)?$/i.test(
        value,
      ) ||
      value.includes("\\")
    )
      return false;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "Use an HTTPS repository URL without credentials, query parameters or fragments");

export const productDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    product_type: z.enum(["software", "hardware", "combined", "other"]),
    description: z.string().trim().max(12000).default(""),
    product_owner_id: z.string().uuid().nullable().default(null),
    security_owner_id: z.string().uuid().nullable().default(null),
    development_team: z.string().trim().max(500).default(""),
    deployment_model: z
      .enum(["on_premise", "cloud", "hybrid", "embedded", "mobile", "unknown"])
      .default("unknown"),
    repositories: z.array(repositorySchema).max(50).default([]),
    markets: z.array(z.string().trim().min(1).max(100)).max(250).default([]),
    eu_availability: z.enum(["yes", "no", "unknown"]).default("unknown"),
    status: z.enum(["active", "archived"]).default("active"),
  })
  .strict();

export const productVersionDraftSchema = z
  .object({
    product_id: z.string().uuid(),
    version: z.string().trim().min(1).max(100),
    release_date: dateSchema.nullable().default(null),
    support_starts_on: dateSchema.nullable().default(null),
    support_ends_on: dateSchema.nullable().default(null),
    support_rationale: z.string().trim().max(4000).default(""),
    lifecycle_status: z
      .enum(["development", "released", "end_of_support", "archived"])
      .default("development"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.support_ends_on &&
      [value.release_date, value.support_starts_on].some(
        (start) => start && start > value.support_ends_on!,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["support_ends_on"],
        message: "Support cannot end before release or support start",
      });
    }
    // Do not impose an unconditional five-year duration: legal exceptions need review.
  });

const nonEmpty = z.string().trim().min(1);
const sourceUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"));
export const regulatoryCatalogSchema = z
  .object({
    version: nonEmpty,
    verifiedOn: dateSchema,
    sourceUrl,
    classificationSourceUrl: sourceUrl,
    reportingAppliesOn: dateSchema,
    generalAppliesOn: dateSchema,
    coverage: nonEmpty,
    domains: z
      .array(
        z
          .object({
            code: nonEmpty,
            name: nonEmpty,
            nameEn: nonEmpty,
            position: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
    controls: z
      .array(
        z
          .object({
            code: z.string().regex(/^AK-[A-Z0-9]+-[0-9]{3}$/),
            domain: nonEmpty,
            name: nonEmpty,
            nameEn: nonEmpty,
            description: nonEmpty,
            descriptionEn: nonEmpty,
          })
          .strict(),
      )
      .min(1),
    requirements: z
      .array(
        z
          .object({
            code: nonEmpty,
            domain: nonEmpty,
            controlCode: nonEmpty,
            title: nonEmpty,
            titleEn: nonEmpty,
            legalReference: nonEmpty,
            criticality: criticalitySchema,
            riskLevel: criticalitySchema,
            weight: z.number().int().min(1).max(5),
            description: nonEmpty,
            descriptionEn: nonEmpty,
            question: nonEmpty,
            questionEn: nonEmpty,
            expectedEvidence: z.array(nonEmpty).min(1),
            expectedEvidenceEn: z.array(nonEmpty).min(1),
            guidance: nonEmpty,
            guidanceEn: nonEmpty,
            remediationGuidance: nonEmpty,
            remediationGuidanceEn: nonEmpty,
            applicabilityRule: z
              .object({
                version: z.literal(1),
                kind: z.literal("human_review_required"),
                roles: z.array(regulatoryRoleSchema).min(1),
                categories: z.array(productClassificationSchema).min(1),
                note: nonEmpty,
              })
              .strict(),
            mappingStrength: mappingStrengthSchema,
            mappingNotes: nonEmpty,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((catalog, context) => {
    const unique = (values: (string | number)[], path: string) => {
      if (new Set(values).size !== values.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: "Duplicate catalog identity",
        });
    };
    unique(
      catalog.domains.map((d) => d.code),
      "domains",
    );
    unique(
      catalog.domains.map((d) => d.position),
      "domains",
    );
    unique(
      catalog.controls.map((c) => c.code),
      "controls",
    );
    unique(
      catalog.requirements.map((r) => r.code),
      "requirements",
    );
    const domains = new Set(catalog.domains.map((d) => d.code));
    const controls = new Set(catalog.controls.map((c) => c.code));
    if (
      catalog.controls.some((c) => !domains.has(c.domain)) ||
      catalog.requirements.some(
        (r) => !domains.has(r.domain) || !controls.has(r.controlCode),
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unknown catalog domain or control",
      });
    }
  });

export type ProductDraft = z.infer<typeof productDraftSchema>;
export type ProductVersionDraft = z.infer<typeof productVersionDraftSchema>;
export type RegulatoryCatalog = z.infer<typeof regulatoryCatalogSchema>;
export type RegulatoryRole = z.infer<typeof regulatoryRoleSchema>;
export type ProductClassification = z.infer<typeof productClassificationSchema>;
export type MappingStrength = z.infer<typeof mappingStrengthSchema>;
