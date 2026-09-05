const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

// A recolha por agente foi retirada do produto. Mantemos uma resposta
// explícita durante a transição para que instalações antigas parem de tentar,
// sem deixar o código legado com service role exposto em produção.
Deno.serve(() => new Response(JSON.stringify({
  error: 'endpoint_agent_descontinuado',
}), { status: 410, headers }));
