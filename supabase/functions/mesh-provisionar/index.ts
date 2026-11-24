import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireUserContext, AuthError } from '../_shared/auth.ts';
import { abrirMesh, linksInstalador, meshConfig } from '../_shared/mesh.ts';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const ctx = await requireUserContext(req);
    if (!ctx.empresaId) return json({ error: 'sem_empresa' }, 403);
    const cfg = meshConfig();
    if (!cfg) return json({ error: 'mesh_nao_configurado' }, 503);

    const { data: existente } = await ctx.supabase.from('mesh_grupos')
      .select('mesh_id, ultima_sincronizacao').eq('empresa_id', ctx.empresaId).maybeSingle();
    if (existente) return json({ meshId: existente.mesh_id, links: linksInstalador(cfg.url, existente.mesh_id), ultimaSincronizacao: existente.ultima_sincronizacao });

    // Criar o grupo é uma decisão de administrador da empresa.
    const { data: admin } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' });
    const { data: superAdmin } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'super_admin' });
    if (!admin && !superAdmin) return json({ error: 'apenas_admin' }, 403);

    const conn = await abrirMesh(cfg);
    try {
      const r = await conn.pedir({ action: 'createmesh', meshname: `akuris-${ctx.empresaId}`, meshtype: 2, desc: 'Akuris — inventário' });
      if (r.result && r.result !== 'ok' || !r.meshid) return json({ error: 'mesh_falhou_criar_grupo' }, 502);
      const links = linksInstalador(cfg.url, r.meshid);
      const { error } = await ctx.supabase.from('mesh_grupos').insert({ empresa_id: ctx.empresaId, mesh_id: r.meshid, instalador_url: links.windows });
      if (error) return json({ error: 'falha_gravar' }, 500);
      return json({ meshId: r.meshid, links, ultimaSincronizacao: null });
    } finally { conn.fechar(); }
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    return json({ error: 'mesh_indisponivel' }, 502);
  }
});
