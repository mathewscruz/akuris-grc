import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';

export type FrameworkStatus = 'em_andamento' | 'concluido' | 'nao_iniciado';

export interface FrameworkOverview {
  id: string;
  nome: string;
  versao: string | null;
  tipo: string | null;
  totalRequisitos: number;
  requisitosAvaliados: number;
  /** Conformidade média 0–100 (exclui N/A; conforme=100, parcial=50, nao_conforme=0). */
  mediaConformidade: number;
  status: FrameworkStatus;
  ultimaAtividade: string | null;
}

const SCORE_OF: Record<string, number> = {
  conforme: 100,
  parcial: 50,
  nao_conforme: 0,
};

export const useFrameworksOverview = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['frameworks-overview', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FrameworkOverview[]> => {
      try {
        // Frameworks são templates globais (empresa_id NULL) + os da empresa.
        const { data: frameworks, error: fwErr } = await supabase
          .from('gap_analysis_frameworks')
          .select('id, nome, versao, tipo');
        if (fwErr) throw fwErr;
        if (!frameworks?.length) return [];

        // Avaliações da empresa.
        const { data: evals, error: evErr } = await supabase
          .from('gap_analysis_evaluations')
          .select('framework_id, conformity_status, updated_at')
          .eq('empresa_id', empresaId!)
          .limit(5000);
        if (evErr) throw evErr;

        // Total de requisitos por framework (independente de empresa — são globais).
        const { data: reqs, error: rqErr } = await supabase
          .from('gap_analysis_requirements')
          .select('framework_id');
        if (rqErr) throw rqErr;

        const totalsByFw = new Map<string, number>();
        (reqs || []).forEach((r: any) => {
          totalsByFw.set(r.framework_id, (totalsByFw.get(r.framework_id) || 0) + 1);
        });

        const evalsByFw = new Map<string, typeof evals>();
        (evals || []).forEach((e: any) => {
          if (!evalsByFw.has(e.framework_id)) evalsByFw.set(e.framework_id, [] as any);
          (evalsByFw.get(e.framework_id) as any).push(e);
        });

        const overview: FrameworkOverview[] = frameworks.map((fw: any) => {
          const list = (evalsByFw.get(fw.id) || []) as any[];
          const total = totalsByFw.get(fw.id) || 0;

          const evaluated = list.filter(
            (e) => e.conformity_status && e.conformity_status !== 'nao_aplicavel'
          );
          const avaliados = evaluated.length;

          const media =
            avaliados > 0
              ? Math.round(
                  evaluated.reduce(
                    (sum, e) => sum + (SCORE_OF[e.conformity_status] ?? 0),
                    0
                  ) / avaliados
                )
              : 0;

          let status: FrameworkStatus = 'nao_iniciado';
          if (total > 0 && avaliados >= total) status = 'concluido';
          else if (avaliados > 0) status = 'em_andamento';

          const ultima = list
            .map((e) => e.updated_at)
            .filter(Boolean)
            .sort()
            .pop() || null;

          return {
            id: fw.id,
            nome: fw.nome,
            versao: fw.versao || null,
            tipo: fw.tipo || null,
            totalRequisitos: total,
            requisitosAvaliados: avaliados,
            mediaConformidade: media,
            status,
            ultimaAtividade: ultima,
          };
        });

        // Mostrar apenas frameworks com pelo menos uma avaliação (relevantes).
        return overview
          .filter((o) => o.status !== 'nao_iniciado')
          .sort((a, b) => b.mediaConformidade - a.mediaConformidade);
      } catch (error) {
        logger.error('Frameworks Overview Error', {
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
  });
};
