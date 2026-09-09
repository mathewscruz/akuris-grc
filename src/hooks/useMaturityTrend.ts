import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { readAllPagesByIds } from '@/lib/read-all-pages';
import { comparableFrameworkTrend } from '@/lib/framework-trend';

/** Gap Analysis portfolio trend only; never a proxy for the GRC operational index. */
export function useMaturityTrend(cohort: { id: string; score: number }[]) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  return useQuery({
    queryKey: ['framework-portfolio-trend', empresaId, cohort],
    enabled: !!empresaId && cohort.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { data } = await readAllPagesByIds(cohort.map(f => f.id), (ids, from, to) => supabase
        .from('gap_analysis_score_history').select('framework_id,score,recorded_at')
        .eq('empresa_id', empresaId!).in('framework_id', ids).lte('recorded_at', cutoff.toISOString())
        .order('recorded_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal);
      return { delta: comparableFrameworkTrend(cohort, data, cutoff) };
    },
  });
}
