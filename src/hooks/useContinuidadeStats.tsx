import { readAllPages } from "@/lib/read-all-pages";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export function useContinuidadeStats() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['continuidade-stats', empresaId],
    queryFn: async ({ signal }) => {
      if (!empresaId) return { total: 0, ativos: 0, emRevisao: 0, testesRealizados: 0, planosTestados: 0, tarefasPendentes: 0 };

      const [planosRes, testesRes, tarefasRes] = await Promise.all([
        readAllPages((from, to) => supabase.from('continuidade_planos').select('id, status').eq('empresa_id', empresaId).order('id').range(from, to).abortSignal(signal), signal),
        readAllPages((from, to) => supabase.from('continuidade_testes').select('id, plano_id').eq('empresa_id', empresaId).order('id').range(from, to).abortSignal(signal), signal),
        readAllPages((from, to) => supabase.from('continuidade_tarefas').select('id, status').eq('empresa_id', empresaId).order('id').range(from, to).abortSignal(signal), signal),
      ]);

      for (const result of [planosRes, testesRes, tarefasRes]) if (result.error) throw result.error;
      const planos = planosRes.data || [];
      const testes = testesRes.data || [];
      const tarefas = tarefasRes.data || [];

      return {
        total: planos.length,
        ativos: planos.filter(p => p.status === 'ativo').length,
        emRevisao: planos.filter(p => p.status === 'em_revisao').length,
        testesRealizados: testes.length,
        // Cobertura honesta: quantos planos distintos já foram testados.
        planosTestados: new Set(testes.map((t: any) => t.plano_id).filter(Boolean)).size,
        tarefasPendentes: tarefas.filter(t => t.status === 'pendente').length,
      };
    },
    enabled: !!empresaId,
  });
}
