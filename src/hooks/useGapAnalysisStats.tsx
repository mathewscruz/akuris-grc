import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';

export const useGapAnalysisStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['gap-analysis-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        // Filtro multi-tenant: templates globais + frameworks da empresa.
        const fwFilter = `empresa_id.is.null,empresa_id.eq.${empresaId}`;
        const { count: totalFrameworks, error: frameworksError } = await supabase
          .from('gap_analysis_frameworks')
          .select('*', { count: 'exact', head: true })
          .or(fwFilter);

        if (frameworksError) throw frameworksError;

        const { data: frameworks, error: frameworksListError } = await supabase
          .from('gap_analysis_frameworks')
          .select('id')
          .or(fwFilter);

        if (frameworksListError) throw frameworksListError;

        const { data: evaluations, error: evaluationsError } = await supabase
          .from('gap_analysis_evaluations')
          .select('conformity_status, evidence_status, framework_id')
          .eq('empresa_id', empresaId!)
          .limit(5000);

        if (evaluationsError) throw evaluationsError;

        const frameworkIds = new Set(frameworks?.map(f => f.id) || []);
        const filteredEvaluations = evaluations?.filter(e =>
          frameworkIds.has(e.framework_id)
        ) || [];

        // Total de requisitos por framework (paginado — PostgREST limita a 1000/req).
        const totalsByFw = new Map<string, number>();
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data: page, error: rqErr } = await supabase
            .from('gap_analysis_requirements')
            .select('framework_id')
            .range(from, from + PAGE - 1);
          if (rqErr) throw rqErr;
          (page || []).forEach((r: any) => {
            totalsByFw.set(r.framework_id, (totalsByFw.get(r.framework_id) || 0) + 1);
          });
          if (!page || page.length < PAGE) break;
        }

        // Conformidade sobre requisitos APLICÁVEIS (exclui N/A; não avaliados = 0),
        // igual ao Gap Analysis (useFrameworkScore) e ao card de frameworks. Antes
        // dividíamos só pelos avaliados, o que dava um número mais otimista (ex.: 50% vs 48%).
        const scoreByFw = new Map<string, number>();
        const naByFw = new Map<string, number>();
        const fwWithEvals = new Set<string>();
        filteredEvaluations.forEach(e => {
          if (!e.conformity_status) return;
          fwWithEvals.add(e.framework_id);
          if (e.conformity_status === 'nao_aplicavel') {
            naByFw.set(e.framework_id, (naByFw.get(e.framework_id) || 0) + 1);
          } else {
            const s = e.conformity_status === 'conforme' ? 100 : e.conformity_status === 'parcial' ? 50 : 0;
            scoreByFw.set(e.framework_id, (scoreByFw.get(e.framework_id) || 0) + s);
          }
        });
        let numCompliance = 0;
        let denCompliance = 0;
        fwWithEvals.forEach(fid => {
          const aplicaveis = Math.max((totalsByFw.get(fid) || 0) - (naByFw.get(fid) || 0), 0);
          numCompliance += scoreByFw.get(fid) || 0;
          denCompliance += aplicaveis;
        });
        const averageCompliance = denCompliance > 0 ? numCompliance / denCompliance : 0;

        const pendingItems = filteredEvaluations.filter(e =>
          e.evidence_status === 'pendente'
        ).length;

        const frameworksWithEvaluations = new Set<string>();
        filteredEvaluations.forEach(evaluation => {
          if (evaluation.conformity_status || evaluation.evidence_status) {
            frameworksWithEvaluations.add(evaluation.framework_id);
          }
        });

        return {
          totalFrameworks: totalFrameworks || 0,
          assessmentsInProgress: frameworksWithEvaluations.size,
          averageCompliance: Math.round(averageCompliance),
          pendingItems: pendingItems || 0
        };
      } catch (error) {
        logger.error('Gap Analysis Stats Error', { error: error instanceof Error ? error.message : String(error) });
        return { totalFrameworks: 0, assessmentsInProgress: 0, averageCompliance: 0, pendingItems: 0 };
      }
    },
  });
};
