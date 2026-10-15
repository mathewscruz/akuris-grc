// Edge Function: email-action
// Resposta a avisos por e-mail com link de uso único (plano de ação vencido).
// POST {token} → info; POST {token, acao:'concluir'|'adiar'} → executa.
// O link abre uma página de confirmação (nunca age em GET), evitando que
// scanners de e-mail disparem a ação.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '');
    const acao = body?.acao;
    if (!UUID.test(token)) return json({ error: 'invalido' }, 400);
    if (acao !== undefined && acao !== 'concluir' && acao !== 'adiar') return json({ error: 'acao' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: tk } = await supabase.from('email_acao_tokens').select('*').eq('token', token).maybeSingle();
    if (!tk) return json({ error: 'invalido' }, 404);
    if (tk.used_at) return json({ error: 'usado', acao: tk.acao_usada }, 410);
    if (new Date(tk.expires_at) < new Date()) return json({ error: 'expirado' }, 410);

    const { data: plano } = await supabase.from('planos_acao')
      .select('id, titulo, prazo, status').eq('id', tk.plano_id).eq('empresa_id', tk.empresa_id).maybeSingle();
    if (!plano) return json({ error: 'invalido' }, 404);
    if (!acao) return json({ plano });

    // Marca o token primeiro (só uma requisição vence a corrida).
    const { data: marcado } = await supabase.from('email_acao_tokens')
      .update({ used_at: new Date().toISOString(), acao_usada: acao })
      .eq('token', token).is('used_at', null).select('token').maybeSingle();
    if (!marcado) return json({ error: 'usado' }, 410);

    const base = plano.prazo && new Date(plano.prazo) > new Date() ? new Date(plano.prazo) : new Date();
    const update = acao === 'concluir'
      ? { status: 'concluido' }
      : { prazo: new Date(base.getTime() + 7 * 86400000).toISOString().slice(0, 10) };
    const { error } = await supabase.from('planos_acao').update(update).eq('id', plano.id).eq('empresa_id', tk.empresa_id);
    if (error) return json({ error: 'falha' }, 500);

    await supabase.from('notificacoes').insert({
      empresa_id: tk.empresa_id, user_id: tk.user_id,
      title: acao === 'concluir' ? 'Plano concluído pelo e-mail' : 'Prazo adiado pelo e-mail',
      message: plano.titulo, type: 'info', link_to: '/planos-acao',
    }).then(() => {}, () => {});

    return json({ ok: true, acao, ...update });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
