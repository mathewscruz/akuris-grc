import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createProgress } from "./integration-runner.ts";

Deno.test("progress reaches total and never exceeds it", async () => {
  const writes: [number, number][] = [];
  const p = createProgress(async (d, t) => { writes.push([d, t]); }, 25);
  for (let i = 0; i < 30; i++) await p.add();
  assertEquals(writes.at(-1), [25, 25]);
  assert(writes.every(([d, t]) => d <= t));
  assertEquals(writes.map((w) => w[0]), [10, 20, 25]);
});
function assert(c: boolean) { if (!c) throw new Error("assert"); }
