import { createClient } from "npm:@supabase/supabase-js@2";
import {
  requireUserContext,
  requireValidMfa,
  AuthError,
} from "../_shared/auth.ts";
import {
  PROVIDERS,
  type Provider,
  validRoleArn,
  evaluateResource,
} from "../_shared/integration-model.ts";
import {
  authorizationUrl,
  exchangeCode,
  providerReady,
  randomSecret,
  digest,
} from "../_shared/integration-oauth.ts";
import { ProviderError } from "../_shared/integration-providers.ts";
import { processIntegrationRun } from "../_shared/integration-runner.ts";
import { integrationReleaseResponse } from "../_shared/integration-release.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });
const columns =
  "id,empresa_id,provider,name,status,settings,frequency,scope_ids,last_success_at,next_run_at,error_code,created_at";
const db = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
const appUrl = () =>
  Deno.env.get("INTEGRATIONS_APP_URL") || "https://akuris.pt";
function checked(result: { error: any }) {
  if (result.error)
    throw new ProviderError(
      ["connection_busy", "authorization_required"].includes(
        result.error.message,
      )
        ? result.error.message
        : "storage_write_failed",
    );
}
async function schedulerReady(client: any) {
  const token = Deno.env.get("INTEGRATION_WORKER_TOKEN");
  if (!token || token.length < 32) return false;
  const result = await client.rpc("integration_scheduler_ready", {
    p_token_sha256: await digest(token),
  });
  return !result.error && result.data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const unavailable = integrationReleaseResponse(cors);
  if (unavailable) return unavailable;
  const url = new URL(req.url);
  // OAuth callback cannot require a Supabase JWT; state is short-lived,
  // unguessable, single-use, and bound to a previously checked admin/MFA session.
  if (req.method === "GET") {
    const state = url.searchParams.get("state");
    if (!state || state.length > 256)
      return json({ error: "invalid_oauth_state" }, 400);
    const client = db();
    const consumed = await client
      .from("integration_oauth_states")
      .delete()
      .eq("state_hash", await digest(state))
      .gt("expires_at", new Date().toISOString())
      .select("*")
      .maybeSingle();
    if (consumed.error || !consumed.data)
      return json({ error: "invalid_oauth_state" }, 400);
    const saved = consumed.data;
    const connection = await client
      .from("integration_connections")
      .select("*")
      .eq("id", saved.connection_id)
      .single();
    if (connection.error || !connection.data)
      return json({ error: "connection_missing" }, 400);
    const tenant = connection.data.empresa_id;
    const profile = await client
      .from("profiles")
      .select("role")
      .eq("user_id", saved.user_id)
      .eq("empresa_id", tenant)
      .eq("ativo", true)
      .maybeSingle();
    const mfa = await client
      .from("mfa_sessions")
      .select("id")
      .eq("user_id", saved.user_id)
      .eq("auth_session_id", saved.session_id)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (
      profile.error ||
      !["admin", "super_admin"].includes(profile.data?.role || "") ||
      mfa.error ||
      !mfa.data?.length
    )
      return json({ error: "authorization_required" }, 403);
    let result = "authorized";
    try {
      const code = url.searchParams.get("code");
      if (url.searchParams.has("error") || !code || code.length > 4096)
        throw new ProviderError("consent_denied");
      const credentials = await exchangeCode(
        connection.data.provider,
        code,
        saved.verifier,
      );
      const completed = await client
        .from("integration_connections")
        .update({
          credentials: JSON.stringify(credentials),
          status: "authorized",
          error_code: null,
        })
        .eq("id", saved.connection_id)
        .eq("empresa_id", tenant)
        .eq("updated_at", connection.data.updated_at)
        .select("id")
        .maybeSingle();
      checked(completed);
      if (!completed.data) throw new ProviderError("consent_superseded");
    } catch (error) {
      result =
        error instanceof ProviderError ? error.code : "authorization_failed";
      await client
        .from("integration_connections")
        .update({ status: "error", error_code: result })
        .eq("id", saved.connection_id)
        .eq("empresa_id", tenant)
        .eq("updated_at", connection.data.updated_at);
    }
    const target = new URL("/configuracoes", appUrl());
    target.search = new URLSearchParams({
      tab: "integracoes",
      connection: saved.connection_id,
      integration_result: result,
    }).toString();
    return new Response(null, {
      status: 303,
      headers: {
        Location: target.href,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const ctx = await requireUserContext(req);
    await requireValidMfa(ctx);
    if (!ctx.empresaId || !["admin", "super_admin"].includes(ctx.role || ""))
      throw new AuthError("Forbidden", 403);
    const client: any = ctx.supabase,
      empresa = ctx.empresaId;
    const bodyText = await req.text();
    if (bodyText.length > 1048576)
      return json({ error: "request_too_large" }, 413);
    const body = JSON.parse(bodyText),
      action = body.action;
    const limited = await client.rpc("consume_security_rate_limit", {
      p_scope: "integration-admin",
      p_fingerprint_hash: await digest(ctx.userId),
      p_window_seconds: 60,
      p_max_requests: 60,
    });
    if (limited.error) return json({ error: "service_unavailable" }, 503);
    if (limited.data !== true)
      return json({ error: "rate_limited" }, 429);
    if (action === "list") {
      const connections = await client
        .from("integration_connections")
        .select(columns)
        .eq("empresa_id", empresa)
        .order("created_at", { ascending: false });
      checked(connections);
      return json({
        connections: connections.data,
        availability: Object.fromEntries(
          PROVIDERS.map((id) => [id, providerReady(id)]),
        ),
        scheduler_ready: await schedulerReady(client),
      });
    }
    if (action === "start") {
      const provider = body.provider as Provider;
      if (!PROVIDERS.includes(provider))
        return json({ error: "invalid_provider" }, 400);
      if (!providerReady(provider))
        return json({ error: "platform_setup_required" }, 409);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 120)
        return json({ error: "invalid_name" }, 400);
      if (provider === "aws" && !/^\d{12}$/.test(body.account_id || ""))
        return json({ error: "invalid_aws_account" }, 400);
      let connection: any;
      if (body.connection_id) {
        const existing = await client
          .from("integration_connections")
          .select("*")
          .eq("id", body.connection_id)
          .eq("empresa_id", empresa)
          .eq("provider", provider)
          .single();
        checked(existing);
        connection = existing.data;
        // Prevent an existing worker from using a credential being replaced.
        checked(
          await client.rpc("integration_change_state", {
            p_id: connection.id,
            p_empresa: empresa,
            p_action: "pause",
          }),
        );
      } else {
        const settings =
          provider === "aws" ? { external_id: randomSecret() } : {};
        const created = await client
          .from("integration_connections")
          .insert({
            empresa_id: empresa,
            provider,
            name,
            created_by: ctx.userId,
            settings,
          })
          .select("id,settings")
          .single();
        checked(created);
        connection = created.data;
      }
      if (provider === "aws") {
        const roleName = `AkurisReadOnly-${connection.id.slice(0, 8)}`;
        const roleArn = `arn:aws:iam::${body.account_id}:role/${roleName}`;
        const settings = {
          ...connection.settings,
          role_arn: roleArn,
          region: "us-east-1",
        };
        checked(
          await client
            .from("integration_connections")
            .update({ settings, status: "pending" })
            .eq("id", connection.id)
            .eq("empresa_id", empresa),
        );
        const stack = new URL(
          "https://us-east-1.console.aws.amazon.com/cloudformation/home",
        );
        const params = new URLSearchParams({
          templateURL: new URL("/integrations/aws-read-only.json", appUrl())
            .href,
          stackName: roleName,
          param_RoleName: roleName,
          param_ExternalId: settings.external_id,
          param_TrustedPrincipal: Deno.env.get(
            "AWS_INTEGRATION_PRINCIPAL_ARN",
          )!,
        });
        stack.hash = `/stacks/create/review?${params}`;
        return json({
          connection_id: connection.id,
          authorize_url: stack.href,
          aws: true,
        });
      }
      const state = randomSecret(),
        verifier = randomSecret();
      checked(
        await client.from("integration_oauth_states").insert({
          state_hash: await digest(state),
          connection_id: connection.id,
          user_id: ctx.userId,
          session_id: ctx.sessionId,
          verifier,
        }),
      );
      return json({
        connection_id: connection.id,
        authorize_url: await authorizationUrl(provider, state, verifier),
        ...(provider === "github"
          ? {
              install_url: `https://github.com/apps/${Deno.env.get("GITHUB_INTEGRATION_APP_SLUG")}/installations/new`,
            }
          : {}),
      });
    }
    const found = await client
      .from("integration_connections")
      .select("*")
      .eq("id", body.connection_id)
      .eq("empresa_id", empresa)
      .single();
    if (found.error || !found.data)
      return json({ error: "connection_missing" }, 404);
    const connection = found.data;
    if (action === "download_evidence") {
      const run = await client
        .from("integration_runs")
        .select("id,evidence_id,status,attempt")
        .eq("id", body.run_id)
        .eq("connection_id", connection.id)
        .eq("empresa_id", empresa)
        .single();
      if (
        run.error ||
        !run.data?.evidence_id ||
        !["success", "partial"].includes(run.data.status)
      )
        return json({ error: "evidence_unavailable" }, 404);
      const signed = await client.storage
        .from("gap-evidence-library")
        .createSignedUrl(
          `${empresa}/integrations/${run.data.id}-${run.data.attempt}.json`,
          300,
          {
            download: true,
          },
        );
      checked(signed);
      return json({ url: signed.data.signedUrl });
    }
    if (action === "details") {
      const page =
        Number.isSafeInteger(body.page) && body.page >= 0
          ? Math.min(body.page, 10000)
          : 0;
      const resources = await client
        .from("integration_resources")
        .select(
          "id,external_id,name,kind,signals,source_url,collected_at,last_run_id",
          { count: "exact" },
        )
        .eq("empresa_id", empresa)
        .eq("connection_id", connection.id)
        .order("external_id")
        .range(page * 50, page * 50 + 49);
      checked(resources);
      const runs = await client
        .from("integration_runs")
        .select(
          "id,status,resource_count,error_code,evidence_id,created_at,finished_at",
        )
        .eq("empresa_id", empresa)
        .eq("connection_id", connection.id)
        .order("created_at", { ascending: false })
        .limit(20);
      checked(runs);
      return json({
        resources: resources.data.map((r: any) => ({
          ...r,
          checks: evaluateResource({
            externalId: r.external_id,
            kind: r.kind,
            name: r.name,
            signals: r.signals,
          }),
        })),
        count: resources.count,
        runs: runs.data,
      });
    }
    if (action === "configure") {
      if (
        !["manual", "daily", "weekly"].includes(body.frequency) ||
        !Array.isArray(body.scope_ids) ||
        body.scope_ids.length > 10000 ||
        body.scope_ids.some(
          (id: any) => typeof id !== "string" || id.length > 1024,
        )
      )
        return json({ error: "invalid_configuration" }, 400);
      if (body.frequency !== "manual" && !(await schedulerReady(client)))
        return json({ error: "scheduler_setup_required" }, 409);
      checked(
        await client.rpc("integration_configure", {
          p_id: connection.id,
          p_empresa: empresa,
          p_frequency: body.frequency,
          p_scope: [...new Set(body.scope_ids)],
          p_system: body.system_id || null,
          p_region: body.region || connection.settings.region || "us-east-1",
        }),
      );
      return json({ success: true });
    }
    if (["pause", "resume", "disconnect"].includes(action)) {
      checked(
        await client.rpc("integration_change_state", {
          p_id: connection.id,
          p_empresa: empresa,
          p_action: action,
        }),
      );
      return json({ success: true });
    }
    if (action === "collect") {
      if (
        connection.provider === "aws" &&
        connection.status === "pending" &&
        validRoleArn(connection.settings.role_arn || "")
      ) {
        checked(
          await client
            .from("integration_connections")
            .update({ status: "authorized" })
            .eq("id", connection.id)
            .eq("empresa_id", empresa),
        );
      }
      const run = await client.rpc("integration_enqueue", {
        p_id: connection.id,
        p_empresa: empresa,
      });
      checked(run);
      const work = processIntegrationRun(client, run.data, {
        allowRetry: await schedulerReady(client),
      });
      const runtime = (
        globalThis as unknown as {
          EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
        }
      ).EdgeRuntime;
      if (runtime) runtime.waitUntil(work);
      else await work;
      return json({ run_id: run.data }, 202);
    }
    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    return json(
      {
        error:
          error instanceof AuthError
            ? "authorization_required"
            : error instanceof ProviderError
              ? error.code
              : "request_failed",
      },
      error instanceof AuthError ? error.status : 400,
    );
  }
});
