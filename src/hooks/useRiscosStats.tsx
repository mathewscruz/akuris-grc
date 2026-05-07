import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { logger } from "@/lib/logger";

export interface RiscosStats {
  total: number;
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
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

// Função auxiliar para normalizar comparação de nível
const normalizeNivel = (nivel: string | null | undefined): string => {
  return (nivel || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Função para calcular score de risco (quanto menor, melhor)
const calcularScore = (nivel: string): number => {
  const nivelNorm = normalizeNivel(nivel);
  if (nivelNorm === 'critico' || nivelNorm === 'muito alto') return 100;
  if (nivelNorm === 'alto') return 75;
  if (nivelNorm === 'medio') return 50;
  if (nivelNorm === 'baixo') return 25;
  if (nivelNorm === 'muito baixo') return 10;
  return 0;
};

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
      const antiguosCriticos = riscosAntigos?.filter(r => {
        const nivel = normalizeNivel(r.nivel_risco_residual || r.nivel_risco_inicial);
        return nivel === 'critico' || nivel === 'muito alto';
      }).length || 0;

      const newStats: RiscosStats = {
        total: riscos?.length || 0,
        criticos: riscos?.filter(r => {
          const nivel = normalizeNivel(r.nivel_risco_inicial);
          return nivel === 'critico' || nivel === 'muito alto';
        }).length || 0,
        altos: riscos?.filter(r => normalizeNivel(r.nivel_risco_inicial) === 'alto').length || 0,
        medios: riscos?.filter(r => normalizeNivel(r.nivel_risco_inicial) === 'medio').length || 0,
        baixos: riscos?.filter(r => {
          const nivel = normalizeNivel(r.nivel_risco_inicial);
          return nivel === 'baixo' || nivel === 'muito baixo';
        }).length || 0,
        tratamentos_pendentes: 0,
        tratamentos_andamento: 0,
        tratamentos_concluidos: 0,
        aceitos: riscos?.filter(r => r.aceito).length || 0,
        tratados: riscos?.filter(r => r.nivel_risco_residual).length || 0,
        scoreAtual: 0,
        variacao7dias: null,
        revisoes_vencidas: 0,
        revisoes_proximas: 0,
        total_7d_atras: antiguosTotal > 0 ? antiguosTotal : null,
        criticos_7d_atras: antiguosTotal > 0 ? antiguosCriticos : null,
        tratamentos_concluidos_7d_atras: null,
        aceitos_7d_atras: antiguosTotal > 0 ? (riscosAntigos?.filter(r => (r as any).aceito).length || 0) : null,
      };

      // Calcular revisões vencidas e próximas
      const hojeDate = new Date();
      (riscos || []).forEach(r => {
        const dataRevisao = (r as any).data_proxima_revisao;
        if (dataRevisao) {
          const dias = Math.ceil((new Date(dataRevisao).getTime() - hojeDate.getTime()) / (1000 * 60 * 60 * 24));
          if (dias < 0) newStats.revisoes_vencidas++;
          else if (dias <= 7) newStats.revisoes_proximas++;
        }
      });

      // Calcular score atual
      if (riscos && riscos.length > 0) {
        const somaScores = riscos.reduce((acc, r) => {
          const nivel = r.nivel_risco_residual || r.nivel_risco_inicial;
          return acc + calcularScore(nivel);
        }, 0);
        newStats.scoreAtual = Math.round(somaScores / riscos.length);

        if (riscosAntigos && riscosAntigos.length > 0) {
          const somaScoresAntigos = riscosAntigos.reduce((acc, r) => {
            const nivel = r.nivel_risco_residual || r.nivel_risco_inicial;
            return acc + calcularScore(nivel);
          }, 0);
          const scoreAntigo = somaScoresAntigos / riscosAntigos.length;
          const variacao = ((scoreAntigo - newStats.scoreAtual) / scoreAntigo) * 100;
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
