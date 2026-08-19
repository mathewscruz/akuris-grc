import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { logger } from '@/lib/logger';
import { parseDataLocal } from '@/lib/date-utils';

interface DueDiligenceStats {
  totalTemplates: number;
  totalAssessments: number;
  activeAssessments: number;
  pendingAssessments: number;
  completedAssessments: number;
  expiredAssessments: number;
  totalFornecedores: number;
  assessmentsThisMonth: number;
  averageScore: number;
}

export const useDueDiligenceStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['due-diligence-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DueDiligenceStats> => {
      try {
        const { data: templates, error: templatesError } = await supabase
          .from('due_diligence_templates')
          .select('id, ativo');

        if (templatesError) throw templatesError;

        const { data: assessments, error } = await supabase
          .from('due_diligence_assessments')
          .select('status, created_at, data_expiracao, fornecedor_email, score_final')
          .eq('empresa_id', empresaId!);

        if (error) throw error;

        const uniqueFornecedores = new Set(
          assessments?.map(a => a.fornecedor_email).filter(Boolean) || []
        ).size;

        const total = assessments?.length || 0;

        const hojeRef = new Date();
        const estaExpirada = (a: any) =>
          a.data_expiracao && parseDataLocal(a.data_expiracao) < hojeRef &&
          !['concluido', 'finalizado'].includes(a.status);

        /**
         * "Activa" é o que está em curso E ainda dentro do prazo.
         *
         * `active` e `pending` reduziam-se ambos a `em_andamento|enviado`: a
         * MESMA avaliação era contada nas duas, e ainda uma terceira vez em
         * `expired`. A Akuris mostrava "Due Diligence 1 · 1 expirada" com uma
         * única avaliação no banco.
         */
        const active = assessments?.filter(a =>
          ['ativo', 'em_andamento', 'enviado'].includes(a.status) && !estaExpirada(a)
        ).length || 0;

        /** Ainda não saiu para o fornecedor. */
        const pending = assessments?.filter(a => a.status === 'pendente').length || 0;

        const completed = assessments?.filter(a =>
          a.status === 'concluido' || a.status === 'finalizado'
        ).length || 0;

        const hoje = hojeRef;
        const expired = assessments?.filter(estaExpirada).length || 0;

        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const thisMonth = assessments?.filter(a =>
          new Date(a.created_at) >= inicioMes
        ).length || 0;

        const completedWithScores = assessments?.filter(a =>
          ['concluido', 'finalizado'].includes(a.status) &&
          a.score_final != null && a.score_final > 0
        ) || [];

        const averageScore = completedWithScores.length > 0
          // Sem `* 10`: `score_final` já é percentagem.
          ? (completedWithScores.reduce((sum, a) => sum + (a.score_final || 0), 0) / completedWithScores.length)
          : 0;

        return {
          totalTemplates: templates?.length || 0,
          totalAssessments: total,
          activeAssessments: active,
          pendingAssessments: pending,
          completedAssessments: completed,
          expiredAssessments: expired,
          totalFornecedores: uniqueFornecedores,
          assessmentsThisMonth: thisMonth,
          averageScore
        };
      } catch (error) {
        logger.error('Erro ao buscar estatísticas de due diligence', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
  });
};
