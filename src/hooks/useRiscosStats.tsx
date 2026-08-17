import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { logger } from "@/lib/logger";
import {
  contarRiscosPorSeveridade,
  severidadeRiscoEfetiva,
  isRiscoCritico,
  isRevisaoVencida,
  isRevisaoProxima,
  estadoRisco,
  type Severidade,
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
  criticosEfetivos: number;
  altosEfetivos: number;
  tratamentos_pendentes: number;
  tratamentos_andamento: number;
  tratamentos_concluidos: number;
  aceitos: number;
  tratados: number;
  scoreAtual: number;
  variacao7dias: number | null;
  revisoes_vencidas: number;
  revisoes_proximas: number;
  // Tendências 7 dias
  total_7d_atras: number | null;
  criticos_7d_atras: number | null;
  tratamentos_concluidos_7d_atras: number | null;
  aceitos_7d_atras: number | null;
}

// Score derivado da severidade canónica (camada única de métricas).
const SCORE_SEVERIDADE: Record<Severidade, number> = {
  critico: 100,
  alto: 75,
  medio: 50,
  baixo: 25,
  indefinido: 0,
};
const calcularScore = (r: any): number => SCORE_SEVERIDADE[severidadeRiscoEfetiva(r)];

export const useRiscosStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['riscos-stats', empresaId],
    queryFn: async (): Promise<RiscosStats> => {
      const hoje = new Date();
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 7);

      // Buscar riscos atuais
      const { data: riscos, error: riscosError } = await supabase
        .from('riscos')
        .select(`
          id,
          nivel_risco_inicial,
          nivel_risco_residual,
          aceito,
          created_at,
          updated_at,
          data_proxima_revisao
        `)
        .eq('empresa_id', empresaId!);

      if (riscosError) throw riscosError;

      // Buscar riscos que existiam há 7 dias
      const { data: riscosAntigos, error: riscosAntigosError } = await supabase
        .from('riscos')
        .select('nivel_risco_inicial, nivel_risco_residual')
        .eq('empresa_id', empresaId!)
        .lte('created_at', seteDiasAtras.toISOString());

      if (riscosAntigosError) logger.error('Erro ao buscar riscos antigos', { data: riscosAntigosError, module: 'riscos' });

      const antiguosTotal = riscosAntigos?.length || 0;
      const antiguosCriticos = (riscosAntigos || []).filter(r => isRiscoCritico(r as any)).length;

      const contagem = contarRiscosPorSeveridade(riscos as any[]);

      const newStats: RiscosStats = {
        total: contagem.total,
        criticos: contagem.criticos,
        altos: contagem.altos,
        medios: contagem.medios,
        baixos: contagem.baixos,
        criticosEfetivos: (riscos || []).filter(r => severidadeRiscoEfetiva(r as any) === 'critico').length,
        altosEfetivos: (riscos || []).filter(r => severidadeRiscoEfetiva(r as any) === 'alto').length,
        tratamentos_pendentes: 0,
        tratamentos_andamento: 0,
        tratamentos_concluidos: 0,
        aceitos: (riscos || []).filter(r => estadoRisco(r as any) === 'aceito').length,
        tratados: (riscos || []).filter(r => estadoRisco(r as any) === 'tratado').length,
        scoreAtual: 0,
        variacao7dias: null,
        revisoes_vencidas: 0,
        revisoes_proximas: 0,
        total_7d_atras: antiguosTotal > 0 ? antiguosTotal : null,
        criticos_7d_atras: antiguosTotal > 0 ? antiguosCriticos : null,
        tratamentos_concluidos_7d_atras: null,
        aceitos_7d_atras: antiguosTotal > 0 ? (riscosAntigos?.filter(r => (r as any).aceito).length || 0) : null,
      };

      // Revisões vencidas e próximas (predicados da camada de métricas)
      newStats.revisoes_vencidas = (riscos || []).filter(r => isRevisaoVencida(r as any, hoje)).length;
      newStats.revisoes_proximas = (riscos || []).filter(r => isRevisaoProxima(r as any, hoje)).length;

      // Calcular score atual
      if (riscos && riscos.length > 0) {
        const somaScores = riscos.reduce((acc, r) => acc + calcularScore(r), 0);
        newStats.scoreAtual = Math.round(somaScores / riscos.length);

        if (riscosAntigos && riscosAntigos.length > 0) {
          const somaScoresAntigos = riscosAntigos.reduce((acc, r) => acc + calcularScore(r), 0);
          const scoreAntigo = somaScoresAntigos / riscosAntigos.length;
          const variacao = scoreAntigo > 0 ? ((scoreAntigo - newStats.scoreAtual) / scoreAntigo) * 100 : 0;
          newStats.variacao7dias = Math.round(variacao);
        }
      }


      // Buscar estatísticas de tratamentos
      if (riscos && riscos.length > 0) {
        const { data: tratamentos, error: tratamentosError } = await supabase
          .from('riscos_tratamentos')
          .select('status, risco_id')
          .in('risco_id', riscos.map(r => r.id));

        if (tratamentosError) {
          logger.error('Erro ao buscar tratamentos', { data: tratamentosError, module: 'riscos' });
        } else if (tratamentos) {
          newStats.tratamentos_pendentes = tratamentos.filter(t => t.status === 'pendente').length;
          newStats.tratamentos_andamento = tratamentos.filter(t => t.status === 'em andamento').length;
          newStats.tratamentos_concluidos = tratamentos.filter(t => t.status === 'concluído').length;
        }
      }

      return newStats;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });
};
