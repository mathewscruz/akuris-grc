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
}

export const useAtivosStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['ativos-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AtivosStats> => {
      const { data: ativos, error } = await supabase
        .from('ativos')
        .select('status, criticidade, valor_negocio')
        .eq('empresa_id', empresaId!);

      if (error) throw error;

      const base = contarAtivos(ativos);
      return {
        ...base,
        percentualAltoValor: pct(base.altoValorNegocio, base.total) ?? 0,
      };
    },
  });
};
