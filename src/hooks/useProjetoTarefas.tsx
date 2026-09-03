import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import type {
  ProjetoTarefa,
  ProjetoColuna,
  ProjetoTarefaPrioridade,
  ProjetoTarefaComentario,
  ProjetoTarefaChecklist,
  ProjetoTarefaVinculo,
  ProjetoVinculoEntidade,
  ProjetoMembro,
} from '@/types/projetos';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { tGlobal } from '@/lib/i18n-global';

export function useProjetoColunas(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto-colunas', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_colunas' as any)
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoColuna[];
    },
  });
}

export function useProjetoTarefas(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto-tarefas', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tarefas' as any)
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoTarefa[];
    },
  });
}

export interface TarefaInput {
  projeto_id: string;
  coluna_id?: string | null;
  parent_task_id?: string | null;
  titulo: string;
  descricao?: string | null;
  prioridade?: ProjetoTarefaPrioridade;
  responsavel_id?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  prazo?: string | null;
  estimativa_horas?: number | null;
  tags?: string[];
  ordem?: number;
  sla_horas?: number | null;
  origem_tipo?: string | null;
  origem_id?: string | null;
}

export function useUpsertTarefa() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...input }: TarefaInput & { id?: string }) => {
      if (id) {
        const { data, error } = await supabase
          .from('projeto_tarefas' as any)
          .update(input as any)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('projeto_tarefas' as any)
        .insert({ ...input, criador_id: user?.id } as any)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ['projeto-tarefas', vars.projeto_id] });
      toast.success(tGlobal('cardsKpi.sweep.projetos.tarefaSalva'));
      // So a CRIACAO dispara `tarefa_criada`; editar nao e criar.
      if (!vars.id && data?.id && vars.projeto_id) {
        void dispararAutomacoes(vars.projeto_id, 'tarefa_criada', data);
      }
    },
    onError: (err: any) => {
      logger.error(tGlobal('cardsKpi.sweep.projetos.erroSalvarTarefa'), err);
      toast.error(err.message || tGlobal('cardsKpi.sweep.projetos.erroSalvarTarefa'));
    },
  });
}

export function useDeleteTarefa(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_tarefas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto-tarefas', projetoId] });
      toast.success('Tarefa removida');
    },
    onError: (err: any) => toast.error(err.message || tGlobal('cardsKpi.sweep.projetos.erroRemover')),
  });
}


/**
 * Avisa o executor de automacoes que algo aconteceu numa tarefa.
 *
 * O painel de Automacoes tem um construtor a serio -- gatilho, condicao, N
 * accoes -- com selo verde «Ativa» e contador de execucoes. Gravava as regras
 * em `projeto_automacoes` e mais nada: o `projeto-automacao-executor` existe,
 * funciona, e NAO TINHA QUEM O CHAMASSE. Nem cron, nem outra funcao, nem o
 * produto. O contador ficava em zero para sempre, e as regras eram decoracao.
 *
 * Faltava o emissor. E aqui, onde a tarefa muda, que se sabe que mudou.
 *
 * Nao lanca nem bloqueia: a tarefa ja foi gravada, e uma automacao que falha
 * nao pode desfazer o trabalho de quem a gravou.
 */
async function dispararAutomacoes(
  projetoId: string,
  gatilho: 'tarefa_criada' | 'tarefa_movida_para_coluna' | 'tarefa_concluida' | 'prazo_excedido',
  tarefa: { id: string; [k: string]: unknown },
  contexto?: Record<string, unknown>,
) {
  try {
    const { error } = await supabase.functions.invoke('projeto-automacao-executor', {
      body: { projeto_id: projetoId, gatilho, tarefa, contexto: contexto ?? {} },
    });
    // `invoke` devolve {data,error} e nao lanca: sem esta leitura, uma falha
    // passaria despercebida exactamente como passou ate agora.
    if (error) logger.error('Automacoes de projeto nao correram', { data: error });
  } catch (erro) {
    logger.error('Automacoes de projeto falharam', {
      data: erro instanceof Error ? erro.message : String(erro),
    });
  }
}

export function useMoveTarefa(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefaId, colunaId, ordem }: { tarefaId: string; colunaId: string; ordem: number }) => {
      const { error } = await supabase
        .from('projeto_tarefas' as any)
        .update({ coluna_id: colunaId, ordem } as any)
        .eq('id', tarefaId);
      if (error) throw error;
    },
    onMutate: async ({ tarefaId, colunaId, ordem }) => {
      await qc.cancelQueries({ queryKey: ['projeto-tarefas', projetoId] });
      const prev = qc.getQueryData<ProjetoTarefa[]>(['projeto-tarefas', projetoId]);
      qc.setQueryData<ProjetoTarefa[]>(['projeto-tarefas', projetoId], (old) =>
        (old ?? []).map((t) => (t.id === tarefaId ? { ...t, coluna_id: colunaId, ordem } : t))
      );
      return { prev };
    },
    onSuccess: (_data, vars) => {
      void dispararAutomacoes(projetoId, 'tarefa_movida_para_coluna', { id: vars.tarefaId }, {
        coluna_id: vars.colunaId,
      });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['projeto-tarefas', projetoId], ctx.prev);
      toast.error(tGlobal('cardsKpi.sweep.projetos.erroMoverTarefa'));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['projeto-tarefas', projetoId] });
    },
  });
}

/* ---------- Comentários ---------- */
export function useTarefaComentarios(tarefaId: string | undefined) {
  return useQuery({
    queryKey: ['tarefa-comentarios', tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tarefa_comentarios' as any)
        .select('*')
        .eq('tarefa_id', tarefaId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoTarefaComentario[];
    },
  });
}

export function useAddComentario(tarefaId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (conteudo: string) => {
      const { error } = await supabase
        .from('projeto_tarefa_comentarios' as any)
        .insert({ tarefa_id: tarefaId, user_id: user!.id, conteudo } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefa-comentarios', tarefaId] }),
    onError: (err: any) => toast.error(err.message || tGlobal('cardsKpi.sweep.projetos.erroComentar')),
  });
}

/* ---------- Checklist ---------- */
export function useTarefaChecklist(tarefaId: string | undefined) {
  return useQuery({
    queryKey: ['tarefa-checklist', tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tarefa_checklist' as any)
        .select('*')
        .eq('tarefa_id', tarefaId!)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoTarefaChecklist[];
    },
  });
}

export function useChecklistMutations(tarefaId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tarefa-checklist', tarefaId] });

  const add = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase
        .from('projeto_tarefa_checklist' as any)
        .insert({ tarefa_id: tarefaId, texto } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await supabase
        .from('projeto_tarefa_checklist' as any)
        .update({ concluido } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_tarefa_checklist' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, toggle, remove };
}

/* ---------- Vínculos GRC ---------- */
export function useTarefaVinculos(tarefaId: string | undefined) {
  return useQuery({
    queryKey: ['tarefa-vinculos', tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tarefa_vinculos' as any)
        .select('*')
        .eq('tarefa_id', tarefaId!);
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoTarefaVinculo[];
    },
  });
}

export function useVinculoMutations(tarefaId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tarefa-vinculos', tarefaId] });

  const add = useMutation({
    mutationFn: async ({ entidade_tipo, entidade_id }: { entidade_tipo: ProjetoVinculoEntidade; entidade_id: string }) => {
      const { error } = await supabase
        .from('projeto_tarefa_vinculos' as any)
        .insert({ tarefa_id: tarefaId, entidade_tipo, entidade_id, criado_por: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: any) => toast.error(err.message || tGlobal('cardsKpi.sweep.projetos.erroVincular')),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_tarefa_vinculos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}

/* ---------- Membros ---------- */
export function useProjetoMembros(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto-membros', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_membros' as any)
        .select('*')
        .eq('projeto_id', projetoId!);
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoMembro[];
    },
  });
}

/* ---------- Tarefas por entidade GRC (reverso) ---------- */
export function useTarefasVinculadas(entidadeTipo: ProjetoVinculoEntidade | undefined, entidadeId: string | undefined) {
  return useQuery({
    queryKey: ['tarefas-vinculadas', entidadeTipo, entidadeId],
    enabled: !!entidadeTipo && !!entidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tarefa_vinculos' as any)
        .select('tarefa_id, projeto_tarefas:tarefa_id(id, projeto_id, titulo, prioridade, prazo, concluida_em, responsavel_id, coluna_id)')
        .eq('entidade_tipo', entidadeTipo!)
        .eq('entidade_id', entidadeId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
