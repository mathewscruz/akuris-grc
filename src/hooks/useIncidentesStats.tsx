import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { contarIncidentes } from "@/lib/metrics";

interface IncidentesStats {
  total: number;
  abertos: number;
  investigacao: number;
  contidos: number;
  emCurso: number;
  resolvidos: number;
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
  mes: number;
}

export const useIncidentesStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['incidentes-stats', empresaId],
    staleTime: 5 * 60 * 1000,
    enabled: !!empresaId,
    queryFn: async (): Promise<IncidentesStats> => {
      const { data: incidentes, error } = await supabase
        .from('incidentes')
        .select('status, criticidade, created_at')
        .eq('empresa_id', empresaId!);

      if (error) throw error;

      const base = contarIncidentes(incidentes);

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const mes = incidentes?.filter(i => new Date(i.created_at) >= inicioMes).length || 0;

      return { ...base, mes };
    },
  });
};
