import { readAllPages } from "@/lib/read-all-pages";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { parseDataLocal } from '@/lib/date-utils';

export interface ProjetoStats {
  totalProjetos: number;
  projetosAtivos: number;
  totalTarefas: number;
  tarefasAbertas: number;
  tarefasConcluidas: number;
  tarefasAtrasadas: number;
}

export function useProjetoStats() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['projeto-stats', empresaId],
    enabled: !!empresaId,
    queryFn: async ({ signal }): Promise<ProjetoStats> => {
      const { data: projetos, error: projectsError } = await readAllPages((from, to) => supabase
        .from('projetos' as any)
        .select('id, status')
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      if (projectsError) throw projectsError;
      const projetosArr = ((projetos ?? []) as any[]).map((p) => p as { id: string; status: string });
      const projetoIds = projetosArr.map((p) => p.id);

      let tar: { id: string; prazo: string | null; concluida_em: string | null }[] = [];
      if (projetoIds.length) {
        const { data, error } = await readAllPages((from, to) => supabase
          .from('projeto_tarefas' as any)
          .select('id, prazo, concluida_em, projetos!inner(empresa_id)')
          .eq('projetos.empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);
        if (error) throw error;
        tar = ((data ?? []) as any[]) as typeof tar;
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const tarefasAtrasadas = tar.filter(
        (t) => t.prazo && !t.concluida_em && parseDataLocal(t.prazo) < now
      ).length;
      const tarefasConcluidas = tar.filter((t) => t.concluida_em).length;
      const tarefasAbertas = tar.length - tarefasConcluidas;

      return {
        totalProjetos: projetosArr.length,
        projetosAtivos: projetosArr.filter((p) => p.status === 'ativo').length,
        totalTarefas: tar.length,
        tarefasAbertas,
        tarefasConcluidas,
        tarefasAtrasadas,
      };
    },
  });
}
