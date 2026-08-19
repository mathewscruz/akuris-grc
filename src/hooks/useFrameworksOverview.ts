import { useQuery } from '@tanstack/react-query';
import { calcularScoreFramework } from '@/lib/gap-score';
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
  /** Conformidade 0–100 sobre requisitos aplicáveis (exclui N/A; não avaliados = 0;
   *  conforme=100, parcial=50, nao_conforme=0). Alinhado ao score do Gap Analysis. */
  mediaConformidade: number;
  status: FrameworkStatus;
  ultimaAtividade: string | null;
}

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
        // Sem o filtro, dashboards de uma empresa vazavam metadados de frameworks
        // customizados de outras empresas.
        const { data: frameworks, error: fwErr } = await supabase
          .from('gap_analysis_frameworks')
          .select('id, nome, versao, tipo')
          .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`);
        if (fwErr) throw fwErr;
        if (!frameworks?.length) return [];

        // Avaliações da empresa.
        const { data: evals, error: evErr } = await supabase
          .from('gap_analysis_evaluations')
          .select('framework_id, requirement_id, conformity_status, updated_at')
          .eq('empresa_id', empresaId!)
          .limit(5000);
        if (evErr) throw evErr;

        // A Declaração de Aplicabilidade manda no âmbito. `grep soa` neste
        // ficheiro devolvia zero: o cartão do dashboard ignorava as exclusões
        // que o próprio produto assinou.
        const { data: soa, error: soaErr } = await supabase
          .from('gap_analysis_soa')
          .select('requirement_id, aplicavel')
          .eq('empresa_id', empresaId!);
        if (soaErr) throw soaErr;
        const foraDoEscopo = new Set(
          (soa || []).filter((x: any) => x.aplicavel === false).map((x: any) => x.requirement_id),
        );

        // Total de requisitos por framework (independente de empresa — são globais).
        // Paginado: o PostgREST limita cada request a 1000 linhas e há >1000 requisitos
        // no total, então sem paginar a contagem por framework vinha truncada.
        const totalsByFw = new Map<string, number>();
        /** Requisitos por framework, com peso — a base do score ponderado. */
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

        const evalsByFw = new Map<string, typeof evals>();
        (evals || []).forEach((e: any) => {
          if (!evalsByFw.has(e.framework_id)) evalsByFw.set(e.framework_id, [] as any);
          (evalsByFw.get(e.framework_id) as any).push(e);
        });

        const overview: FrameworkOverview[] = frameworks.map((fw: any) => {
          const list = (evalsByFw.get(fw.id) || []) as any[];
          const total = totalsByFw.get(fw.id) || 0;

          /**
           * O MESMO `calcularScoreFramework` do Gap Analysis.
           *
           * Havia aqui uma média própria, sem peso e sem SoA: o cartão do
           * dashboard dizia 48% e o Gap Analysis dizia 49% sobre o mesmo
           * framework da mesma empresa. Dois números para o mesmo facto, e um
           * deles é o que o cliente vê primeiro.
           */
          const statusPorRequisito = new Map<string, string>();
          list.forEach((e: any) => {
            if (e.requirement_id) statusPorRequisito.set(e.requirement_id, e.conformity_status);
          });
          const resultado = calcularScoreFramework(
            (reqsByFw.get(fw.id) || []).map((r) => ({
              id: r.id,
              peso: r.peso,
              conformityStatus: statusPorRequisito.get(r.id) ?? 'nao_avaliado',
              aplicavel: !foraDoEscopo.has(r.id),
            })),
          );
          const avaliados = resultado.avaliados;
          const media = resultado.score;

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
