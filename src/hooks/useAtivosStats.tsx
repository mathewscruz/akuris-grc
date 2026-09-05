import { readAllPages } from "@/lib/read-all-pages";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { contarAtivos, pct } from "@/lib/metrics";

interface AtivosStats {
  total: number;
  ativos: number;
  inativos: number;
  descontinuados: number;
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
  altoValorNegocio: number;
  percentualAltoValor: number;
  /** Ativos com o valor de negócio preenchido — cobertura da classificação. */
  classificados: number;
}

export const useAtivosStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['ativos-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }): Promise<AtivosStats> => {
      const { data: ativos, error } = await readAllPages((from, to) => supabase
        .from('ativos')
        .select('status, criticidade, valor_negocio')
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      if (error) throw error;

      const base = contarAtivos(ativos);
      return {
        ...base,
        percentualAltoValor: pct(base.altoValorNegocio, base.total) ?? 0,
      };
    },
  });
};
