import { readAllPages } from "@/lib/read-all-pages";
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
  /**
   * Os mesmos dois valores separados por moeda.
   *
   * Os escalares acima somam contratos em moedas diferentes num número
   * só, e o ecrã carimbava-lhe a moeda da empresa: três contratos
   * gravados em BRL apareciam como «276 mil €». Quem mostra valor deve
   * usar estes.
   */
  valorTotalPorMoeda: Record<string, number>;
  valorVencidoPorMoeda: Record<string, number>;
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
    queryFn: async ({ signal }): Promise<ContratosStats> => {
      const { data: contratos, error } = await readAllPages((from, to) => supabase
        .from('contratos')
        .select('status, valor, moeda, data_fim, renovacao_automatica, fornecedor_id')
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      if (error) throw error;

      const { data: fornecedores } = await readAllPages((from, to) => supabase
        .from('fornecedores')
        .select('id')
        .eq('status', 'ativo')
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      const base = contarContratos(contratos);

      return {
        total: base.total,
        ativos: base.vigentes,
        vencidos: base.vencidos,
        vencendo30Dias: base.aVencer30,
        valorTotal: base.valorVigente,
        valorVencido: base.valorVencido,
        valorTotalPorMoeda: base.valorVigentePorMoeda,
        valorVencidoPorMoeda: base.valorVencidoPorMoeda,
        renovacaoAutomatica: base.renovacaoAutomatica,
        fornecedoresAtivos: fornecedores?.length || 0,
      };
    },
  });
};
