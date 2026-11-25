import { describe, expect, it } from "vitest";
import { importProgressPct } from "@/lib/integration-platform";

describe("import progress", () => {
  it("shows 0% while the total is still unknown", () => {
    expect(importProgressPct(null, null)).toBe(0);
    expect(importProgressPct(5, 0)).toBe(0);
  });
  it("is the measured share of items written", () => {
    expect(importProgressPct(42, 100)).toBe(42);
    expect(importProgressPct(1, 3)).toBe(33);
  });
  it("never passes 100%", () => {
    expect(importProgressPct(120, 100)).toBe(100);
  });
});
