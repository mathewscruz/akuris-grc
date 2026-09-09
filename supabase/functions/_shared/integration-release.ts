// Credential presence is not release approval. This switch affects only the
// new evidence-collection platform, never the existing integration endpoints.
export function integrationCollectionsEnabled(): boolean {
  return Deno.env.get("INTEGRATION_COLLECTIONS_ENABLED") === "true";
}

export function integrationReleaseResponse(headers?: HeadersInit): Response | null {
  if (integrationCollectionsEnabled()) return null;
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Retry-After", "86400");
  return Response.json(
    { error: "integrations_coming_soon", message: "Em breve" },
    { status: 503, headers: responseHeaders },
  );
}
