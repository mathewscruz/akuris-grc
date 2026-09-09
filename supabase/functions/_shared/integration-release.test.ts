import { integrationCollectionsEnabled, integrationReleaseResponse } from "./integration-release.ts";
import { providerReady } from "./integration-oauth.ts";
import { PROVIDERS } from "./integration-model.ts";
import { processIntegrationRun } from "./integration-runner.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("release hold is fail-closed even with provider credentials and cannot claim work", async () => {
  const vars = {
    INTEGRATION_COLLECTIONS_ENABLED: "false",
    GOOGLE_INTEGRATION_CLIENT_ID: "test-client",
    GOOGLE_INTEGRATION_CLIENT_SECRET: "test-secret",
    GITHUB_INTEGRATION_CLIENT_ID: "test-client",
    GITHUB_INTEGRATION_CLIENT_SECRET: "test-secret",
    GITHUB_INTEGRATION_APP_SLUG: "test-app",
    MICROSOFT_INTEGRATION_CLIENT_ID: "test-client",
    MICROSOFT_INTEGRATION_CLIENT_SECRET: "test-secret",
    AWS_INTEGRATION_ACCESS_KEY_ID: "test-key",
    AWS_INTEGRATION_SECRET_ACCESS_KEY: "test-secret",
    AWS_INTEGRATION_PRINCIPAL_ARN: "arn:aws:iam::123456789012:user/test",
  };
  const previous = Object.fromEntries(Object.keys(vars).map(key => [key, Deno.env.get(key)]));
  try {
    for (const [key, value] of Object.entries(vars)) Deno.env.set(key, value);
    for (const value of [undefined, "false", "TRUE", "1", ""]) {
      if (value === undefined) Deno.env.delete("INTEGRATION_COLLECTIONS_ENABLED");
      else Deno.env.set("INTEGRATION_COLLECTIONS_ENABLED", value);
      assert(!integrationCollectionsEnabled(), "Release must require explicit activation");
      assert(PROVIDERS.every(provider => !providerReady(provider)), "Credentials cannot activate a provider");
      const response = integrationReleaseResponse({ "Access-Control-Allow-Origin": "*" });
      assert(response?.status === 503, "Connections and OAuth callbacks must be unavailable");
      assert(response?.headers.get("Cache-Control") === "no-store", "Do not cache release state");
      assert(response?.headers.get("Access-Control-Allow-Origin") === "*", "Preserve CORS");
      assert((await response!.json()).error === "integrations_coming_soon", "Return an explicit unavailable state");
      await processIntegrationRun({ rpc() { throw new Error("Must not access the database"); } });
    }
    Deno.env.set("INTEGRATION_COLLECTIONS_ENABLED", "true");
    assert(integrationReleaseResponse() === null, "Explicit future activation must work");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
