import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProjetoTarefa } from '@/types/projetos';
import type { Dependencia } from '@/lib/projeto-cronograma';
import { undoableAction } from '@/lib/undoable-action';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { tGlobal } from '@/lib/i18n-global';
import { mensagemErroTarefa } from '@/lib/projeto-evidencias';

/** Dependências entre tarefas do projeto (RLS: can_access_tarefa). */
export function useDependenciasProjeto(projetoId: string | undefined, tarefaIds: string[]) {
  const chave = tarefaIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['projeto-dependencias', projetoId, chave],
    enabled: !!projetoId && tarefaIds.length > 0,
    queryFn: async () => {
      const out: Dependencia[] = [];
      for (let i = 0; i < tarefaIds.length; i += 150) {
        const { data, error } = await supabase
          .from('projeto_tarefa_dependencias' as any)
          .select('tarefa_id, depende_de_tarefa_id, tipo')
          .in('tarefa_id', tarefaIds.slice(i, i + 150));
        if (error) throw error;
        out.push(...((data ?? []) as unknown as Dependencia[]));
      }
      const ids = new Set(tarefaIds);
      return out.filter((d) => ids.has(d.depende_de_tarefa_id));
    },
  });
}

export type PatchTarefa = { id: string } & Partial<Pick<ProjetoTarefa, 'data_inicio' | 'data_fim' | 'responsavel_id' | 'coluna_id'>>;

/**
 * Atualiza várias tarefas do projeto com efeito imediato na tela e "Desfazer"
 * durante alguns segundos; só grava quando o aviso fecha.
 */
export function useAtualizarTarefas(projetoId: string | undefined) {
  const qc = useQueryClient();
  const key = ['projeto-tarefas', projetoId];
  return (patches: PatchTarefa[], mensagem: string) => {
    if (!projetoId || !patches.length) return Promise.resolve(false);
    const antes = qc.getQueryData<ProjetoTarefa[]>(key);
    const porId = new Map(patches.map((p) => [p.id, p]));
    return undoableAction({
      message: mensagem,
      undoLabel: tGlobal('p3Projetos.cronograma.desfazer'),
      durationMs: 4000,
      onHide: () => qc.setQueryData<ProjetoTarefa[]>(key, (old) => (old ?? []).map((t) => (porId.has(t.id) ? { ...t, ...porId.get(t.id)! } : t))),
      onRestore: () => qc.setQueryData<ProjetoTarefa[] | undefined>(key, antes),
      onCommit: async () => {
        for (const { id, ...campos } of patches) {
          const linha: Record<string, unknown> = { ...campos };
          if ('data_fim' in campos) linha.prazo = campos.data_fim;
          const { error } = await supabase.from('projeto_tarefas' as any).update(linha as any).eq('id', id).eq('projeto_id', projetoId);
          if (error) throw error;
        }
        qc.invalidateQueries({ queryKey: key });
      },
    }).catch((e) => {
      logger.error('Falha ao atualizar tarefas', e);
      toast.error(mensagemErroTarefa(e, tGlobal('p3Projetos.cronograma.erroSalvar')));
      return false;
    });
  };
}

export function useSalvarLinhaBase(projetoId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('salvar_linha_base_projeto' as any, { _projeto_id: projetoId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto-tarefas', projetoId] });
      toast.success(tGlobal('p3Projetos.cronograma.linhaBaseSalva'));
    },
    onError: (e) => { logger.error('Linha de base', e); toast.error(tGlobal('p3Projetos.cronograma.erroSalvar')); },
  });
}


/** Dependências de uma tarefa (inserir/remover). RLS: can_access_tarefa. */
export function useMutarDependencia(projetoId: string | undefined) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['projeto-dependencias', projetoId] });
  const add = useMutation({
    mutationFn: async ({ tarefaId, dependeDe }: { tarefaId: string; dependeDe: string }) => {
      const { error } = await supabase.from('projeto_tarefa_dependencias' as any)
        .insert({ tarefa_id: tarefaId, depende_de_tarefa_id: dependeDe, tipo: 'FS' } as any);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => { logger.error('dependencia add', e); toast.error(e?.message || tGlobal('p3Projetos.feedback.error')); },
  });
  const remove = useMutation({
    mutationFn: async ({ tarefaId, dependeDe }: { tarefaId: string; dependeDe: string }) => {
      const { error } = await supabase.from('projeto_tarefa_dependencias' as any)
        .delete().eq('tarefa_id', tarefaId).eq('depende_de_tarefa_id', dependeDe);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => { logger.error('dependencia remove', e); toast.error(e?.message || tGlobal('p3Projetos.feedback.error')); },
  });
  return { add, remove };
}
