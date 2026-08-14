import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';
import { contarPlanos } from '@/lib/metrics';

export interface PlanosAcaoStats {
  total: number;
  pendentes: number;
  atrasados: number;
  concluidos: number;
}

export const usePlanosAcaoStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['planos-acao-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlanosAcaoStats> => {
      try {
        const { data, error } = await supabase
          .from('planos_acao')
          .select('id, status, prazo, data_conclusao')
          .eq('empresa_id', empresaId!);

        if (error) throw error;

        const base = contarPlanos(data);
        return {
          total: base.total,
          pendentes: base.pendentes,
          atrasados: base.atrasados,
          concluidos: base.concluidos + base.cancelados,
        };
      } catch (err) {
        logger.error('Erro ao carregar estatísticas de planos de ação', err);
        throw err;
      }
    },
  });
};
