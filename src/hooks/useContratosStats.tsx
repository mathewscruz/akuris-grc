import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { contarContratos } from "@/lib/metrics";

interface ContratosStats {
  total: number;
  ativos: number;
  vencidos: number;
  vencendo30Dias: number;
  /** Valor apenas de contratos vigentes (não soma vencidos). */
  valorTotal: number;
  /** Valor preso em contratos já vencidos — mostrado à parte. */
  valorVencido: number;
  renovacaoAutomatica: number;
  fornecedoresAtivos: number;
}

export const useContratosStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['contratos-stats', empresaId],
    staleTime: 5 * 60 * 1000,
    enabled: !!empresaId,
    queryFn: async (): Promise<ContratosStats> => {
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select('status, valor, data_fim, renovacao_automatica, fornecedor_id')
        .eq('empresa_id', empresaId!);

      if (error) throw error;

      const { data: fornecedores } = await supabase
        .from('fornecedores')
        .select('id')
        .eq('status', 'ativo')
        .eq('empresa_id', empresaId!);

      const base = contarContratos(contratos);

      return {
        total: base.total,
        ativos: base.vigentes,
        vencidos: base.vencidos,
        vencendo30Dias: base.aVencer30,
        valorTotal: base.valorVigente,
        valorVencido: base.valorVencido,
        renovacaoAutomatica: base.renovacaoAutomatica,
        fornecedoresAtivos: fornecedores?.length || 0,
      };
    },
  });
};
