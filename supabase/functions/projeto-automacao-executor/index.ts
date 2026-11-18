import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authorizedScheduledJob } from '../_shared/scheduled-job.ts';
import { normalizarTipo, passaCondicoes, montarMensagem, acaoCompleta } from './regras.ts';

/**
 * Executor de Automações de Projeto.
 *
 * Payload esperado:
 * {
 *   projeto_id: string,
 *   gatilho: 'tarefa_criada' | 'tarefa_movida_para_coluna' | 'tarefa_concluida' | 'prazo_excedido',
 *   tarefa: { id, titulo, coluna_id, responsavel_id, prioridade, prazo, ...},
 *   contexto?: Record<string, any>
 * }
 *
 * Avalia condições simples (campo == valor) e aplica ações:
 *   - atribuir_responsavel { user_id }
 *   - mover_para_coluna   { coluna_id }
 *   - definir_prioridade  { prioridade }
 *   - notificar_usuario   { user_id, mensagem }
 *   - adicionar_checklist { itens: string[] }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { projeto_id, gatilho, tarefa: tarefaPedida, contexto, dry_run, automacao_id } = await req.json();
    if (!projeto_id || !gatilho || typeof tarefaPedida?.id !== 'string') {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    /*
      Quem chama tem de pertencer à empresa do projeto.

      Esta função nunca tinha sido chamada por ninguém, por isso o buraco nunca
      chegou a ser explorado -- mas ao ligá-la, passaria a receber `projeto_id`
      do CORPO e a agir sobre ele com um cliente de service_role, que ignora
      RLS. Qualquer utilizador autenticado podia disparar automações no projeto
      de outra empresa: mover tarefas alheias de coluna, reatribuir
      responsáveis, notificar pessoas que não conhece.

      É o mesmo padrão das funções de notificação que já foram fechadas: nunca
      confiar num identificador que veio no pedido.
    */
    const rotina = authorizedScheduledJob(req, Deno.env.get('LEMBRETES_DIARIOS_TOKEN'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const authHeader = req.headers.get('Authorization');
    if (!rotina && !authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const verificador = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: sessao, error: erroSessao } = rotina
      ? { data: null, error: null }
      : await verificador.auth.getUser(authHeader!.replace('Bearer ', ''));
    if (!rotina && (erroSessao || !sessao?.user)) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: projeto } = await supabase
      .from('projetos').select('empresa_id').eq('id', projeto_id).maybeSingle();
    const { data: perfil } = rotina
      ? { data: { empresa_id: projeto?.empresa_id } }
      : await supabase.from('profiles').select('empresa_id').eq('user_id', sessao!.user.id).eq('ativo', true).maybeSingle();

    if (!perfil?.empresa_id || !projeto?.empresa_id || perfil.empresa_id !== projeto.empresa_id) {
      return new Response(JSON.stringify({ error: 'Projeto de outra empresa' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // A tarefa vem da base, ligada ao projeto já autorizado: o id do pedido
    // nunca alcança tarefas de outro projeto ou empresa.
    const { data: tarefa } = await supabase
      .from('projeto_tarefas').select('*')
      .eq('id', tarefaPedida.id).eq('projeto_id', projeto_id).maybeSingle();
    if (!tarefa) {
      return new Response(JSON.stringify({ error: 'Tarefa não encontrada neste projeto' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let consulta = supabase.from('projeto_automacoes').select('*').eq('projeto_id', projeto_id);
    // Testar agora: avalia uma regra específica (mesmo pausada) sem aplicar nada.
    consulta = dry_run && automacao_id ? consulta.eq('id', automacao_id) : consulta.eq('gatilho', gatilho).eq('ativa', true);
    const { data: regras, error } = await consulta;
    if (error) throw error;

    const executadas: string[] = [];
    const previsao: { automacao_id: string; passa: boolean; acoes: string[] }[] = [];

    for (const r of regras ?? []) {
      const passa = passaCondicoes((r.condicoes ?? {}) as Record<string, unknown>, tarefa);
      const acoes = (Array.isArray(r.acoes) ? r.acoes : []).filter(acaoCompleta);
      if (dry_run) { previsao.push({ automacao_id: r.id, passa, acoes: acoes.map((a: any) => normalizarTipo(a.tipo)) }); continue; }
      if (!passa) continue;

      const aplicadas: string[] = [];
      const erros: string[] = [];
      for (const ac of acoes) {
        try {
          await aplicarAcao(supabase, ac, tarefa, r, contexto);
          aplicadas.push(normalizarTipo(ac.tipo));
        } catch (e) {
          console.error('Falha ao aplicar ação', ac, e);
          erros.push(`${ac.tipo}: ${(e as Error).message}`);
        }
      }

      await supabase.from('projeto_automacoes').update({
        ultima_execucao_em: new Date().toISOString(),
        execucoes_count: (r.execucoes_count ?? 0) + 1,
      }).eq('id', r.id).eq('empresa_id', projeto.empresa_id);

      await supabase.from('projeto_automacao_execucoes').insert({
        empresa_id: projeto.empresa_id, projeto_id, automacao_id: r.id,
        tarefa_id: tarefa.id, tarefa_titulo: tarefa.titulo,
        resultado: erros.length ? (aplicadas.length ? 'parcial' : 'erro') : 'sucesso',
        acoes: aplicadas, erro: erros.join('; ') || null,
      });
      executadas.push(r.id);
    }

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, previsao }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, executadas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function aplicarAcao(
  supabase: any,
  acao: Record<string, any>,
  tarefa: any,
  regra: any,
  _ctx: any,
) {
  const tipo = normalizarTipo(acao.tipo as string);
  switch (tipo) {
    case 'atribuir_responsavel':
      if (acao.user_id) {
        await supabase
          .from('projeto_tarefas')
          .update({ responsavel_id: acao.user_id })
          .eq('id', tarefa.id).eq('projeto_id', tarefa.projeto_id);
      }
      break;

    case 'mover_para_coluna':
      if (acao.coluna_id) {
        await supabase
          .from('projeto_tarefas')
          .update({ coluna_id: acao.coluna_id })
          .eq('id', tarefa.id).eq('projeto_id', tarefa.projeto_id);
      }
      break;

    case 'definir_prioridade':
      if (acao.prioridade) {
        await supabase
          .from('projeto_tarefas')
          .update({ prioridade: acao.prioridade })
          .eq('id', tarefa.id).eq('projeto_id', tarefa.projeto_id);
      }
      break;

    case 'notificar_usuario':
      if (acao.user_id) {
        // Isolamento: só avisa quem é da mesma empresa do projeto.
        const { data: dest } = await supabase.from('profiles')
          .select('empresa_id, notificar_na_aplicacao').eq('user_id', acao.user_id).eq('ativo', true).maybeSingle();
        if (!dest || dest.empresa_id !== regra.empresa_id || dest.notificar_na_aplicacao === false) break;
        const { error } = await supabase.from('notifications').insert({
          user_id: acao.user_id, type: 'info',
          title: `Automação: ${regra.nome}`,
          message: montarMensagem(acao.mensagem, tarefa.titulo),
          link_to: `/projetos/${regra.projeto_id}?focus=${tarefa.id}`,
          metadata: { projeto_id: regra.projeto_id, tarefa_id: tarefa.id, automacao_id: regra.id },
        });
        if (error) throw error;
      }
      break;

    case 'adicionar_checklist': {
      const itens: string[] = Array.isArray(acao.itens) ? acao.itens : [];
      if (itens.length) {
        const linhas = itens.map((texto, i) => ({
          tarefa_id: tarefa.id,
          texto,
          ordem: i,
          concluido: false,
        }));
        await supabase.from('projeto_tarefa_checklist').insert(linhas);
      }
      break;
    }

    default:
      console.warn('Tipo de ação desconhecido:', tipo);
  }
}
