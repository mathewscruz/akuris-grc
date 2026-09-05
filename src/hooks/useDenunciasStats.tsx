import { readAllPages } from "@/lib/read-all-pages";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { parseDataLocal } from "@/lib/date-utils";

interface DenunciasStats {
  total: number;
  novas: number;
  em_andamento: number;
  resolvidas: number;
  /**
   * Denúncias abertas com o prazo de retorno já ultrapassado.
   *
   * Era a única contagem que faltava e a única com consequência legal: a
   * Diretiva (UE) 2019/1937 dá três meses para dar retorno a quem denunciou,
   * e o painel do canal contava tudo menos isso. Para saber o que estava
   * vencido era preciso abrir denúncia a denúncia.
   */
  prazo_vencido: number;
}

export const useDenunciasStats = (empresaSelecionada?: string | null) => {
  const { profile } = useAuth();
  /* Numa consultoria, os números são os do canal que se está a ver. */
  const empresaId = empresaSelecionada || profile?.empresa_id;

  return useQuery({
    queryKey: ['denuncias-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }): Promise<DenunciasStats> => {
      try {
        const { data: denuncias, error } = await readAllPages((from, to) => supabase
          .from('denuncias')
          .select('id, status, prazo_retorno')
          .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

        if (error) {
          console.error('Erro ao buscar estatísticas de denúncias:', error);
          throw error;
        }

        const total = denuncias?.length || 0;
        const novas = denuncias?.filter(d => d.status === 'nova').length || 0;
        const em_andamento = denuncias?.filter(d => 
          ['em_analise', 'em_investigacao'].includes(d.status)
        ).length || 0;
        const resolvidas = denuncias?.filter(d => 
          ['resolvida', 'arquivada'].includes(d.status)
        ).length || 0;

        /* Comparado por dia, no fuso de quem vê: um prazo que vence hoje
           ainda não está vencido. */
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const prazo_vencido = (denuncias ?? []).filter((d) => {
          if (['resolvida', 'arquivada'].includes(d.status)) return false;
          if (!d.prazo_retorno) return false;
          const alvo = parseDataLocal(d.prazo_retorno);
          alvo.setHours(0, 0, 0, 0);
          return alvo.getTime() < hoje.getTime();
        }).length;

        return {
          total,
          novas,
          em_andamento,
          resolvidas,
          prazo_vencido
        };
      } catch (error) {
        console.error('Erro ao carregar estatísticas de denúncias:', error);
        throw error;
      }
    },
  });
};
