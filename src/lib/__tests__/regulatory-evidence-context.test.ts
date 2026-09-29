/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any -- Edge boundary test doubles. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";

let resolveContext: (
  db: any,
  empresa: string,
  item: string,
  link: string,
) => Promise<any>;
beforeAll(async () => {
  const output = await build({
    entryPoints: ["supabase/functions/_shared/regulatory-evidence-context.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "auth-error-only",
        setup(b) {
          b.onResolve({ filter: /^\.\/auth\.ts$/ }, () => ({
            path: "auth",
            namespace: "fixture",
          }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              "export class AuthError extends Error { constructor(message,status){super(message);this.status=status;} }",
          }));
        },
      },
    ],
  });
  const context = { module: { exports: {} as any } };
  runInNewContext(output.outputFiles[0].text, context);
  resolveContext = context.module.exports.regulatoryEvidenceContext;
});
function harness(override: Record<string, any> = {}, permission = true) {
  const rows: Record<string, any> = {
    regulatory_assessment_items: {
      id: "item",
      empresa_id: "tenant",
      assessment_id: "assessment",
      product_id: "product",
      requirement_id: "requirement",
      snapshot: {
        code: "CRA-SSC-001",
        title: "Frozen requirement",
        guidance: "Frozen guidance",
        evidence: ["Record"],
      },
    },
    regulatory_evidence_links: {
      id: "link",
      item_id: "item",
      evidence_id: "evidence",
      valid_until: "2026-10-01",
    },
    regulatory_assessments: {
      id: "assessment",
      product_id: "product",
      product_version_id: "v1",
      status: "in_progress",
      roles: ["manufacturer"],
    },
    evidence_library: {
      id: "evidence",
      arquivo_url: "tenant/safe.txt",
      arquivo_nome: "safe.txt",
      arquivo_hash: "hash",
      bucket: "gap-evidence-library",
    },
    products: { id: "product", name: "Product" },
    product_versions: { id: "v1", version: "1.0" },
    ...override,
  };
  const filters: { table: string; column: string; value: unknown }[] = [];
  const db = {
    rpc: vi.fn(async () => ({ data: permission, error: null })),
    from: vi.fn((table: string) => {
      const chain: any = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push({ table, column, value });
          return chain;
        },
        is: (column: string, value: unknown) => {
          filters.push({ table, column, value });
          return chain;
        },
        single: async () => ({
          data: rows[table],
          error: rows[table] ? null : { code: "not_found" },
        }),
      };
      return chain;
    }),
  };
  return { db, filters };
}
describe("CRA AI evidence context is resolved by authenticated RLS", () => {
  it("uses frozen requirement, selected product/version and library path", async () => {
    const h = harness();
    const r = await resolveContext(h.db, "tenant", "item", "link");
    expect(r.filePath).toBe("tenant/safe.txt");
    expect(r.expectedHash).toBe("hash");
    expect(r.requirement).toMatchObject({
      titulo: "Frozen requirement",
      regulatory_context: {
        item_id: "item",
        version: { version: "1.0" },
        valid_until: "2026-10-01",
      },
    });
    for (const table of [
      "regulatory_assessment_items",
      "regulatory_evidence_links",
      "regulatory_assessments",
      "evidence_library",
      "products",
      "product_versions",
    ])
      expect(h.filters).toContainEqual({
        table,
        column: "empresa_id",
        value: "tenant",
      });
    expect(h.filters).toContainEqual({
      table: "regulatory_evidence_links",
      column: "removed_at",
      value: null,
    });
    expect(h.filters).toContainEqual({
      table: "regulatory_evidence_links",
      column: "item_id",
      value: "item",
    });
  });
  it("requires update permission before reading evidence", async () => {
    const h = harness({}, false);
    await expect(
      resolveContext(h.db, "tenant", "item", "link"),
    ).rejects.toMatchObject({ status: 403 });
    expect(h.db.from).not.toHaveBeenCalled();
  });
  it.each([
    "regulatory_assessment_items",
    "regulatory_evidence_links",
    "regulatory_assessments",
    "evidence_library",
    "products",
    "product_versions",
  ])("rejects missing or RLS-hidden %s", async (table) => {
    const h = harness({ [table]: null });
    await expect(
      resolveContext(h.db, "tenant", "item", "link"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("rejects archived assessments and URL-only evidence", async () => {
    await expect(
      resolveContext(
        harness({ regulatory_assessments: { status: "archived" } }).db,
        "tenant",
        "item",
        "link",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      resolveContext(
        harness({ evidence_library: { link_externo: "https://example.test" } })
          .db,
        "tenant",
        "item",
        "link",
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("compiles the real shared HTTP handler and all local imports", async () => {
    await expect(
      build({
        entryPoints: [
          "supabase/functions/analyze-evidence-against-requirement/index.ts",
        ],
        bundle: true,
        platform: "neutral",
        format: "esm",
        write: false,
        external: ["npm:*", "https:*"],
      }),
    ).resolves.toHaveProperty("outputFiles");
  });
});
