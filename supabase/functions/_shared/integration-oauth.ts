import { microsoftScopes, ProviderError } from "./integration-providers.ts";
import type { Provider } from "./integration-model.ts";
import { integrationCollectionsEnabled } from "./integration-release.ts";
import { GOOGLE_IDENTITY_SCOPES, GOOGLE_WORKSPACE_SCOPES } from "./google-workspace.ts";

export function oauthConfig(provider: Provider) {
  const callback = `${Deno.env.get("SUPABASE_URL")}/functions/v1/integration-connect`;
  if (provider === "google_workspace")
    return {
      clientId: Deno.env.get("GOOGLE_INTEGRATION_CLIENT_ID"),
      secret: Deno.env.get("GOOGLE_INTEGRATION_CLIENT_SECRET"),
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      scopes: [...GOOGLE_WORKSPACE_SCOPES, ...GOOGLE_IDENTITY_SCOPES],
      callback,
    };
  if (provider === "google_drive")
    return {
      clientId: Deno.env.get("GOOGLE_INTEGRATION_CLIENT_ID"),
      secret: Deno.env.get("GOOGLE_INTEGRATION_CLIENT_SECRET"),
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
      callback,
    };
  if (provider === "github")
    return {
      clientId: Deno.env.get("GITHUB_INTEGRATION_CLIENT_ID"),
      secret: Deno.env.get("GITHUB_INTEGRATION_CLIENT_SECRET"),
      authorization: "https://github.com/login/oauth/authorize",
      token: "https://github.com/login/oauth/access_token",
      // GitHub App permissions are declared on the app, never broad OAuth 'repo'.
      scopes: [],
      callback,
    };
  return {
    clientId: Deno.env.get("MICROSOFT_INTEGRATION_CLIENT_ID"),
    secret: Deno.env.get("MICROSOFT_INTEGRATION_CLIENT_SECRET"),
    authorization:
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
    scopes: ["offline_access", ...(microsoftScopes[provider] || [])],
    callback,
  };
}

export function providerReady(provider: Provider): boolean {
  if (!integrationCollectionsEnabled()) return false;
  if (provider === "aws")
    return [
      "AWS_INTEGRATION_ACCESS_KEY_ID",
      "AWS_INTEGRATION_SECRET_ACCESS_KEY",
      "AWS_INTEGRATION_PRINCIPAL_ARN",
    ].every((name) => !!Deno.env.get(name));
  const config = oauthConfig(provider);
  return (
    !!config.clientId &&
    !!config.secret &&
    (provider !== "github" ||
      /^[a-z0-9-]+$/.test(Deno.env.get("GITHUB_INTEGRATION_APP_SLUG") || ""))
  );
}
export async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
const base64url = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const randomSecret = () =>
  base64url(crypto.getRandomValues(new Uint8Array(32)));

export async function authorizationUrl(
  provider: Provider,
  state: string,
  verifier: string,
): Promise<string> {
  if (!providerReady(provider))
    throw new ProviderError("platform_setup_required");
  const config = oauthConfig(provider);
  if (provider === "microsoft") return microsoftAdminConsentUrl(config, state);
  const url = new URL(config.authorization);
  url.search = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.callback,
    response_type: "code",
    state,
    ...(config.scopes.length ? { scope: config.scopes.join(" ") } : {}),
    code_challenge_method: "S256",
    code_challenge: base64url(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      ),
    ),
    ...(provider === "google_drive" || provider === "google_workspace"
      ? {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        }
      : provider === "github"
        ? {}
        : { prompt: "select_account" }),
  }).toString();
  return url.href;
}

async function exchange(
  provider: Provider,
  parameters: Record<string, string>,
) {
  const config = oauthConfig(provider);
  if (!providerReady(provider))
    throw new ProviderError("platform_setup_required");
  const response = await fetch(config.token, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: config.clientId!,
      client_secret: config.secret!,
      ...parameters,
    }),
  });
  const token = await response.json();
  if (!response.ok || token.error || !token.access_token)
    throw new ProviderError(
      "authorization_expired",
      response.status === 429 || response.status >= 500,
    );
  return {
    access_token: token.access_token as string,
    refresh_token: token.refresh_token as string | undefined,
    expires_at: Date.now() + Number(token.expires_in || 28800) * 1000,
    ...(typeof token.scope === "string" ? { scope: token.scope as string } : {}),
  };
}
export function exchangeCode(
  provider: Provider,
  code: string,
  verifier: string,
) {
  return exchange(provider, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: oauthConfig(provider).callback,
  });
}
export async function connectionCredentials(
  db: any,
  connection: any,
): Promise<Record<string, any>> {
  if (connection.provider === "aws") return {};
  if (connection.provider === "microsoft")
    return microsoftAppToken(connection.settings?.tenant_id);
  const { data, error } = await db.rpc("integration_read_credentials", {
    p_id: connection.id,
    p_empresa: connection.empresa_id,
  });
  if (error || !data?.access_token)
    throw new ProviderError("authorization_required");
  if (data.expires_at > Date.now() + 120000) return data;
  if (!data.refresh_token) throw new ProviderError("authorization_expired");
  const refreshed = await exchange(connection.provider, {
    grant_type: "refresh_token",
    refresh_token: data.refresh_token,
  });
  const credentials = {
    ...data,
    ...refreshed,
    refresh_token: refreshed.refresh_token || data.refresh_token,
  };
  const saved = await db
    .from("integration_connections")
    .update({ credentials: JSON.stringify(credentials) })
    .eq("id", connection.id)
    .eq("empresa_id", connection.empresa_id);
  if (saved.error) throw new ProviderError("credential_save_failed");
  return credentials;
}

// Unified Microsoft: one multi-tenant app; the customer's admin consents once
// and Akuris reads with app-only tokens. No customer secret is ever stored.
export const TENANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function microsoftAdminConsentUrl(config: ReturnType<typeof oauthConfig>, state: string) {
  const url = new URL("https://login.microsoftonline.com/organizations/v2.0/adminconsent");
  url.search = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.callback,
    state,
    scope: "https://graph.microsoft.com/.default",
  }).toString();
  return url.href;
}
export async function microsoftAppToken(tenantId: unknown) {
  if (typeof tenantId !== "string" || !TENANT_ID.test(tenantId))
    throw new ProviderError("authorization_required");
  const config = oauthConfig("microsoft");
  if (!providerReady("microsoft")) throw new ProviderError("platform_setup_required");
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: config.clientId!,
        client_secret: config.secret!,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token)
    throw new ProviderError(
      response.status === 400 || response.status === 401 ? "consent_revoked" : "authorization_expired",
      response.status === 429 || response.status >= 500,
    );
  return { access_token: token.access_token as string };
}
