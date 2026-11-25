import { collectProvider, ProviderError } from "./integration-providers.ts";
import { connectionCredentials, digest } from "./integration-oauth.ts";
import { integrationCollectionsEnabled } from "./integration-release.ts";
import {
  evaluateResource,
  inScope,
  retryDelay,
  identityImportRow,
} from "./integration-model.ts";
import { ativoDoIntune, serialConfiavel } from "./intune-ativos.ts";
import { ativoDoGoogle, googleSelected } from "./google-workspace.ts";

// Intune devices feed Gestão de Ativos (discovery, not evidence scope).
// Match by Intune id first, then by a trustworthy serial (e.g. MeshCentral asset).
export async function syncIntuneAtivos(db: any, empresaId: string, resources: any[], connectionId: string, tick: () => Promise<void> = async () => {}) {
  const rows = resources.map(ativoDoIntune).filter(Boolean) as any[];
  let novos = 0;
  const cols = "id,atributos,tags,mesh_node_id,google_device_id";
  for (const a of rows) {
    await tick();
    let atual = must(await db.from("ativos").select(cols)
      .eq("empresa_id", empresaId).eq("intune_device_id", a.intune_device_id).maybeSingle()).data;
    let ambiguo = false;
    const serial = serialConfiavel(a.atributos.numero_serie);
    if (!atual && serial) {
      // Link by serial only when exactly one asset matches.
      const cand = must(await db.from("ativos").select(cols)
        .eq("empresa_id", empresaId).is("intune_device_id", null)
        .eq("atributos->>numero_serie", serial).limit(2)).data || [];
      if (cand.length === 1) atual = cand[0];
      else ambiguo = cand.length > 1;
    }
    if (atual) {
      const prev = atual.atributos ?? {};
      const own = (atual.tags ?? []).includes("descoberto-intune") && !atual.mesh_node_id && !atual.google_device_id;
      const next: Record<string, unknown> = { ...prev, intune_nao_visto: false };
      for (const [k, v] of Object.entries(a.atributos)) {
        if (v == null) continue;
        if (own || prev[k] == null || k.startsWith("intune_")) next[k] = v;
      }
      must(await db.from("ativos").update({
        intune_device_id: a.intune_device_id,
        integration_connection_id: connectionId,
        ...(own ? { versao: a.versao } : {}),
        atributos: next,
      }).eq("id", atual.id).eq("empresa_id", empresaId));
    } else {
      must(await db.from("ativos").insert({
        ...a, atributos: { ...a.atributos, ...(ambiguo ? { intune_serial_ambiguo: true } : {}) },
        empresa_id: empresaId, integration_connection_id: connectionId, status: "pendente", tags: ["descoberto-intune"],
      }));
      novos++;
    }
  }
  // Devices no longer in Intune are flagged, never deleted.
  const vistos = new Set(rows.map((a) => a.intune_device_id));
  const { data: existentes } = must(await db.from("ativos").select("id,intune_device_id,atributos")
    .eq("empresa_id", empresaId).not("intune_device_id", "is", null));
  for (const e of existentes || []) {
    if (!vistos.has(e.intune_device_id) && !e.atributos?.intune_nao_visto)
      must(await db.from("ativos").update({ atributos: { ...(e.atributos ?? {}), intune_nao_visto: true } })
        .eq("id", e.id).eq("empresa_id", empresaId));
  }
  if (novos) {
    const { data: admins } = await db.from("profiles").select("user_id")
      .eq("empresa_id", empresaId).in("role", ["admin", "super_admin"]).eq("ativo", true);
    if (admins?.length)
      await db.from("notifications").insert(admins.map((p: any) => ({
        user_id: p.user_id,
        title: "Novos ativos do Intune",
        message: `${novos} dispositivo(s) do Microsoft Intune entraram na Gestão de Ativos.`,
        type: "info",
        link_to: "/ativos",
      })));
  }
}

// Google devices: match by Google id, then by a serial that matches exactly ONE asset not yet
// linked to Google. Assets the integration created get Google-managed fields refreshed;
// MeshCentral/Intune/manual assets only get empty fields filled. DB errors abort the run.
const GOOGLE_MANAGED = ["numero_serie", "sistema_operacional", "modelo", "fabricante", "usuario", "google_origem", "google_ultimo_sync", "google_estado"];
function must<T extends { error?: any }>(r: T): T {
  if (r?.error) throw new ProviderError("storage_write_failed");
  return r;
}
export async function syncGoogleAtivos(db: any, empresaId: string, resources: any[], connectionId: string, tick: () => Promise<void> = async () => {}) {
  const rows = resources.map(ativoDoGoogle).filter(Boolean) as any[];
  let novos = 0;
  const cols = "id,atributos,tags,mesh_node_id,intune_device_id,google_connection_id";
  for (const a of rows) {
    await tick();
    let atual = must(await db.from("ativos").select(cols)
      .eq("empresa_id", empresaId).eq("google_device_id", a.google_device_id).maybeSingle()).data;
    let ambiguo = false;
    const serial = serialConfiavel(a.atributos.numero_serie);
    if (!atual && serial) {
      const cand = must(await db.from("ativos").select(cols)
        .eq("empresa_id", empresaId).is("google_device_id", null)
        .eq("atributos->>numero_serie", serial).limit(2)).data || [];
      if (cand.length === 1) atual = cand[0];
      else ambiguo = cand.length > 1;
    }
    if (atual) {
      const prev = atual.atributos ?? {};
      const own = (atual.tags ?? []).includes("descoberto-google") && !atual.mesh_node_id && !atual.intune_device_id;
      const next = { ...prev, google_nao_visto: false } as Record<string, unknown>;
      for (const k of GOOGLE_MANAGED) {
        const v = (a.atributos as any)[k];
        if (v == null) continue;
        if (own || prev[k] == null || k.startsWith("google_")) next[k] = v;
      }
      must(await db.from("ativos").update({
        google_device_id: a.google_device_id, google_connection_id: connectionId, atributos: next,
        ...(own ? { nome: a.nome, versao: a.versao } : {}),
      }).eq("id", atual.id).eq("empresa_id", empresaId));
    } else {
      must(await db.from("ativos").insert({
        ...a, atributos: { ...a.atributos, ...(ambiguo ? { google_serial_ambiguo: true } : {}) },
        empresa_id: empresaId, google_connection_id: connectionId, status: "pendente", tags: ["descoberto-google"],
      }));
      novos++;
    }
  }
  if (novos) {
    const { data: admins } = await db.from("profiles").select("user_id")
      .eq("empresa_id", empresaId).in("role", ["admin", "super_admin"]).eq("ativo", true);
    if (admins?.length)
      await db.from("notifications").insert(admins.map((p: any) => ({
        user_id: p.user_id, title: "Novos ativos do Google Workspace",
        message: `${novos} dispositivo(s) do Google Workspace entraram na Gestão de Ativos.`,
        type: "info", link_to: "/ativos",
      })));
  }
  return novos;
}

/** Measured import progress: done never exceeds total; written every `every` steps and at the end. */
export function createProgress(write: (done: number, total: number) => Promise<unknown>, total: number, every = 10) {
  let done = 0;
  return {
    total,
    async add(n = 1) {
      const before = done;
      done = Math.min(total, done + n);
      if (done === before) return;
      if (done === total || Math.floor(done / every) > Math.floor(before / every)) await write(done, total);
    },
    finish: () => write(total, total),
  };
}

function checked(result: { error?: any }) {
  if (result.error) throw new ProviderError("storage_write_failed");
}

export async function processIntegrationRun(
  db: any,
  runId: string | null = null,
  options: { allowRetry?: boolean } = {},
) {
  if (!integrationCollectionsEnabled()) return;
  const claim = await db.rpc("integration_claim", { p_run: runId });
  checked(claim);
  const run = claim.data?.[0];
  if (!run) return;
  const connectionResult = await db
    .from("integration_connections")
    .select("*")
    .eq("id", run.connection_id)
    .eq("empresa_id", run.empresa_id)
    .single();
  checked(connectionResult);
  const connection = connectionResult.data;
  try {
    const credentials = await connectionCredentials(db, connection);
    if (connection.provider === "google_workspace") {
      // Optional delegated credential for Cloud Identity computers, read server-side only.
      const d = await db.rpc("integration_read_delegated", { p_connection: connection.id, p_empresa: run.empresa_id });
      credentials.cloud_identity = d.error ? null : d.data;
    }
    const collection = await collectProvider(connection.provider, credentials, {
      ...connection.settings,
      scope_ids: connection.scope_ids,
    });
    const collectedAt = new Date().toISOString();
    let selected = inScope(collection.resources, connection.scope_ids || []);
    if (selected.length < new Set(connection.scope_ids || []).size)
      collection.warnings.push("scope_unavailable");
    const googleImported: string[] = connection.settings.imported_modules ?? [];
    if (connection.provider === "google_workspace") {
      // Module data only after the user imported it; per-module status stays visible.
      selected = googleSelected(collection.resources, connection.settings);
      const moduleStatus: Record<string, string> = {};
      for (const w of collection.warnings) {
        const m = /^module:([a-z]+):(.+)$/.exec(w);
        if (m && !moduleStatus[m[1]]) moduleStatus[m[1]] = m[2];
      }
      await db.from("integration_connections")
        .update({ settings: { ...connection.settings, module_status: moduleStatus, module_status_at: new Date().toISOString(),
          ...(collection.cloudIdentity ? { cloud_identity: collection.cloudIdentity } : {}) } })
        .eq("id", connection.id).eq("empresa_id", run.empresa_id);
      if (collection.cloudIdentity && collection.cloudIdentity.status !== "not_configured") {
        await db.from("integration_delegated_credentials")
          .update({ status: collection.cloudIdentity.status, error_code: collection.cloudIdentity.error ?? null, last_used_at: new Date().toISOString() })
          .eq("connection_id", connection.id).eq("empresa_id", run.empresa_id);
      }
    }
    const intuneSync = connection.provider === "intune" ||
      (connection.provider === "microsoft" &&
        (connection.settings.modules ?? ["intune"]).includes("intune") &&
        (connection.settings.imported_modules ?? []).includes("intune"));
    const googleSync = connection.provider === "google_workspace" && googleImported.includes("dispositivos");
    const deviceCount = intuneSync || googleSync ? collection.resources.filter((r) => r.kind === "device").length : 0;
    const writeProgress = (done: number, total: number) =>
      db.from("integration_runs").update({ progress_done: done, progress_total: total })
        .eq("id", run.id).eq("empresa_id", run.empresa_id);
    const progress = createProgress(writeProgress, collection.resources.length + deviceCount);
    await writeProgress(0, progress.total);
    // Discovery is visible in settings; only explicitly scoped observations
    // become evidence. No collection can change conformity_status.
    for (let offset = 0; offset < collection.resources.length; offset += 200) {
      const batch = collection.resources.slice(offset, offset + 200);
      const saved = await db
        .from("integration_resources")
        .upsert(
          batch.map((resource) => ({
            connection_id: connection.id,
            empresa_id: run.empresa_id,
            external_id: resource.externalId,
            kind: resource.kind,
            name: resource.name,
            source_url: resource.url || null,
            signals: resource.signals,
            collected_at: collectedAt,
            last_run_id: run.id,
          })),
          { onConflict: "connection_id,external_id" },
        )
        .select("id,external_id");
      checked(saved);
      const ids = new Map(
        saved.data.map((row: any) => [row.external_id, row.id]),
      );
      checked(
        await db.from("integration_observations").upsert(
          batch.map((resource) => ({
            run_id: run.id,
            empresa_id: run.empresa_id,
            resource_id: ids.get(resource.externalId),
            signals: resource.signals,
            checks: evaluateResource(resource),
            rule_version: "1",
          })),
          { onConflict: "run_id,resource_id" },
        ),
      );
      await progress.add(batch.length);
    }
    if (
      connection.provider === "intune" ||
      (connection.provider === "microsoft" &&
        (connection.settings.modules ?? ["intune"]).includes("intune") &&
        // Data reaches the module only after the user clicks "import" there.
        (connection.settings.imported_modules ?? []).includes("intune"))
    ) {
      const devices = collection.resources.filter((r) => r.kind === "device");
      if (devices.length) await syncIntuneAtivos(db, run.empresa_id, devices, connection.id, () => progress.add());
    }
    if (connection.provider === "google_workspace" && googleImported.includes("dispositivos")) {
      const devices = collection.resources.filter((r) => r.kind === "device");
      if (devices.length) await syncGoogleAtivos(db, run.empresa_id, devices, connection.id, () => progress.add());
    }
    // Imported accounts feed the existing access review, in the chosen system.
    // Do not revoke disappeared accounts on a partial or filtered collection.
    if (connection.settings.system_id) {
      const identities = selected.filter((item) => item.kind === "identity" && item.signals.type !== "group");
      const rows = identities
        .map((item) => identityImportRow(item, connection.id))
        .filter(Boolean);
      if (rows.length < identities.length)
        collection.warnings.push("roles_permission_missing");
      if (rows.length)
        checked(
          await db.rpc("integration_import_accounts", {
            p_run: run.id,
            p_attempt: run.attempt,
            p_rows: rows,
          }),
        );
    }
    let evidence: Record<string, unknown> | null = null;
    if (selected.length) {
      const snapshot = JSON.stringify(
        {
          provider: connection.provider,
          connection: connection.name,
          collected_at: collectedAt,
          rule_version: "1",
          warnings: collection.warnings,
          scope: connection.scope_ids,
          resources: selected.map((resource) => ({
            ...resource,
            checks: evaluateResource(resource),
          })),
        },
        null,
        2,
      );
      const path = `${run.empresa_id}/integrations/${run.id}-${run.attempt}.json`;
      checked(
        await db.storage
          .from("gap-evidence-library")
          .upload(path, new TextEncoder().encode(snapshot), {
            contentType: "application/json",
            upsert: true,
          }),
      );
      // Publish the library entry together with the final result, under the
      // attempt's lease. A failed/retried run must not expose stale evidence.
      evidence = {
        hash: await digest(snapshot),
        size: new TextEncoder().encode(snapshot).length,
      };
    }
    await progress.finish();
    const partial = collection.warnings.length > 0;
    checked(
      await db.rpc("integration_finish_run", {
        p_run: run.id,
        p_attempt: run.attempt,
        p_status: partial ? "partial" : "success",
        p_count: collection.resources.length,
        p_error: collection.warnings[0] || null,
        p_evidence: evidence,
      }),
    );
  } catch (error) {
    const failure =
      error instanceof ProviderError
        ? error
        : new ProviderError("collection_failed", true);
    const retry =
      options.allowRetry !== false && failure.retryable && run.attempt < 4;
    checked(
      await db.rpc("integration_finish_run", {
        p_run: run.id,
        p_attempt: run.attempt,
        p_status: retry ? "queued" : "error",
        p_count: 0,
        p_error: failure.code,
        p_retry_at: new Date(
          Date.now() + retryDelay(run.attempt, failure.retryAfter) * 1000,
        ).toISOString(),
      }),
    );
  }
}
