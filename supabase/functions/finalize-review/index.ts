import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Compatibility endpoint. Both browser RPC and this endpoint share the same
// transaction, RLS/MFA checks, source-aware effects and idempotent notification.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Não autorizado' }, 401);
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: 'Não autorizado' }, 401);
    const { reviewId } = await req.json();
    if (typeof reviewId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewId)) return json({ error: 'ID da revisão inválido' }, 400);
    const { data, error } = await client.rpc('finalize_access_review', { p_review_id: reviewId });
    if (error) return json({ error: 'Não foi possível concluir a revisão. Confira seu acesso e os itens pendentes.' }, error.code === '42501' ? 403 : 409);
    return json(data);
  } catch {
    return json({ error: 'Não foi possível concluir a revisão.' }, 400);
  }
});
