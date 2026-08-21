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
  /** Severidade do que ainda está em curso — o que é exposição de hoje. */
  criticosEmCurso: number;
  altosEmCurso: number;
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
        .select('status, criticidade, created_at, data_deteccao')
        .eq('empresa_id', empresaId!);

      if (error) throw error;

      const base = contarIncidentes(incidentes);

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      // Conta por DETEÇÃO, não por criação do registo.
      //
      // Contava `created_at`, que é quando alguém digitou o incidente no
      // sistema. Com três incidentes detetados em julho e agosto mas semeados
      // todos no mesmo dia, o cartão dizia "Este Mês: 3" mesmo ao lado de uma
      // tabela cuja coluna "Data Deteção" mostrava duas datas de julho.
      //
      // A pergunta que a equipa de segurança faz é quantos incidentes
      // ACONTECERAM este mês; `created_at` mede atividade de digitação.
      const mes = incidentes?.filter(
        (i) => new Date(i.data_deteccao ?? i.created_at) >= inicioMes,
      ).length || 0;

      return { ...base, mes };
    },
  });
};
