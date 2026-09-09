import {
  type CollectedResource,
  type Provider,
  safeSourceUrl,
  validRoleArn,
} from "./integration-model.ts";

export class ProviderError extends Error {
  constructor(
    public code: string,
    public retryable = false,
    public retryAfter: string | null = null,
  ) {
    super(code);
  }
}
export interface Collection {
  resources: CollectedResource[];
  warnings: string[];
}
type Credentials = Record<string, any>;
const GRAPH = "https://graph.microsoft.com/v1.0";
const GOOGLE = "https://www.googleapis.com/drive/v3";
const GITHUB = "https://api.github.com";

// Never follow a provider-controlled nextLink to an arbitrary host with tokens.
export async function providerJson(
  url: string,
  token: string,
  origin: string,
): Promise<any> {
  const target = new URL(url);
  if (target.origin !== origin || target.username || target.password)
    throw new ProviderError("invalid_provider_url");
  const response = await fetch(target, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(origin === GITHUB
        ? {
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Akuris-Integrations",
          }
        : {}),
    },
  });
  if (!response.ok)
    throw new ProviderError(
      response.status === 401
        ? "authorization_expired"
        : response.status === 403
          ? "permission_missing"
          : `provider_http_${response.status}`,
      response.status === 429 || response.status >= 500,
      response.headers.get("retry-after"),
    );
  return response.json();
}

async function graphPages(
  path: string,
  token: string,
  warnings: string[],
  read = providerJson,
): Promise<any[]> {
  let next: string | undefined = `${GRAPH}${path}`;
  const items: any[] = [];
  for (let page = 0; next && page < 30; page++) {
    const data = await read(next, token, "https://graph.microsoft.com");
    items.push(...(data.value || []));
    next = data["@odata.nextLink"];
  }
  if (next) warnings.push("collection_limit");
  return items;
}

export const microsoftScopes: Partial<Record<Provider, string[]>> = {
  microsoft365: [
    "User.Read",
    "User.Read.All",
    "RoleManagement.Read.Directory",
    "GroupMember.Read.All",
    "AuditLog.Read.All",
    "DeviceManagementManagedDevices.Read.All",
  ],
  entra_id: [
    "User.Read",
    "User.Read.All",
    "RoleManagement.Read.Directory",
    "GroupMember.Read.All",
    "AuditLog.Read.All",
  ],
  intune: ["User.Read", "DeviceManagementManagedDevices.Read.All"],
  sharepoint: ["User.Read", "Sites.Read.All"],
  onedrive: ["User.Read", "Files.Read.All"],
};

export async function collectProvider(
  provider: Provider,
  credentials: Credentials,
  settings: Record<string, any>,
): Promise<Collection> {
  if (provider === "aws") return collectAws(settings);
  const token = credentials.access_token;
  if (!token) throw new ProviderError("authorization_required");
  const warnings: string[] = [],
    resources: CollectedResource[] = [];
  const started = Date.now();
  let requests = 0;
  const read: typeof providerJson = (url, accessToken, origin) => {
    if (
      Date.now() - started > 80000 ||
      ++requests > 100 ||
      resources.length >= 10000
    )
      throw new ProviderError("collection_limit");
    return providerJson(url, accessToken, origin);
  };
  const pages = (path: string, accessToken: string, notes: string[]) =>
    graphPages(path, accessToken, notes, read);
  try {
    if (["microsoft365", "entra_id", "intune"].includes(provider)) {
      if (provider !== "intune") {
        const users = await pages(
          "/users?$top=999&$select=id,displayName,mail,userPrincipalName,accountEnabled,department,jobTitle",
          token,
          warnings,
        );
        let mfa: Map<string, boolean> | null = null,
          admins: Set<string> | null = null;
        try {
          mfa = new Map(
            (
              await pages(
                "/reports/authenticationMethods/userRegistrationDetails?$top=999",
                token,
                warnings,
              )
            ).map((row) => [row.id, row.isMfaRegistered]),
          );
        } catch (error) {
          if (
            !(error instanceof ProviderError) ||
            error.code !== "permission_missing"
          )
            throw error;
          warnings.push("mfa_permission_missing");
        }
        try {
          const roleWarnings: string[] = [];
          const assignments = await pages(
            "/roleManagement/directory/roleAssignments?$select=principalId",
            token,
            roleWarnings,
          );
          admins = new Set(assignments.map((row) => row.principalId));
          const usersById = new Set(users.map((user) => user.id));
          // Role-assignable groups can confer privileged access transitively.
          for (const principal of [...admins]) {
            if (usersById.has(principal)) continue;
            try {
              for (const user of await pages(
                `/groups/${encodeURIComponent(principal)}/transitiveMembers/microsoft.graph.user?$select=id&$top=999`,
                token,
                roleWarnings,
              ))
                admins.add(user.id);
            } catch (error) {
              if (
                !(error instanceof ProviderError) ||
                error.code !== "provider_http_404"
              )
                throw error;
            }
          }
          if (roleWarnings.length) {
            admins = null;
            warnings.push("roles_permission_missing", ...roleWarnings);
          }
        } catch (error) {
          admins = null;
          if (
            !(error instanceof ProviderError) ||
            error.code !== "permission_missing"
          )
            throw error;
          warnings.push("roles_permission_missing");
        }
        resources.push(
          ...users.map((user) => ({
            externalId: `user:${user.id}`,
            kind: "identity" as const,
            name: user.displayName || user.userPrincipalName,
            signals: {
              email: user.mail || user.userPrincipalName,
              enabled: user.accountEnabled ?? null,
              privileged: admins ? admins.has(user.id) : null,
              mfa_registered: mfa?.get(user.id) ?? null,
              department: user.department ?? null,
              job_title: user.jobTitle ?? null,
            },
          })),
        );
      }
      if (provider !== "entra_id") {
        try {
          const devices = await pages(
            "/deviceManagement/managedDevices?$top=999&$select=id,deviceName,complianceState,operatingSystem,osVersion,serialNumber,userPrincipalName,lastSyncDateTime",
            token,
            warnings,
          );
          resources.push(
            ...devices.map((device) => ({
              externalId: `device:${device.id}`,
              kind: "device" as const,
              name: device.deviceName || device.id,
              signals: {
                compliance: device.complianceState ?? "unknown",
                os: device.operatingSystem ?? null,
                version: device.osVersion ?? null,
                serial_number: device.serialNumber ?? null,
                owner_email: device.userPrincipalName ?? null,
                provider_last_sync: device.lastSyncDateTime ?? null,
              },
            })),
          );
        } catch (error) {
          if (
            provider === "intune" ||
            !(error instanceof ProviderError) ||
            error.code !== "permission_missing"
          )
            throw error;
          warnings.push("intune_permission_missing");
        }
      }
    } else if (provider === "github") {
      for (let page = 1; page <= 20; page++) {
        const repos = await read(
          `${GITHUB}/user/repos?per_page=100&page=${page}&sort=full_name`,
          token,
          GITHUB,
        );
        if (!Array.isArray(repos))
          throw new ProviderError("invalid_provider_response");
        for (const repo of repos) {
          let protectedBranch: boolean | null = null;
          if (
            (settings.scope_ids || []).includes(`repo:${repo.id}`) &&
            !repo.archived &&
            repo.default_branch
          ) {
            try {
              const branch = await read(
                `${GITHUB}/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/branches/${encodeURIComponent(repo.default_branch)}`,
                token,
                GITHUB,
              );
              protectedBranch =
                typeof branch.protected === "boolean" ? branch.protected : null;
            } catch (error) {
              if (
                !(error instanceof ProviderError) ||
                ![
                  "permission_missing",
                  "provider_http_404",
                  "provider_http_409",
                ].includes(error.code)
              )
                throw error;
              warnings.push("branch_unavailable");
            }
          }
          resources.push({
            externalId: `repo:${repo.id}`,
            kind: "repository",
            name: repo.full_name,
            url: safeSourceUrl(repo.html_url),
            signals: {
              private: repo.private,
              archived: repo.archived,
              default_branch: repo.default_branch ?? null,
              branch_protected: protectedBranch,
            },
          });
        }
        if (repos.length < 100) break;
        if (page === 20) warnings.push("collection_limit");
      }
    } else if (provider === "google_drive") {
      let next = "";
      for (let page = 0; page < 30; page++) {
        const url = new URL(`${GOOGLE}/files`);
        url.search = new URLSearchParams({
          pageSize: "100",
          q: "trashed = false",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
          fields:
            "nextPageToken,files(id,name,mimeType,modifiedTime,version,webViewLink,size,md5Checksum)",
          ...(next ? { pageToken: next } : {}),
        }).toString();
        const data = await read(url.href, token, "https://www.googleapis.com");
        resources.push(
          ...(data.files || [])
            .filter(
              (file: any) =>
                file.mimeType !== "application/vnd.google-apps.folder",
            )
            .map((file: any) => ({
              externalId: `file:${file.id}`,
              kind: "document" as const,
              name: file.name,
              url: safeSourceUrl(file.webViewLink),
              signals: {
                mime_type: file.mimeType,
                modified_at: file.modifiedTime ?? null,
                version: file.version ?? null,
                size: Number(file.size) || null,
                provider_hash: file.md5Checksum ?? null,
              },
            })),
        );
        next = data.nextPageToken;
        if (!next) break;
      }
      if (next) warnings.push("collection_limit");
    } else if (provider === "onedrive" || provider === "sharepoint") {
      const drives =
        provider === "onedrive"
          ? await pages("/me/drives", token, warnings)
          : (await pages("/sites?search=*", token, warnings)).slice(0, 20);
      for (const entry of drives) {
        const sourceDrives =
          provider === "onedrive"
            ? [entry]
            : await pages(
                `/sites/${encodeURIComponent(entry.id)}/drives`,
                token,
                warnings,
              );
        for (const drive of sourceDrives) {
          const files = await pages(
            `/drives/${encodeURIComponent(drive.id)}/root/delta?$select=id,name,file,webUrl,lastModifiedDateTime,eTag,size,deleted`,
            token,
            warnings,
          );
          resources.push(
            ...files
              .filter((file) => file.file && !file.deleted)
              .map((file) => ({
                externalId: `file:${drive.id}:${file.id}`,
                kind: "document" as const,
                name: file.name,
                url: safeSourceUrl(file.webUrl),
                signals: {
                  drive_name: drive.name,
                  mime_type: file.file.mimeType ?? null,
                  modified_at: file.lastModifiedDateTime ?? null,
                  version: file.eTag ?? null,
                  size: file.size ?? null,
                },
              })),
          );
        }
      }
      if (provider === "sharepoint" && drives.length >= 20)
        warnings.push("collection_limit");
    }
  } catch (error) {
    if (
      !(error instanceof ProviderError) ||
      error.code !== "collection_limit" ||
      !resources.length
    )
      throw error;
    warnings.push("collection_limit");
  }
  // Delta APIs can emit the same item more than once during discovery.
  if (resources.length > 10000) warnings.push("collection_limit");
  return {
    resources: [
      ...new Map(
        resources.map((resource) => [resource.externalId, resource]),
      ).values(),
    ].slice(0, 10000),
    warnings: [...new Set(warnings)],
  };
}

async function collectAws(settings: Record<string, any>): Promise<Collection> {
  if (!validRoleArn(settings.role_arn || "") || !settings.external_id)
    throw new ProviderError("aws_role_required");
  const { STSClient, AssumeRoleCommand } =
    await import("npm:@aws-sdk/client-sts@3.883.0");
  const { IAMClient, GetAccountSummaryCommand } =
    await import("npm:@aws-sdk/client-iam@3.883.0");
  const { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand } =
    await import("npm:@aws-sdk/client-s3@3.883.0");
  const { CloudTrailClient, DescribeTrailsCommand, GetTrailStatusCommand } =
    await import("npm:@aws-sdk/client-cloudtrail@3.883.0");
  const base = {
    accessKeyId: Deno.env.get("AWS_INTEGRATION_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_INTEGRATION_SECRET_ACCESS_KEY")!,
  };
  if (!base.accessKeyId || !base.secretAccessKey)
    throw new ProviderError("platform_setup_required");
  const started = Date.now();
  const send = async (client: any, command: any): Promise<any> => {
    if (Date.now() - started > 80000)
      throw new ProviderError("collection_limit");
    return client.send(command, { abortSignal: AbortSignal.timeout(15000) });
  };
  let assumed;
  try {
    assumed = await send(
      new STSClient({ region: "us-east-1", credentials: base, maxAttempts: 2 }),
      new AssumeRoleCommand({
        RoleArn: settings.role_arn,
        ExternalId: settings.external_id,
        RoleSessionName: "AkurisReadOnly",
        DurationSeconds: 900,
      }),
    );
  } catch {
    throw new ProviderError("aws_assume_role_failed");
  }
  const creds = assumed.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken)
    throw new ProviderError("aws_assume_role_failed");
  const credentials = {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
  };
  const region = /^[a-z]{2}-[a-z]+-\d$/.test(settings.region || "")
    ? settings.region
    : "us-east-1";
  const resources: CollectedResource[] = [],
    warnings: string[] = [];
  const summary = await send(
    new IAMClient({ region: "us-east-1", credentials, maxAttempts: 2 }),
    new GetAccountSummaryCommand({}),
  );
  resources.push({
    externalId: "account",
    kind: "cloud",
    name: settings.role_arn.split(":")[4],
    signals: {
      root_mfa:
        summary.SummaryMap?.AccountMFAEnabled === undefined
          ? null
          : summary.SummaryMap.AccountMFAEnabled === 1,
    },
  });
  const s3 = new S3Client({
    region,
    credentials,
    followRegionRedirects: true,
    maxAttempts: 2,
  });
  let continuation: string | undefined;
  try {
    do {
      const buckets = await send(
        s3,
        new ListBucketsCommand({
          MaxBuckets: 100,
          ContinuationToken: continuation,
        }),
      );
      for (const bucket of buckets.Buckets || []) {
        let blocked: boolean | null = null;
        try {
          const config = (
            await send(
              s3,
              new GetPublicAccessBlockCommand({ Bucket: bucket.Name }),
            )
          ).PublicAccessBlockConfiguration;
          blocked =
            !!config &&
            config.BlockPublicAcls === true &&
            config.BlockPublicPolicy === true &&
            config.IgnorePublicAcls === true &&
            config.RestrictPublicBuckets === true;
        } catch (error) {
          if (
            error instanceof ProviderError &&
            error.code === "collection_limit"
          )
            throw error;
          warnings.push("bucket_policy_unavailable");
        }
        resources.push({
          externalId: `bucket:${bucket.Name}`,
          kind: "cloud",
          name: bucket.Name!,
          signals: { public_access_blocked: blocked },
        });
      }
      continuation = buckets.ContinuationToken;
      if (resources.length > 300) {
        warnings.push("collection_limit");
        break;
      }
    } while (continuation);
    const trailClient = new CloudTrailClient({
      region,
      credentials,
      maxAttempts: 2,
    });
    const trails = await send(
      trailClient,
      new DescribeTrailsCommand({ includeShadowTrails: false }),
    );
    for (const trail of trails.trailList || []) {
      const trailStatus = await send(
        trailClient,
        new GetTrailStatusCommand({ Name: trail.TrailARN }),
      );
      resources.push({
        externalId: `trail:${trail.TrailARN}`,
        kind: "cloud",
        name: trail.Name!,
        signals: { logging_enabled: trailStatus.IsLogging ?? null, region },
      });
    }
  } catch (error) {
    if (!(error instanceof ProviderError) || error.code !== "collection_limit")
      throw error;
    warnings.push("collection_limit");
  }
  return { resources, warnings: [...new Set(warnings)] };
}
