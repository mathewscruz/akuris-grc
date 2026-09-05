import { readAllPages } from '@/lib/read-all-pages';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";
import { useAuth } from "@/components/AuthProvider";
import { parseDataLocal } from '@/lib/date-utils';

import { severidadeDeFaixas } from '@/lib/metrics/riscos';
interface ChavesStats {
  total: number;
  ativas: number;
  expiradas: number;
  rotacao30dias: number;
  criticas: number;
  porTipo: Record<string, number>;
  porAmbiente: Record<string, number>;
}

export const useChavesStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['chaves-stats', empresaId],
    queryFn: async ({ signal }): Promise<ChavesStats> => {
      const { data: chaves, error } = await readAllPages((from, to) => supabase
        .from('ativos_chaves_criptograficas')
        .select('*')
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      if (error) throw error;

      const hoje = new Date();
      const total = chaves?.length || 0;
      const ativas = chaves?.filter(c => c.status === 'ativa').length || 0;
      
      const expiradas = chaves?.filter(c => {
        if (!c.data_proxima_rotacao) return false;
        return differenceInCalendarDays(parseDataLocal(c.data_proxima_rotacao), hoje) < 0;
      }).length || 0;

      /**
       * "Rotações pendentes" — o que precisa de acção agora.
       *
       * O `dias >= 0` excluía exactamente as chaves EM ATRASO: uma chave que
       * devia ter rodado há um mês não contava como pendente, e `expiradas`
       * não era mostrada em lado nenhum. O KPI ficava a zero justamente quando
       * havia mais trabalho por fazer.
       */
      const rotacao30dias = chaves?.filter(c => {
        if (!c.data_proxima_rotacao) return false;
        return differenceInCalendarDays(parseDataLocal(c.data_proxima_rotacao), hoje) <= 30;
      }).length || 0;

      // `=== 'critica'` deixou de ser verdade quando o vocabulário passou a
      // masculino: o KPI de chaves críticas ficaria permanentemente em zero.
      const criticas = chaves?.filter(c => severidadeDeFaixas(c.criticidade) === 'critico' && c.status === 'ativa').length || 0;

      const porTipo: Record<string, number> = {};
      const porAmbiente: Record<string, number> = {};

      chaves?.forEach(c => {
        porTipo[c.tipo_chave] = (porTipo[c.tipo_chave] || 0) + 1;
        porAmbiente[c.ambiente] = (porAmbiente[c.ambiente] || 0) + 1;
      });

      return {
        total,
        ativas,
        expiradas,
        rotacao30dias,
        criticas,
        porTipo,
        porAmbiente
      };
    },
    enabled: !!empresaId,
  });
};
