import { collectProvider, ProviderError } from "./integration-providers.ts";
import { connectionCredentials, digest } from "./integration-oauth.ts";
import { integrationCollectionsEnabled } from "./integration-release.ts";
import {
  evaluateResource,
  inScope,
  retryDelay,
  identityImportRow,
} from "./integration-model.ts";

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
    const collection = await collectProvider(connection.provider, credentials, {
      ...connection.settings,
      scope_ids: connection.scope_ids,
    });
    const collectedAt = new Date().toISOString();
    const selected = inScope(collection.resources, connection.scope_ids || []);
    if (selected.length < new Set(connection.scope_ids || []).size)
      collection.warnings.push("scope_unavailable");
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
    }
    // Imported accounts feed the existing access review, in the chosen system.
    // Do not revoke disappeared accounts on a partial or filtered collection.
    if (connection.settings.system_id) {
      const identities = selected.filter((item) => item.kind === "identity");
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
