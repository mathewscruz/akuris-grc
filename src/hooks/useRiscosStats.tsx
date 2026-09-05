import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { readAllPages } from "@/lib/read-all-pages";
import { norm as normalizeStatus } from "@/lib/metrics";
import { useMatrizConfigEmpresa } from "@/hooks/useMatrizConfigEmpresa";
import { apetiteScoreDaConfig } from "@/components/riscos/matriz-config";
import {
  contarRiscosPorSeveridade,
  isAcimaDoApetite,
  isRevisaoVencida,
  isRevisaoProxima,
  estadoRisco,
} from "@/lib/metrics";

export interface RiscosStats {
  total: number;
  /** Severidade *inerente* (nivel_risco_inicial) — o risco antes dos controlos. */
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
  /**
   * Severidade *residual* — o que sobra depois dos controlos, caindo na
   * inerente quando ainda não houve avaliação residual. É esta a base do
   * contador de alertas críticos, por isso o dashboard usa-a para não
   * apresentar duas definições de "crítico" no mesmo ecrã.
   */
  tratamentos_pendentes: number;
  tratamentos_andamento: number;
  tratamentos_concluidos: number;
  aceitos: number;
  tratados: number;
  /** Riscos acima do apetite da matriz vigente. Menor é melhor. */
  acimaApetite: number;
  /** Riscos avaliados — o denominador de `acimaApetite`. */
  avaliados: number;
  variacao7dias: number | null;
  revisoes_vencidas: number;
  revisoes_proximas: number;
  // Tendências 7 dias
  total_7d_atras: number | null;
  criticos_7d_atras: number | null;
  tratamentos_concluidos_7d_atras: number | null;
  aceitos_7d_atras: number | null;
}

/*
  `scoreAtual` era a MÉDIA de 100/75/50/25 por severidade — a mesma métrica
  que o painel tinha e que se eliminou de lá: sendo média, cadastrar riscos
  baixos melhorava o número, e o PDF exportado desenhava uma barra de
  progresso a subir enquanto a carteira piorava.

  Passa a ser a contagem de riscos acima do apetite, como em todo o resto.
*/

export const useRiscosStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { data: matriz } = useMatrizConfigEmpresa();
  const apetite = apetiteScoreDaConfig(matriz);

  return useQuery({
    queryKey: ['riscos-stats', empresaId, apetite],
    queryFn: async ({ signal }): Promise<RiscosStats> => {
      const hoje = new Date();
      // Buscar riscos atuais
      const { data: riscos, error: riscosError } = await readAllPages((from, to) => supabase
        .from('riscos')
        .select(`
          id,
          nivel_risco_inicial,
          nivel_risco_residual,
          severidade_efetiva,
          score_efetivo,
          aceito,
          created_at,
          updated_at,
          data_proxima_revisao
        `)
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      if (riscosError) throw riscosError;

      // Current rows cannot reconstruct historical states. Trends stay unavailable;
      // the dashboard timeline reads append-only evaluation history instead.
      const contagem = contarRiscosPorSeveridade(riscos as any[]);

      const newStats: RiscosStats = {
        total: contagem.total,
        criticos: contagem.criticos,
        altos: contagem.altos,
        medios: contagem.medios,
        baixos: contagem.baixos,
        tratamentos_pendentes: 0,
        tratamentos_andamento: 0,
        tratamentos_concluidos: 0,
        aceitos: (riscos || []).filter(r => estadoRisco(r as any) === 'aceito').length,
        tratados: (riscos || []).filter(r => estadoRisco(r as any) === 'tratado').length,
        acimaApetite: 0,
        avaliados: 0,
        variacao7dias: null,
        revisoes_vencidas: 0,
        revisoes_proximas: 0,
        total_7d_atras: null,
        criticos_7d_atras: null,
        tratamentos_concluidos_7d_atras: null,
        aceitos_7d_atras: null,
      };

      // Revisões vencidas e próximas (predicados da camada de métricas)
      newStats.revisoes_vencidas = (riscos || []).filter(r => isRevisaoVencida(r as any, hoje)).length;
      newStats.revisoes_proximas = (riscos || []).filter(r => isRevisaoProxima(r as any, hoje)).length;

      // Exposição da carteira: quantos riscos excedem o apetite
      if (riscos && riscos.length > 0) {
        const avaliados = riscos.filter((r) => r.score_efetivo !== null);
        newStats.avaliados = avaliados.length;
        newStats.acimaApetite = avaliados.filter((r) => isAcimaDoApetite(r, apetite)).length;

      }


      // Buscar estatísticas de tratamentos
      if (riscos && riscos.length > 0) {
        const { data: tratamentos, error: tratamentosError } = await readAllPages((from, to) => supabase
          .from('riscos_tratamentos')
          .select('status, risco_id, riscos!inner(empresa_id)')
          .eq('riscos.empresa_id', empresaId!)
          .order('id').range(from, to).abortSignal(signal), signal);

        if (tratamentosError) throw tratamentosError;
        if (tratamentos) {
          newStats.tratamentos_pendentes = tratamentos.filter(t => normalizeStatus(t.status) === 'pendente').length;
          newStats.tratamentos_andamento = tratamentos.filter(t => normalizeStatus(t.status) === 'em_andamento').length;
          newStats.tratamentos_concluidos = tratamentos.filter(t => normalizeStatus(t.status) === 'concluido').length;
        }
      }

      return newStats;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });
};
