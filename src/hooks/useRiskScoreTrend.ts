/**
 * useRiskScoreTrend — série temporal REAL do score de risco consolidado.
 *
 * Diferente da versão anterior (que somava o score ATUAL de cada risco em todos
 * os meses desde a criação — logo nunca mostrava redução), aqui o score de cada
 * mês reflete a avaliação vigente naquele momento:
 *   score(risco, mês M) = P×I da avaliação mais recente com created_at ≤ fim de M
 *                          (fallback: P×I inicial do risco, sua linha de base).
 * Assim, quando um risco é reavaliado para baixo, a curva realmente cai no mês
 * da reavaliação. Fonte: riscos_historico_avaliacoes.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { scoreFromPI } from '@/components/riscos/risk-utils';

const MONTH_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface TrendPoint {
  label: string;
  score: number;
  count: number;
}

interface RiscoBase {
  id: string;
  created_at: string;
  probabilidade_inicial: string | null;
  impacto_inicial: string | null;
}

interface Avaliacao {
  risco_id: string;
  created_at: string;
  probabilidade: string | null;
  impacto: string | null;
}

/** Retorna 12 pontos mensais (mais antigo → atual). O gráfico recorta a janela desejada. */
export function useRiskScoreTrend() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['risco-score-trend', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TrendPoint[]> => {
      const { data: riscos, error } = await supabase
        .from('riscos')
        .select('id, created_at, probabilidade_inicial, impacto_inicial')
        .eq('empresa_id', empresaId!);
      if (error) throw error;

      const riscoList = (riscos || []) as RiscoBase[];
      const ids = riscoList.map((r) => r.id);

      let historico: Avaliacao[] = [];
      if (ids.length > 0) {
        const { data: hist } = await supabase
          .from('riscos_historico_avaliacoes')
          .select('risco_id, created_at, probabilidade, impacto')
          .in('risco_id', ids)
          .order('created_at', { ascending: true });
        historico = (hist || []) as Avaliacao[];
      }

      // Avaliações agrupadas por risco (já ordenadas asc por created_at)
      const histByRisco = new Map<string, Avaliacao[]>();
      historico.forEach((h) => {
        const arr = histByRisco.get(h.risco_id) || [];
        arr.push(h);
        histByRisco.set(h.risco_id, arr);
      });

      const now = new Date();
      const points: TrendPoint[] = [];
      for (let back = 11; back >= 0; back--) {
        // fim do mês (exclusivo): primeiro dia do mês seguinte
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
        const labelDate = new Date(now.getFullYear(), now.getMonth() - back, 1);

        let total = 0;
        let count = 0;
        for (const r of riscoList) {
          if (new Date(r.created_at) >= monthEnd) continue; // ainda não existia
          const avals = histByRisco.get(r.id);
          let score: number | null = null;
          if (avals && avals.length > 0) {
            // última avaliação com created_at < monthEnd
            for (let k = avals.length - 1; k >= 0; k--) {
              if (new Date(avals[k].created_at) < monthEnd) {
                score = scoreFromPI(avals[k].probabilidade, avals[k].impacto);
                break;
              }
            }
          }
          if (score === null) {
            // sem avaliação registrada até o mês → linha de base (P×I inicial)
            score = scoreFromPI(r.probabilidade_inicial, r.impacto_inicial);
          }
          if (score > 0) {
            total += score;
            count += 1;
          }
        }
        points.push({ label: MONTH_PT[labelDate.getMonth()], score: total, count });
      }
      return points;
    },
  });
}
