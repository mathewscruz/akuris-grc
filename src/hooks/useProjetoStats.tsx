import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

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
    queryFn: async (): Promise<ProjetoStats> => {
      const [{ data: projetos }, { data: tarefas }] = await Promise.all([
        supabase.from('projetos' as any).select('id, status').eq('empresa_id', empresaId!),
        supabase
          .from('projeto_tarefas' as any)
          .select('id, prazo, concluida_em, projeto_id, projetos:projeto_id!inner(empresa_id)')
          .eq('projetos.empresa_id' as any, empresaId!),
      ]);

      const proj = (projetos ?? []) as any[];
      const tar = (tarefas ?? []) as any[];
      const now = new Date();

      const tarefasAtrasadas = tar.filter(
        (t) => t.prazo && !t.concluida_em && new Date(t.prazo) < now
      ).length;
      const tarefasConcluidas = tar.filter((t) => t.concluida_em).length;
      const tarefasAbertas = tar.length - tarefasConcluidas;

      return {
        totalProjetos: proj.length,
        projetosAtivos: proj.filter((p) => p.status === 'ativo').length,
        totalTarefas: tar.length,
        tarefasAbertas,
        tarefasConcluidas,
        tarefasAtrasadas,
      };
    },
  });
}
