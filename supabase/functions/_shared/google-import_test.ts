import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { collectGoogleWorkspace, googleSelected, MEMBERS_LIST_LIMIT } from "./google-workspace.ts";
import { syncGoogleAtivos } from "./integration-runner.ts";
import { connectionCredentials } from "./integration-oauth.ts";

const doc = { externalId: "file:1", kind: "document", name: "a", signals: {} } as any;
const user = { externalId: "user:u1", kind: "identity", name: "u", signals: {} } as any;

Deno.test("connected but not imported: nothing reaches modules", () => {
  assertEquals(googleSelected([doc, user], { imported_modules: [] }).length, 0);
});
Deno.test("first click with empty scope imports the whole module ('all')", () => {
  const r = googleSelected([doc, user], { imported_modules: ["drive"], module_scope: { drive: "all" } });
  assertEquals(r.map((x) => x.externalId), ["file:1"]);
});
Deno.test("explicit selection limits the module", () => {
  const r = googleSelected([doc, { ...doc, externalId: "file:2" }], { imported_modules: ["drive"], module_scope: { drive: ["file:2"] } });
  assertEquals(r.map((x) => x.externalId), ["file:2"]);
});
Deno.test("Drive incompleteSearch is flagged as partial", async () => {
  const read = async () => ({ files: [{ id: "f", name: "x" }], incompleteSearch: true });
  const r = await collectGoogleWorkspace(read as any, "t", "C01", ["drive"]);
  assert(r.warnings.includes("module:drive:incomplete_search"));
  assertEquals(r.resources.length, 1);
});
Deno.test("Drive paging beyond the limit is flagged, not presented as complete", async () => {
  const read = async () => ({ files: [{ id: "f" }], nextPageToken: "n" });
  const r = await collectGoogleWorkspace(read as any, "t", "C01", ["drive"]);
  assert(r.warnings.includes("module:drive:collection_limit"));
});
Deno.test("group members: truncated list is flagged and the count stays correct", async () => {
  const many = Array.from({ length: MEMBERS_LIST_LIMIT + 5 }, (_, i) => ({ email: `m${i}@x` }));
  const read = async (url: string) => {
    if (url.includes("/members")) return { members: many };
    if (url.includes("/groups")) return { groups: [{ id: "g", email: "g@x", directMembersCount: "505" }] };
    if (url.includes("/users")) return { users: [] };
    return { items: [] };
  };
  const r = await collectGoogleWorkspace(read as any, "t", "C01", ["usuarios"]);
  const g = r.resources.find((x) => x.externalId === "group:g")!;
  assertEquals(g.signals.members_count, MEMBERS_LIST_LIMIT + 5);
  assertEquals(g.signals.members_partial, true);
  assert(r.warnings.includes("module:usuarios:members_list_limit"));
});
Deno.test("group members partial (paging) uses Google's count and flags members_partial", async () => {
  const read = async (url: string) => {
    if (url.includes("/members")) return { members: [{ email: "a@x" }], nextPageToken: "n" };
    if (url.includes("/groups")) return { groups: [{ id: "g", directMembersCount: "9000" }] };
    if (url.includes("/users")) return { users: [] };
    return { items: [] };
  };
  const r = await collectGoogleWorkspace(read as any, "t", "C01", ["usuarios"]);
  const g = r.resources.find((x) => x.externalId === "group:g")!;
  assertEquals(g.signals.members_count, 9000);
  assertEquals(g.signals.members, null);
  assert(r.warnings.includes("module:usuarios:members_partial"));
});

// ---- fake DB for asset sync -------------------------------------------------
type Row = Record<string, any>;
function fakeDb(rows: Row[], fail: "select" | "update" | "insert" | null = null) {
  const calls: { op: string; filters: Row }[] = [];
  const table = () => {
    const q: any = { op: "select", filters: {} as Row, payload: null, lim: 1000 };
    const run = () => {
      calls.push({ op: q.op, filters: { ...q.filters } });
      if (fail === q.op) return { data: null, error: { message: "boom" } };
      const match = rows.filter((r) => Object.entries(q.filters).every(([k, v]) =>
        k === "atributos->>numero_serie" ? r.atributos?.numero_serie === v : (v === null ? r[k] == null : r[k] === v)));
      if (q.op === "update") { match.forEach((r) => Object.assign(r, q.payload)); return { data: null, error: null }; }
      if (q.op === "insert") { rows.push({ id: crypto.randomUUID(), ...q.payload }); return { data: null, error: null }; }
      return { data: match.slice(0, q.lim), error: null };
    };
    Object.assign(q, {
      select() { return q; },
      eq(k: string, v: unknown) { q.filters[k] = v; return q; },
      is(k: string, v: unknown) { q.filters[k] = v; return q; },
      in() { return q; },
      limit(n: number) { q.lim = n; return q; },
      update(p: Row) { q.op = "update"; q.payload = p; return q; },
      insert(p: Row) { q.op = "insert"; q.payload = p; return q; },
      maybeSingle() { const r = run(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null }); },
      then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
    });
    return q;
  };
  return { db: { from: (t: string) => (t === "profiles" ? { select: () => ({ eq: () => ({ in: () => ({ eq: async () => ({ data: [] }) }) }) }) } : table()) }, rows, calls };
}
const dev = (id: string, serial: string | null, model = "Pixel") =>
  ({ externalId: `device:google:mobile:${id}`, kind: "device", name: id, signals: { serial_number: serial, model, os: "Android 15", google_kind: "mobile" } });

Deno.test("serial matching links only on a unique match", async () => {
  const { db, rows } = fakeDb([
    { id: "a", empresa_id: "E", atributos: { numero_serie: "SN12345" }, google_device_id: null },
    { id: "b", empresa_id: "E", atributos: { numero_serie: "SN12345" }, google_device_id: null },
  ]);
  await syncGoogleAtivos(db, "E", [dev("d1", "SN12345")], "C");
  assertEquals(rows.filter((r) => r.google_device_id).length, 1);
  const created = rows.find((r) => r.google_device_id === "mobile:d1")!;
  assert(!["a", "b"].includes(created.id));
  assertEquals(created.atributos.google_serial_ambiguo, true);
});
Deno.test("multi-provider asset keeps manual/MeshCentral fields; only empty ones are filled", async () => {
  const { db, rows } = fakeDb([
    { id: "m", empresa_id: "E", mesh_node_id: "node1", nome: "PC-Manual", tags: [], google_device_id: null,
      atributos: { numero_serie: "SN99999", modelo: "Dell manual" } },
  ]);
  await syncGoogleAtivos(db, "E", [dev("d2", "SN99999", "Pixel 9")], "C");
  assertEquals(rows[0].nome, "PC-Manual");
  assertEquals(rows[0].atributos.modelo, "Dell manual");
  assertEquals(rows[0].atributos.sistema_operacional, "Android 15");
  assertEquals(rows[0].google_device_id, "mobile:d2");
});
Deno.test("assets created by the integration get Google-managed fields refreshed", async () => {
  const { db, rows } = fakeDb([
    { id: "g", empresa_id: "E", tags: ["descoberto-google"], google_device_id: "mobile:d3", nome: "old",
      atributos: { modelo: "Pixel 7", numero_serie: null } },
  ]);
  await syncGoogleAtivos(db, "E", [dev("d3", null, "Pixel 9")], "C");
  assertEquals(rows[0].atributos.modelo, "Pixel 9");
  assertEquals(rows[0].nome, "d3");
});
Deno.test("company isolation: never matches another company's asset", async () => {
  const { db, rows } = fakeDb([{ id: "x", empresa_id: "OTHER", atributos: { numero_serie: "SN55555" }, google_device_id: null }]);
  await syncGoogleAtivos(db, "E", [dev("d4", "SN55555")], "C");
  assertEquals(rows.find((r) => r.id === "x")!.google_device_id, null);
  assertEquals(rows.find((r) => r.google_device_id === "mobile:d4")!.empresa_id, "E");
});
for (const op of ["select", "update", "insert"] as const) {
  Deno.test(`DB ${op} error aborts the sync instead of reporting success`, async () => {
    const { db } = fakeDb(op === "update" ? [{ id: "g", empresa_id: "E", google_device_id: "mobile:d5", tags: [], atributos: {} }] : [], op);
    await assertRejects(() => syncGoogleAtivos(db, "E", [dev("d5", null)], "C"));
  });
}

Deno.test("expired token is refreshed and saved, keeping the refresh token", async () => {
  Deno.env.set("GOOGLE_INTEGRATION_CLIENT_ID", "id-test");
  Deno.env.set("GOOGLE_INTEGRATION_CLIENT_SECRET", "secret-test");
  Deno.env.set("INTEGRATION_COLLECTIONS_ENABLED", "true");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ access_token: "new", expires_in: 3600 }), { status: 200 })) as any;
  let saved: any = null;
  const db = {
    rpc: async () => ({ data: { access_token: "old", refresh_token: "r1", expires_at: Date.now() - 1 }, error: null }),
    from: () => ({ update: (p: any) => { saved = JSON.parse(p.credentials); return { eq: () => ({ eq: async () => ({ error: null }) }) }; } }),
  };
  try {
    const c = await connectionCredentials(db, { id: "c", empresa_id: "E", provider: "google_workspace" });
    assertEquals(c.access_token, "new");
    assertEquals(saved.refresh_token, "r1");
  } finally { globalThis.fetch = realFetch; }
});

Deno.test("Intune: Google/MeshCentral asset keeps its fields; ambiguous serial never links", async () => {
  const { syncIntuneAtivos } = await import("./integration-runner.ts");
  const { db, rows } = fakeDb([
    { id: "g", empresa_id: "E", google_device_id: "mobile:x", tags: ["descoberto-google"], intune_device_id: null,
      atributos: { numero_serie: "SN77777", modelo: "Pixel 9" } },
    { id: "a", empresa_id: "E", intune_device_id: null, atributos: { numero_serie: "SN88888" } },
    { id: "b", empresa_id: "E", intune_device_id: null, atributos: { numero_serie: "SN88888" } },
  ]);
  (db as any).from = ((orig) => (t: string) => { const q = orig(t); if (t === "ativos") q.not = () => q; return q; })((db as any).from);
  await syncIntuneAtivos(db, "E", [
    { externalId: "device:intune:i1", kind: "device", name: "PC", signals: { serial_number: "SN77777", model: "Surface" } },
    { externalId: "device:intune:i2", kind: "device", name: "PC2", signals: { serial_number: "SN88888", model: "Surface" } },
  ], "C");
  const g = rows.find((r) => r.id === "g")!;
  assertEquals(g.atributos.modelo, "Pixel 9");
  assert(g.intune_device_id);
  assertEquals(rows.find((r) => r.id === "a")!.intune_device_id, null);
  assertEquals(rows.find((r) => r.id === "b")!.intune_device_id, null);
});
