import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authorizedScheduledJob } from '../_shared/scheduled-job.ts';
import { requireUserContext } from '../_shared/auth.ts';
import { abrirMesh, meshConfig } from '../_shared/mesh.ts';
import { ativoDoNo, semContato, type NoMesh } from './regras.ts';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Cron (token próprio) sincroniza todas as empresas; um utilizador só a sua.
  let filtroEmpresa: string | null = null;
  if (!authorizedScheduledJob(req, Deno.env.get('MESH_SYNC_TOKEN'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
    try {
      const ctx = await requireUserContext(req);
      if (!ctx.empresaId) return json({ error: 'sem_empresa' }, 403);
      filtroEmpresa = ctx.empresaId;
    } catch { return json({ error: 'unauthorized' }, 401); }
  }
  const cfg = meshConfig();
  if (!cfg) return json({ error: 'mesh_nao_configurado' }, 503);

  let q = supabase.from('mesh_grupos').select('empresa_id, mesh_id');
  if (filtroEmpresa) q = q.eq('empresa_id', filtroEmpresa);
  const { data: grupos, error } = await q;
  if (error) return json({ error: 'falha_ler_grupos' }, 500);
  if (!grupos?.length) return json({ sincronizados: 0 });

  const conn = await abrirMesh(cfg).catch(() => null);
  if (!conn) return json({ error: 'mesh_indisponivel' }, 502);
  let total = 0;
  try {
    const r = await conn.pedir({ action: 'nodes' });
    const porGrupo: Record<string, NoMesh[]> = r.nodes ?? {};
    for (const g of grupos) {
      const nos = porGrupo[g.mesh_id] ?? [];
      for (const no of nos) {
        const sys = await conn.pedir({ action: 'getsysinfo', nodeid: no._id, nodeinfo: true }).catch(() => null);
        const a = ativoDoNo(no, sys);
        const { data: atual } = await supabase.from('ativos').select('id, agente_ultimo_contato, atributos')
          .eq('empresa_id', g.empresa_id).eq('mesh_node_id', no._id).maybeSingle();
        if (atual) {
          await supabase.from('ativos').update({
            versao: a.versao, agente_online: a.agente_online,
            agente_ultimo_contato: a.agente_ultimo_contato ?? atual.agente_ultimo_contato,
            atributos: { ...(atual.atributos as object ?? {}), ...a.atributos },
          }).eq('id', atual.id).eq('empresa_id', g.empresa_id);
        } else {
          await supabase.from('ativos').insert({ ...a, empresa_id: g.empresa_id, status: 'pendente', tags: ['descoberto-agente'] });
        }
        total++;
        if (semContato(a.agente_ultimo_contato) && !semContato(atual?.agente_ultimo_contato ?? null)) {
          const { data: admins } = await supabase.from('profiles').select('user_id')
            .eq('empresa_id', g.empresa_id).in('role', ['admin', 'super_admin']).eq('ativo', true);
          if (admins?.length) await supabase.from('notifications').insert(admins.map((p) => ({
            user_id: p.user_id, title: 'Máquina sem contato', message: `${a.nome} não reporta ao Akuris há mais de 7 dias.`,
            type: 'warning', link_to: '/ativos',
          })));
        }
      }
      await supabase.from('mesh_grupos').update({ ultima_sincronizacao: new Date().toISOString() }).eq('empresa_id', g.empresa_id);
    }
  } finally { conn.fechar(); }
  return json({ sincronizados: total });
});
