import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

    const { projeto_id, gatilho, tarefa, contexto } = await req.json();
    if (!projeto_id || !gatilho || !tarefa?.id) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: regras, error } = await supabase
      .from('projeto_automacoes')
      .select('*')
      .eq('projeto_id', projeto_id)
      .eq('gatilho', gatilho)
      .eq('ativa', true);
    if (error) throw error;

    const executadas: string[] = [];

    for (const r of regras ?? []) {
      // Avaliar condições simples: { campo: valor }
      const cond = (r.condicoes ?? {}) as Record<string, unknown>;
      const passa = Object.entries(cond).every(([k, v]) => {
        if (v === '' || v === null || v === undefined) return true;
        return (tarefa as any)[k] === v;
      });
      if (!passa) continue;

      const acoes = Array.isArray(r.acoes) ? r.acoes : [];
      for (const ac of acoes) {
        try {
          await aplicarAcao(supabase, ac, tarefa, r, contexto);
        } catch (e) {
          console.error('Falha ao aplicar ação', ac, e);
        }
      }

      await supabase
        .from('projeto_automacoes')
        .update({
          ultima_execucao_em: new Date().toISOString(),
          execucoes_count: (r.execucoes_count ?? 0) + 1,
        })
        .eq('id', r.id);

      executadas.push(r.id);
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
  const tipo = acao.tipo as string;
  switch (tipo) {
    case 'atribuir_responsavel':
      if (acao.user_id) {
        await supabase
          .from('projeto_tarefas')
          .update({ responsavel_id: acao.user_id })
          .eq('id', tarefa.id);
      }
      break;

    case 'mover_para_coluna':
      if (acao.coluna_id) {
        await supabase
          .from('projeto_tarefas')
          .update({ coluna_id: acao.coluna_id })
          .eq('id', tarefa.id);
      }
      break;

    case 'definir_prioridade':
      if (acao.prioridade) {
        await supabase
          .from('projeto_tarefas')
          .update({ prioridade: acao.prioridade })
          .eq('id', tarefa.id);
      }
      break;

    case 'notificar_usuario':
      if (acao.user_id) {
        await supabase.from('notificacoes').insert({
          user_id: acao.user_id,
          empresa_id: regra.empresa_id,
          tipo: 'projeto_automacao',
          titulo: `Automação: ${regra.nome}`,
          mensagem: acao.mensagem || `Tarefa "${tarefa.titulo}" disparou a automação.`,
          link: `/projetos/${regra.projeto_id}`,
        });
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
