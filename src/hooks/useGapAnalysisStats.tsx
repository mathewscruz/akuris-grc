import { useQuery } from '@tanstack/react-query';
import { calcularScoreFramework } from '@/lib/gap-score';
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
        const { data: frameworks, error: frameworksListError } = await supabase
          .from('gap_analysis_frameworks')
          .select('id')
          .or(fwFilter);

        if (frameworksListError) throw frameworksListError;

        const { data: evaluations, error: evaluationsError } = await supabase
          .from('gap_analysis_evaluations')
          .select('conformity_status, evidence_status, framework_id, requirement_id')
          .eq('empresa_id', empresaId!)
          .limit(5000);

        if (evaluationsError) throw evaluationsError;

        const { data: soa, error: soaError } = await supabase
          .from('gap_analysis_soa')
          .select('requirement_id, aplicavel')
          .eq('empresa_id', empresaId!);
        if (soaError) throw soaError;
        const foraDoEscopo = new Set(
          (soa || []).filter((x: any) => x.aplicavel === false).map((x: any) => x.requirement_id),
        );

        const frameworkIds = new Set(frameworks?.map(f => f.id) || []);
        const filteredEvaluations = evaluations?.filter(e =>
          frameworkIds.has(e.framework_id)
        ) || [];

        // Total de requisitos por framework (paginado — PostgREST limita a 1000/req).
        const totalsByFw = new Map<string, number>();
        const reqsByFw = new Map<string, { id: string; peso: number | null }[]>();
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data: page, error: rqErr } = await supabase
            .from('gap_analysis_requirements')
            .select('id, framework_id, peso')
            // Sem `order()`, o Postgres nao garante ordem entre paginas: com
            // 1573 requisitos em duas paginas, a mesma linha podia vir duas
            // vezes e outra nenhuma — e este e o DENOMINADOR de toda a
            // conformidade do produto.
            .order('id')
            .range(from, from + PAGE - 1);
          if (rqErr) throw rqErr;
          (page || []).forEach((r: any) => {
            totalsByFw.set(r.framework_id, (totalsByFw.get(r.framework_id) || 0) + 1);
            if (!reqsByFw.has(r.framework_id)) reqsByFw.set(r.framework_id, []);
            reqsByFw.get(r.framework_id)!.push({ id: r.id, peso: r.peso });
          });
          if (!page || page.length < PAGE) break;
        }

        /**
         * O MESMO `calcularScoreFramework` do Gap Analysis e do cartão.
         *
         * Esta era a QUARTA fórmula de conformidade do produto: sem peso, sem
         * SoA, e a agregar todos os frameworks num único rácio. O radar dizia
         * "Gap Analysis 7" onde o score ponderado da empresa é 10.
         *
         * A média é por framework — agregar os requisitos de todos num só rácio
         * faz um framework grande e mal avaliado afogar um pequeno e bom.
         */
        const statusPorRequisito = new Map<string, string>();
        filteredEvaluations.forEach((e: any) => {
          if (e.requirement_id) statusPorRequisito.set(e.requirement_id, e.conformity_status);
        });
        const fwWithEvals = new Set<string>();
        filteredEvaluations.forEach((e: any) => {
          if (e.conformity_status) fwWithEvals.add(e.framework_id);
        });
        const scores: number[] = [];
        fwWithEvals.forEach((fid) => {
          const reqs = reqsByFw.get(fid) || [];
          if (reqs.length === 0) return;
          scores.push(
            calcularScoreFramework(
              reqs.map((r) => ({
                id: r.id,
                peso: r.peso,
                conformityStatus: statusPorRequisito.get(r.id) ?? 'nao_avaliado',
                aplicavel: !foraDoEscopo.has(r.id),
              })),
            ).score,
          );
        });
        const averageCompliance =
          scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

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
          // Os frameworks QUE A EMPRESA avalia, não o catálogo global: o radar
          // dizia "Frameworks: 24" ao lado de um cartão a dizer "2 em andamento".
          totalFrameworks: frameworksWithEvaluations.size,
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
