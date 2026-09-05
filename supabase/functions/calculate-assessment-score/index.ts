const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

// O produto calcula e persiste a avaliação no fluxo atual de due diligence.
// Esta passagem antiga não tem chamador e a versão que estava publicada
// referenciava variáveis inexistentes. Mantemos o contrato HTTP explícito
// durante a retirada, sem conservar uma superfície privilegiada invisível.
Deno.serve(() => new Response(JSON.stringify({
  error: 'endpoint_descontinuado',
}), { status: 410, headers }));
