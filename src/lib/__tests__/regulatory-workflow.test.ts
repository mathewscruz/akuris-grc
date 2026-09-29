import { describe, it, expect } from "vitest";
import {
  evaluateApplicability,
  initialApplicabilityAnswers,
  applicabilityAnswersSchema,
  type ApplicabilityAnswers,
} from "@/lib/regulatory/applicability";
import { parseSbom, SBOM_MAX_BYTES } from "@/lib/regulatory/sbom";
import { regulatoryMetrics } from "@/lib/regulatory/metrics";
import type {
  AssessmentItem,
  EvidenceLink,
  Finding,
} from "@/lib/regulatory/types";
import { matchesRegulatorySearch } from "@/lib/regulatory/search";

describe("CRA list search", () => {
  it("matches codes, names and translated status without accent sensitivity", () => {
    expect(
      matchesRegulatorySearch(
        "cooperacao",
        "CRA-SSC-001",
        "Cooperação na cadeia",
      ),
    ).toBe(true);
    expect(matchesRegulatorySearch("cra-ssc-001", "CRA-SSC-001")).toBe(true);
    expect(matchesRegulatorySearch("missing", "CRA-SSC-001")).toBe(false);
    expect(matchesRegulatorySearch(" ", null)).toBe(true);
  });
});
const scope = (): ApplicabilityAnswers => ({
  ...initialApplicabilityAnswers(),
  digital: "yes",
  connected: "yes",
  commercial: "yes",
  eu_market: "yes",
  installed: "yes",
  sector_exclusion: "no",
  steward: "no",
  noncommercial_oss: "no",
  primary_category: "other",
});
describe("CRA deterministic screening", () => {
  it("preserves uncertainty instead of guessing a legal result", () =>
    expect(
      evaluateApplicability(initialApplicabilityAnswers()).applicability,
    ).toBe("legal_review_required"));
  it("classifies a commercial connected EU product provisionally, not as certification", () =>
    expect(evaluateApplicability(scope())).toMatchObject({
      applicability: "likely_applicable",
      classification: "default",
    }));
  it.each(["digital", "connected", "eu_market"] as const)(
    "recognizes negative %s scope",
    (key) =>
      expect(
        evaluateApplicability({ ...scope(), [key]: "no" }).applicability,
      ).toBe("likely_not_applicable"),
  );
  it("requires legal review for pure SaaS, stewards and possible exclusions", () => {
    expect(
      evaluateApplicability({
        ...scope(),
        installed: "no",
        mobile: "no",
        desktop: "no",
        device: "no",
        required_cloud: "no",
      }).applicability,
    ).toBe("legal_review_required");
    expect(
      evaluateApplicability({ ...scope(), steward: "yes" }).applicability,
    ).toBe("legal_review_required");
    expect(
      evaluateApplicability({ ...scope(), sector_exclusion: "unknown" })
        .applicability,
    ).toBe("legal_review_required");
  });
  it("does not turn incidental login/IAM into an important product", () =>
    expect(
      evaluateApplicability({ ...scope(), authentication: "yes", iam: "yes" })
        .classification,
    ).toBe("default"));
  it.each([
    ["annex_iii_i", "important_class_i"],
    ["annex_iii_ii", "important_class_ii"],
    ["annex_iv", "critical"],
    ["unknown", "review_required"],
  ] as const)(
    "maps reviewed core category %s",
    (primary_category, classification) =>
      expect(
        evaluateApplicability({ ...scope(), primary_category }).classification,
      ).toBe(classification),
  );
  it("requires manufacturer-duty review for rebranding/substantial changes", () => {
    expect(
      evaluateApplicability({ ...scope(), own_brand: "yes" })
        .manufacturer_review,
    ).toBe(true);
    expect(
      evaluateApplicability({ ...scope(), substantial_modification: "yes" })
        .manufacturer_review,
    ).toBe(true);
  });
  it("rejects partial or injected decision input", () => {
    expect(
      applicabilityAnswersSchema.safeParse({ digital: "yes" }).success,
    ).toBe(false);
    expect(
      applicabilityAnswersSchema.safeParse({
        ...scope(),
        classification: "certified",
      }).success,
    ).toBe(false);
  });
});
describe("SBOM structural metadata import", () => {
  const cdx = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      timestamp: "2026-09-29T12:00:00Z",
      tools: { components: [{ name: "Syft" }] },
    },
    components: [{ name: "app", components: [{ name: "nested" }] }],
  };
  const spdx = {
    spdxVersion: "SPDX-2.3",
    SPDXID: "SPDXRef-DOCUMENT",
    dataLicense: "CC0-1.0",
    name: "product",
    documentNamespace: "https://example.test/sbom/1",
    creationInfo: { created: "2026-09-29T12:00:00Z", creators: ["Tool: Syft"] },
    packages: [{ name: "app", SPDXID: "SPDXRef-app" }],
  };
  it("reads CycloneDX and nested declared component counts", () =>
    expect(parseSbom(JSON.stringify(cdx))).toMatchObject({
      format: "CycloneDX",
      component_count: 2,
      tool: "Syft",
    }));
  it("reads SPDX 2.x without pretending to scan vulnerabilities", () =>
    expect(parseSbom(JSON.stringify(spdx))).toMatchObject({
      format: "SPDX",
      component_count: 1,
      tool: "Syft",
    }));
  it("accepts an explicitly empty component list, not a missing list", () => {
    expect(
      parseSbom(JSON.stringify({ ...cdx, components: [] })).component_count,
    ).toBe(0);
    expect(() =>
      parseSbom(JSON.stringify({ ...cdx, components: undefined })),
    ).toThrow();
  });
  it.each([
    "<html>not a SBOM</html>",
    "{}",
    '{"bomFormat":"CycloneDX","specVersion":"100"}',
  ])("rejects unsupported or malformed content", (source) =>
    expect(() => parseSbom(source)).toThrow(),
  );
  it("rejects malformed nested components, duplicate SPDX IDs and oversized payloads", () => {
    expect(() =>
      parseSbom(
        JSON.stringify({
          ...cdx,
          components: [{ name: "app", components: "fake" }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseSbom(
        JSON.stringify({
          ...spdx,
          packages: [spdx.packages[0], spdx.packages[0]],
        }),
      ),
    ).toThrow();
    expect(() => parseSbom(" ".repeat(SBOM_MAX_BYTES + 1))).toThrow(
      "sbom_size",
    );
  });
});
describe("evidence coverage is scoped and never changes readiness", () => {
  const items = [
    {
      id: "i1",
      requirement_id: "r1",
      status: "parcial",
      snapshot: { domain: "d1", weight: 1 },
    },
    {
      id: "i2",
      requirement_id: "r2",
      status: "nao_avaliado",
      snapshot: { domain: "d1", weight: 1 },
    },
    {
      id: "i3",
      requirement_id: "r3",
      status: "nao_aplicavel",
      snapshot: { domain: "d1", weight: 1 },
    },
  ] as AssessmentItem[];
  const link = (overrides: Partial<EvidenceLink> = {}): EvidenceLink =>
    ({
      id: "link",
      item_id: "i1",
      evidence_id: "e1",
      review_status: "accepted",
      removed_at: null,
      valid_until: "2026-10-01",
      ...overrides,
    }) as EvidenceLink;
  it("counts accepted evidence once per applicable item", () => {
    const m = regulatoryMetrics(
      items,
      [link(), link({ id: "duplicate" }), link({ item_id: "i3" })],
      [],
      new Map([["e1", null]]),
      "2026-09-29",
    );
    expect(m.evidenceCoverage).toBe(50);
    expect(m.score.score).toBe(50);
    expect(m.score.pending).toBe(1);
  });
  it.each([
    { removed_at: "2026-09-29" },
    { review_status: "unreviewed" as const },
    { review_status: "rejected" as const },
    { valid_until: "2026-09-28" },
  ])("excludes ineligible link %j", (override) =>
    expect(
      regulatoryMetrics(
        items,
        [link(override)],
        [],
        new Map([["e1", null]]),
        "2026-09-29",
      ).evidenceCovered,
    ).toBe(0),
  );
  it("respects library expiry and missing evidence independently", () => {
    expect(
      regulatoryMetrics(
        items,
        [link()],
        [],
        new Map([["e1", "2026-09-28"]]),
        "2026-09-29",
      ).evidenceCovered,
    ).toBe(0);
    expect(
      regulatoryMetrics(items, [link()], [], new Map(), "2026-09-29")
        .evidenceCovered,
    ).toBe(0);
  });
  it("counts accepted risks as unresolved, not completed remediation", () => {
    const findings = [
      { status: "risk_accepted", risk: "high" },
      { status: "completed", risk: "high" },
      { status: "resolved", risk: "critical" },
    ] as Finding[];
    const m = regulatoryMetrics(items, [], findings, new Map(), "2026-09-29");
    expect(m.riskCounts.high).toBe(2);
    expect(m.riskCounts.critical).toBe(0);
    expect(m.acceptedRisks).toBe(1);
    expect(m.remediationCompleted).toBe(2);
    expect(m.score.score).toBe(50);
  });
});
