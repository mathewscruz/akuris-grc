const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

Deno.serve(() => new Response(JSON.stringify({
  error: 'endpoint_agent_descontinuado',
}), { status: 410, headers }));
