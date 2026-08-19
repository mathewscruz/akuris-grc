import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";
import { useAuth } from "@/components/AuthProvider";
import { parseDataLocal } from '@/lib/date-utils';

interface LicencasStats {
  total: number;
  ativas: number;
  vencidas: number;
  vencendo30dias: number;
  custoTotalAnual: number;
  porTipo: Record<string, number>;
  porCriticidade: Record<string, number>;
}

export const useLicencasStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['licencas-stats', empresaId],
    queryFn: async (): Promise<LicencasStats> => {
      const { data: licencas, error } = await supabase
        .from('ativos_licencas')
        .select('*')
        .eq('empresa_id', empresaId!);

      if (error) throw error;

      const hoje = new Date();
      const total = licencas?.length || 0;
      const ativas = licencas?.filter(l => l.status === 'ativa').length || 0;
      
      const vencidas = licencas?.filter(l => {
        if (!l.data_vencimento) return false;
        return differenceInCalendarDays(parseDataLocal(l.data_vencimento), hoje) < 0;
      }).length || 0;

      const vencendo30dias = licencas?.filter(l => {
        if (!l.data_vencimento) return false;
        const dias = differenceInCalendarDays(parseDataLocal(l.data_vencimento), hoje);
        return dias >= 0 && dias <= 30;
      }).length || 0;

      const custoTotalAnual = licencas?.reduce((sum, l) => {
        if (l.periodicidade === 'anual') return sum + (l.valor_renovacao || l.valor_aquisicao || 0);
        if (l.periodicidade === 'mensal') return sum + (l.valor_renovacao || 0) * 12;
        return sum;
      }, 0) || 0;

      const porTipo: Record<string, number> = {};
      const porCriticidade: Record<string, number> = {};

      licencas?.forEach(l => {
        porTipo[l.tipo_licenca] = (porTipo[l.tipo_licenca] || 0) + 1;
        porCriticidade[l.criticidade] = (porCriticidade[l.criticidade] || 0) + 1;
      });

      return {
        total,
        ativas,
        vencidas,
        vencendo30dias,
        custoTotalAnual,
        porTipo,
        porCriticidade
      };
    },
    enabled: !!empresaId,
  });
};
