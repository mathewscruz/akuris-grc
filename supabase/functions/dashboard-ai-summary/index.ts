const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

// Não há chamador no produto para este resumo legado. A rota antiga cobrava
// créditos e lia diversas tabelas com service role sem fazer parte do painel.
Deno.serve(() => new Response(JSON.stringify({
  error: 'endpoint_descontinuado',
}), { status: 410, headers }));
