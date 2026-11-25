import { describe, it, expect } from "vitest";
import { importOutcome } from "@/lib/integration-platform";

describe("module import badge outcome", () => {
  it("shows success only for a confirmed success run", () => {
    expect(importOutcome("success")).toBe("success");
  });
  it("partial runs get their own notice, never the success check", () => {
    expect(importOutcome("partial")).toBe("partial");
  });
  it("error, cancelled or vanished runs are never success", () => {
    expect(importOutcome("error")).toBe("error");
    expect(importOutcome("cancelled")).toBe("error");
    expect(importOutcome(null)).toBe("error");
  });
});
