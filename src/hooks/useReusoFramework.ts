import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Quanto de um framework candidato a empresa já tem pronto.
 *
 * Percentagem de requisitos do framework alvo que possuem equivalente já
 * avaliado noutro framework — a conta vem de `gap_reuso_do_framework`, no
 * banco, sobre a tabela de equivalências.
 *
 * Este número já existiu na tela, mas era `Math.random()` por baixo de um
 * rótulo que dizia "baseado em sobreposição de evidências". Voltou agora que
 * há de facto com que o calcular.
 */
export interface ReusoFramework {
  requisitos: number;
  comEquivalente: number;
  percentagem: number;
}

export function useReusoFrameworks(frameworkIds: string[], empresaId?: string | null) {
  const [reuso, setReuso] = useState<Record<string, ReusoFramework>>({});
  const [loading, setLoading] = useState(false);
  const chave = frameworkIds.join(',');

  useEffect(() => {
    if (!empresaId || frameworkIds.length === 0) {
      setReuso({});
      return;
    }
    let vivo = true;
    setLoading(true);

    (async () => {
      try {
        const pares = await Promise.all(
          frameworkIds.map(async (id) => {
            const { data, error } = await (supabase.rpc as any)('gap_reuso_do_framework', {
              p_framework_alvo: id,
              p_empresa_id: empresaId,
            });
            if (error) throw error;
            const linha = Array.isArray(data) ? data[0] : data;
            return [
              id,
              {
                requisitos: Number(linha?.requisitos ?? 0),
                comEquivalente: Number(linha?.com_equivalente ?? 0),
                percentagem: Number(linha?.percentagem ?? 0),
              },
            ] as const;
          }),
        );
        if (vivo) setReuso(Object.fromEntries(pares));
      } catch (e) {
        logger.error('useReusoFrameworks', { error: e instanceof Error ? e.message : String(e) });
        if (vivo) setReuso({});
      } finally {
        if (vivo) setLoading(false);
      }
    })();

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, empresaId]);

  return { reuso, loading };
}
