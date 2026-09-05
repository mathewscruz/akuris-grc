import { readAllPages } from "@/lib/read-all-pages";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { contarControles, efetividadeControles, proporcaoPreventivos } from "@/lib/metrics";

interface ControlesStats {
  total: number;
  ativos: number;
  inativos: number;
  emRevisao: number;
  descontinuados: number;
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
  preventivos: number;
  detectivos: number;
  corretivos: number;
  vencendoAvaliacao: number;
  vencidos: number;
  /** null = ainda não há testes de controlo registados. */
  efetividade: number | null;
  controlesTestados: number;
  percentualPreventivos: number | null;
}

export const useControlesStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['controles-stats', empresaId],
    staleTime: 5 * 60 * 1000,
    enabled: !!empresaId,
    queryFn: async ({ signal }): Promise<ControlesStats> => {
      const { data: controles, error } = await readAllPages((from, to) => supabase
        .from('controles')
        .select('id, status, criticidade, tipo, proxima_avaliacao')
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      if (error) throw error;

      const { data: testes } = await readAllPages((from, to) => supabase
        .from('controles_testes')
        .select('controle_id, resultado, data_teste, controles!inner(empresa_id)')
        .eq('controles.empresa_id', empresaId!)
        .order('id').range(from, to).abortSignal(signal), signal);

      const efetividade = efetividadeControles(controles, testes as any[]);
      const preventivos = proporcaoPreventivos(controles);

      return {
        ...contarControles(controles),
        efetividade: efetividade.percentual,
        controlesTestados: efetividade.controlesTestados,
        percentualPreventivos: preventivos.percentual,
      };
    },
  });
};
