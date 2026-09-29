import { z } from "zod";

export const SBOM_MAX_BYTES = 12 * 1024 * 1024;
const component = z.object({ name: z.string().min(1).max(2000) }).passthrough();
const timestamp = z.string().datetime({ offset: true }).optional();
const cyclonedx = z.object({
  bomFormat: z.literal("CycloneDX"),
  specVersion: z.enum(["1.4", "1.5", "1.6", "1.7"]),
  version: z.number().int().positive(),
  components: z.array(component).max(100000),
  metadata: z
    .object({
      timestamp,
      tools: z
        .union([
          z.array(
            z.object({ name: z.string(), version: z.string().optional() }),
          ),
          z.object({ components: z.array(component).optional() }),
        ])
        .optional(),
    })
    .optional(),
});
const spdx = z.object({
  spdxVersion: z.enum(["SPDX-2.2", "SPDX-2.3"]),
  SPDXID: z.literal("SPDXRef-DOCUMENT"),
  dataLicense: z.literal("CC0-1.0"),
  name: z.string().min(1),
  documentNamespace: z.string().url(),
  creationInfo: z.object({
    created: z.string().datetime({ offset: true }),
    creators: z.array(z.string()).min(1),
  }),
  packages: z
    .array(
      z.object({
        name: z.string().min(1),
        SPDXID: z.string().startsWith("SPDXRef-"),
      }),
    )
    .max(100000),
});

/** Metadata screening, not schema certification, component inventory or vulnerability analysis. */
export function parseSbom(source: string) {
  if (new TextEncoder().encode(source).length > SBOM_MAX_BYTES)
    throw new Error("sbom_size");
  const raw: unknown = JSON.parse(source);
  const cdx = cyclonedx.safeParse(raw);
  if (cdx.success) {
    const pending: unknown[] = [...cdx.data.components];
    let count = 0;
    while (pending.length) {
      const item = component.parse(pending.pop());
      if (++count > 100000) throw new Error("sbom_components");
      if (item.components !== undefined) {
        if (!Array.isArray(item.components)) throw new Error("sbom_components");
        for (const child of item.components) pending.push(child);
      }
    }
    const tools = cdx.data.metadata?.tools;
    const toolItems = Array.isArray(tools) ? tools : (tools?.components ?? []);
    return {
      format: "CycloneDX" as const,
      spec_version: cdx.data.specVersion,
      component_count: count,
      tool: toolItems
        .map((t) => t.name)
        .join(", ")
        .slice(0, 499),
      generated_at: cdx.data.metadata?.timestamp ?? null,
    };
  }
  const doc = spdx.parse(raw);
  const ids = doc.packages.map((p) => p.SPDXID);
  if (new Set(ids).size !== ids.length) throw new Error("sbom_duplicate");
  return {
    format: "SPDX" as const,
    spec_version: doc.spdxVersion,
    component_count: doc.packages.length,
    tool: doc.creationInfo.creators
      .filter((c) => c.startsWith("Tool:"))
      .map((c) => c.slice(5).trim())
      .join(", ")
      .slice(0, 499),
    generated_at: doc.creationInfo.created,
  };
}
