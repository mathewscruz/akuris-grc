import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

import { formatarDiaParaDB } from '@/lib/date-utils';
export const useReviewStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const query = useQuery({
    queryKey: ['review-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!empresaId) return null;

      // Total de revisões
      const { count: totalReviews } = await supabase
        .from("access_reviews")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId);

      // Revisões em andamento
      const { count: emAndamento } = await supabase
        .from("access_reviews")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "em_andamento");

      // Revisões concluídas
      const { count: concluidas } = await supabase
        .from("access_reviews")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "concluida");

      // Revisões vencidas
      const { count: vencidas } = await supabase
        .from("access_reviews")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("status", "em_andamento")
        .lt("data_limite", formatarDiaParaDB(new Date()));

      // Total de contas revisadas
      const { data: statsData } = await supabase
        .from("access_reviews")
        .select("contas_revisadas, contas_aprovadas, contas_revogadas")
        .eq("empresa_id", empresaId);

      const contasRevisadas = statsData?.reduce((acc, r) => acc + (r.contas_revisadas || 0), 0) || 0;
      const contasAprovadas = statsData?.reduce((acc, r) => acc + (r.contas_aprovadas || 0), 0) || 0;
      const contasRevogadas = statsData?.reduce((acc, r) => acc + (r.contas_revogadas || 0), 0) || 0;

      return {
        total: totalReviews || 0,
        emAndamento: emAndamento || 0,
        concluidas: concluidas || 0,
        vencidas: vencidas || 0,
        contasRevisadas,
        contasAprovadas,
        contasRevogadas,
      };
    },
  });

  return {
    data: query.data,
    loading: query.isLoading,
  };
};
