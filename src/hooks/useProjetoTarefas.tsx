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
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

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
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projeto-tarefas', vars.projeto_id] });
      toast.success('Tarefa salva');
    },
    onError: (err: any) => {
      logger.error('Erro ao salvar tarefa', err);
      toast.error(err.message || 'Erro ao salvar tarefa');
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
    onError: (err: any) => toast.error(err.message || 'Erro ao remover'),
  });
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
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['projeto-tarefas', projetoId], ctx.prev);
      toast.error('Falha ao mover tarefa');
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
    onError: (err: any) => toast.error(err.message || 'Erro ao comentar'),
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
    onError: (err: any) => toast.error(err.message || 'Erro ao vincular'),
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
