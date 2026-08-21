/**
 * useRiskScoreTrend — evolução da exposição da carteira, mês a mês.
 *
 * A métrica mudou. Antes esta série era a SOMA dos P×I de todos os riscos, e o
 * gráfico desenhava por cima uma linha de referência com o limite de apetite,
 * que é um limiar POR RISCO: o cabeçalho lia-se "131 / apetite 16" e a linha
 * ficava colada ao eixo, permanentemente ultrapassada. Uma soma também sobe só
 * por se cadastrarem riscos — cresce quando a gestão de risco está a funcionar.
 *
 * O painel tinha ainda uma terceira métrica, um índice 0–100 ponderado por
 * severidade, que era uma média: acrescentar riscos baixos MELHORAVA o número.
 *
 * Passa a ser uma só, e a que o conselho pergunta: **quantos riscos estão
 * acima do apetite**. Cada ponto usa a avaliação vigente naquele mês
 * (`riscos_historico_avaliacoes`), por isso tratar um risco faz a curva descer.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useMatrizConfigEmpresa } from '@/hooks/useMatrizConfigEmpresa';
import { apetiteScoreDaConfig } from '@/components/riscos/matriz-config';

const MONTH_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface TrendPoint {
  label: string;
  /**
   * Score médio da carteira no fim daquele mês — a curva que se desenha.
   *
   * "Acima do apetite" é a métrica certa para o KPI e para o alerta, mas é uma
   * contagem pequena e quase sempre plana: com um risco acima do limite, a
   * curva é uma linha reta em 1 e não mostra evolução nenhuma. O score médio
   * move-se a cada reavaliação, que é o que um gráfico de tendência tem de
   * mostrar — e desce quando a carteira melhora, porque cada ponto usa a
   * avaliação VIGENTE naquele mês e não a de hoje.
   */
  scoreMedio: number | null;
  /** Riscos acima do apetite no fim daquele mês. */
  acimaApetite: number;
  /** Riscos avaliados existentes no fim daquele mês — o denominador. */
  total: number;
}

interface RiscoBase {
  id: string;
  created_at: string;
  score_inicial: number | null;
}

interface Avaliacao {
  risco_id: string;
  created_at: string;
  score: number | null;
  tipo: string | null;
}

/** Entre duas avaliações do mesmo instante, a residual é a que vigora. */
const ordemDoTipo = (tipo?: string | null) => (tipo === 'residual' ? 1 : 0);

/** Retorna 12 pontos mensais (mais antigo → atual). O gráfico recorta a janela. */
export function useRiskScoreTrend() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { data: matriz } = useMatrizConfigEmpresa();
  const apetite = apetiteScoreDaConfig(matriz);

  return useQuery({
    queryKey: ['risco-score-trend', empresaId, apetite],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TrendPoint[]> => {
      const { data: riscos, error } = await supabase
        .from('riscos')
        .select('id, created_at, score_inicial')
        .eq('empresa_id', empresaId!);
      if (error) throw error;

      const riscoList = (riscos || []) as RiscoBase[];
      const ids = riscoList.map((r) => r.id);

      let historico: Avaliacao[] = [];
      if (ids.length > 0) {
        const { data: hist } = await supabase
          .from('riscos_historico_avaliacoes')
          .select('risco_id, created_at, score, tipo')
          .in('risco_id', ids)
          .order('created_at', { ascending: true });
        historico = (hist || []) as Avaliacao[];
      }

      const histByRisco = new Map<string, Avaliacao[]>();
      historico.forEach((h) => {
        const arr = histByRisco.get(h.risco_id) || [];
        arr.push(h);
        histByRisco.set(h.risco_id, arr);
      });
      // O formulário grava inerente e residual no mesmo `insert`, com carimbo
      // igual ao microssegundo: sem este desempate a curva mostra o risco antes
      // do tratamento no mês em que ele foi tratado.
      histByRisco.forEach((lista) =>
        lista.sort((a, b) => {
          const dt = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          return dt !== 0 ? dt : ordemDoTipo(a.tipo) - ordemDoTipo(b.tipo);
        }),
      );

      const now = new Date();
      const points: TrendPoint[] = [];
      for (let back = 11; back >= 0; back--) {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
        const labelDate = new Date(now.getFullYear(), now.getMonth() - back, 1);

        let acima = 0;
        let total = 0;
        let somaScores = 0;
        for (const r of riscoList) {
          if (new Date(r.created_at) >= monthEnd) continue; // ainda não existia

          let score: number | null = null;
          const avals = histByRisco.get(r.id);
          if (avals?.length) {
            for (let k = avals.length - 1; k >= 0; k--) {
              if (new Date(avals[k].created_at) < monthEnd) {
                score = avals[k].score;
                break;
              }
            }
          }
          if (score === null) score = r.score_inicial; // linha de base

          if (score === null) continue; // risco por avaliar não conta em nenhum lado
          total += 1;
          somaScores += score;
          if (apetite !== null && score > apetite) acima += 1;
        }
        points.push({
          label: MONTH_PT[labelDate.getMonth()],
          scoreMedio: total > 0 ? Math.round((somaScores / total) * 10) / 10 : null,
          acimaApetite: acima,
          total,
        });
      }
      return points;
    },
  });
}
