import {
  evaluateResource,
  identityImportRow,
  inScope,
  retryDelay,
  validRoleArn,
  type CollectedResource,
} from "./integration-model.ts";
import {
  collectProvider,
  providerJson,
  ProviderError,
} from "./integration-providers.ts";
import {
  authorizationUrl,
  exchangeCode,
  randomSecret,
  digest,
} from "./integration-oauth.ts";
const assert = (condition: unknown, message = "Assertion failed") => {
  if (!condition) throw new Error(message);
};
const eq = (a: unknown, b: unknown) =>
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    `${JSON.stringify(a)} != ${JSON.stringify(b)}`,
  );
const resource = (
  kind: CollectedResource["kind"],
  signals: CollectedResource["signals"],
): CollectedResource => ({
  externalId: "user:u1",
  name: "User",
  kind,
  signals,
});
const reply = (body: unknown, status = 200) => Response.json(body, { status });
async function mockFetch(fn: typeof fetch, work: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    await work();
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test(
  "unknown signals cannot become passing controls or ordinary-user imports",
  () => {
    eq(evaluateResource(resource("identity", { mfa_registered: null })), [
      { key: "mfa_registered", status: "unknown" },
    ]);
    eq(evaluateResource(resource("device", { compliance: "inGracePeriod" })), [
      { key: "device_compliant", status: "unknown" },
    ]);
    assert(
      identityImportRow(resource("identity", { privileged: null }), "c1") ===
        null,
    );
    assert(
      identityImportRow(
        resource("identity", { privileged: true, enabled: false }),
        "c1",
      )?.ativo === false,
    );
    eq(inScope([resource("identity", {})], []), []);
    eq(inScope([resource("identity", {})], ["user:u1"]).length, 1);
  },
);
Deno.test("retry backoff and AWS role identifiers are bounded", () => {
  eq(retryDelay(1), 30);
  eq(retryDelay(4, "200"), 240);
  eq(retryDelay(9, "900000"), 3600);
  assert(
    validRoleArn("arn:aws:iam::123456789012:role/AkurisReadOnly-ab123456"),
  );
  assert(!validRoleArn("https://example.org/role/a"));
});
Deno.test(
  "provider-controlled pagination cannot exfiltrate the bearer token",
  async () => {
    let calls = 0;
    await mockFetch(
      async () => {
        calls++;
        return reply({});
      },
      async () => {
        try {
          await providerJson(
            "https://attacker.example/api",
            "secret",
            "https://graph.microsoft.com",
          );
          throw new Error("allowed unsafe URL");
        } catch (error) {
          assert(
            error instanceof ProviderError &&
              error.code === "invalid_provider_url",
          );
        }
      },
    );
    eq(calls, 0);
  },
);
Deno.test(
  "Google Drive paginates, excludes folders, requests metadata only",
  async () => {
    let calls = 0;
    await mockFetch(
      async (input, init) => {
        calls++;
        const url = new URL(String(input));
        assert(url.hostname === "www.googleapis.com");
        assert(init?.redirect === "error");
        assert(url.searchParams.get("includeItemsFromAllDrives") === "true");
        if (calls === 1)
          return reply({
            nextPageToken: "page2",
            files: [
              {
                id: "d",
                name: "Folder",
                mimeType: "application/vnd.google-apps.folder",
              },
              {
                id: "a",
                name: "Policy",
                mimeType: "application/pdf",
                version: "2",
                webViewLink: "https://drive.google.com/a",
              },
            ],
          });
        assert(url.searchParams.get("pageToken") === "page2");
        return reply({
          files: [{ id: "b", name: "Record", mimeType: "text/plain" }],
        });
      },
      async () => {
        const result = await collectProvider(
          "google_drive",
          { access_token: "test" },
          {},
        );
        eq(
          result.resources.map((r) => r.externalId),
          ["file:a", "file:b"],
        );
        eq(result.warnings, []);
        eq(result.resources[0].signals.version, "2");
      },
    );
    eq(calls, 2);
  },
);
Deno.test(
  "GitHub discovery lists repositories; only scoped repos receive branch checks",
  async () => {
    let branchCalls = 0;
    await mockFetch(
      async (input) => {
        const url = String(input);
        if (url.includes("/user/repos"))
          return reply([
            {
              id: 1,
              name: "one",
              owner: { login: "org" },
              full_name: "org/one",
              default_branch: "main",
              private: true,
            },
            {
              id: 2,
              name: "two",
              owner: { login: "org" },
              full_name: "org/two",
              default_branch: "main",
            },
          ]);
        branchCalls++;
        assert(url.includes("/org/two/branches/main"));
        return reply({ protected: true });
      },
      async () => {
        const discovery = await collectProvider(
          "github",
          { access_token: "test" },
          {},
        );
        eq(branchCalls, 0);
        eq(discovery.resources.length, 2);
        const result = await collectProvider(
          "github",
          { access_token: "test" },
          { scope_ids: ["repo:2"] },
        );
        eq(result.resources[0].signals.branch_protected, null);
        eq(result.resources[1].signals.branch_protected, true);
      },
    );
    eq(branchCalls, 1);
  },
);
Deno.test(
  "Entra denied MFA/role permissions remain unknown and partial",
  async () => {
    await mockFetch(
      async (input) =>
        String(input).includes("/users?")
          ? reply({
              value: [
                { id: "u1", displayName: "Person", accountEnabled: true },
              ],
            })
          : reply({}, 403),
      async () => {
        const result = await collectProvider(
          "entra_id",
          { access_token: "test" },
          {},
        );
        eq(result.resources[0].signals.mfa_registered, null);
        eq(result.resources[0].signals.privileged, null);
        assert(result.warnings.includes("mfa_permission_missing"));
        assert(result.warnings.includes("roles_permission_missing"));
      },
    );
  },
);
Deno.test(
  "Entra recognizes directory roles inherited from groups",
  async () => {
    await mockFetch(
      async (input) => {
        const url = String(input);
        if (url.includes("/users?"))
          return reply({
            value: [{ id: "u1", displayName: "Group administrator" }],
          });
        if (url.includes("userRegistrationDetails"))
          return reply({ value: [{ id: "u1", isMfaRegistered: true }] });
        if (url.includes("roleAssignments"))
          return reply({ value: [{ principalId: "g1" }] });
        if (url.includes("/groups/g1/transitiveMembers/"))
          return reply({ value: [{ id: "u1" }] });
        throw new Error("unexpected endpoint");
      },
      async () => {
        const result = await collectProvider(
          "entra_id",
          { access_token: "test" },
          {},
        );
        eq(result.resources[0].signals.privileged, true);
        eq(result.warnings, []);
      },
    );
  },
);
Deno.test(
  "Intune keeps noncompliance separate from operational state",
  async () => {
    await mockFetch(
      async () =>
        reply({
          value: [
            {
              id: "d1",
              deviceName: "Endpoint",
              complianceState: "noncompliant",
              operatingSystem: "Windows",
            },
          ],
        }),
      async () => {
        const result = await collectProvider(
          "intune",
          { access_token: "test" },
          {},
        );
        eq(evaluateResource(result.resources[0]), [
          { key: "device_compliant", status: "fail" },
        ]);
        assert(!("ativo" in result.resources[0].signals));
      },
    );
  },
);
Deno.test(
  "SharePoint and OneDrive collect versioned metadata without requesting file contents",
  async () => {
    for (const provider of ["sharepoint", "onedrive"] as const) {
      await mockFetch(
        async (input) => {
          const url = String(input);
          assert(!url.includes("/content"));
          if (url.includes("/sites?")) return reply({ value: [{ id: "s1" }] });
          if (url.endsWith("/drives"))
            return reply({ value: [{ id: "d1", name: "Documents" }] });
          return reply({
            value: [
              {
                id: "f1",
                name: "Policy",
                file: { mimeType: "application/pdf" },
                eTag: "v2",
                webUrl: "https://tenant.sharepoint.com/policy",
              },
              { id: "removed", deleted: {} },
            ],
          });
        },
        async () => {
          const result = await collectProvider(
            provider,
            { access_token: "test" },
            {},
          );
          eq(result.resources.length, 1);
          eq(result.resources[0].signals.version, "v2");
        },
      );
    }
  },
);
Deno.test(
  "OAuth uses unpredictable state, PKCE, minimal scopes and server-only secret exchange",
  async () => {
    const vars = {
      INTEGRATION_COLLECTIONS_ENABLED: "true",
      SUPABASE_URL: "https://project.supabase.co",
      GOOGLE_INTEGRATION_CLIENT_ID: "client",
      GOOGLE_INTEGRATION_CLIENT_SECRET: "server-secret",
    };
    const previous = Object.fromEntries(
      Object.keys(vars).map((key) => [key, Deno.env.get(key)]),
    );
    try {
      for (const [key, value] of Object.entries(vars)) Deno.env.set(key, value);
      const state = randomSecret(),
        verifier = randomSecret();
      assert(state !== verifier && state.length >= 40);
      eq((await digest(state)).length, 64);
      const url = new URL(
        await authorizationUrl("google_drive", state, verifier),
      );
      eq(url.searchParams.get("state"), state);
      eq(url.searchParams.get("code_challenge_method"), "S256");
      eq(
        url.searchParams.get("scope"),
        "https://www.googleapis.com/auth/drive.metadata.readonly",
      );
      assert(!url.href.includes("server-secret"));
      await mockFetch(
        async (input, init) => {
          eq(String(input), "https://oauth2.googleapis.com/token");
          const body = init?.body as URLSearchParams;
          eq(body.get("code_verifier"), verifier);
          eq(body.get("client_secret"), "server-secret");
          return reply({
            access_token: "token",
            refresh_token: "refresh",
            expires_in: 3600,
          });
        },
        async () => {
          assert(
            (await exchangeCode("google_drive", "code", verifier))
              .access_token === "token",
          );
        },
      );
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }
  },
);
