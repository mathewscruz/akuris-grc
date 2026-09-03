import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';

export interface AiCreditsState {
  franquia: number;
  consumidos: number;
  restantes: number;
  percentual: number; // 0-100 (consumido)
  esgotado: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Lê o saldo de créditos de IA da empresa do usuário em tempo real.
 * Usa o profile do AuthProvider (empresa_id síncrono) e escuta:
 *  - Realtime updates da empresa para refletir o débito imediatamente
 *  - Eventos do wrapper invokeEdgeFunction (ai-credit-consumed / ai-credits-exhausted)
 */
export function useAiCredits(): AiCreditsState {
  const { profile, company } = useAuth();
  const empresaId = profile?.empresa_id || null;
  const isSuperAdmin = profile?.role === 'super_admin';

  const [franquia, setFranquia] = useState<number>(company?.plano?.creditos_franquia ?? 0);
  const [consumidos, setConsumidos] = useState<number>(company?.creditos_consumidos ?? 0);
  const [loading, setLoading] = useState<boolean>(!company);

  const fetchSaldo = useCallback(async () => {
    if (!empresaId) {
      setFranquia(0);
      setConsumidos(0);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('creditos_consumidos, plano:planos(creditos_franquia)')
        .eq('id', empresaId)
        .maybeSingle();
      if (error) throw error;
      setConsumidos((data as any)?.creditos_consumidos ?? 0);
      setFranquia((data as any)?.plano?.creditos_franquia ?? 0);
    } catch (err) {
      logger.error('useAiCredits.fetchSaldo', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  // Sync inicial com o company do AuthProvider
  useEffect(() => {
    if (company?.plano?.creditos_franquia != null) {
      setFranquia(company.plano.creditos_franquia);
    }
    if (company?.creditos_consumidos != null) {
      setConsumidos(company.creditos_consumidos);
    }
  }, [company?.plano?.creditos_franquia, company?.creditos_consumidos]);

  // Realtime na linha da empresa
  useEffect(() => {
    if (!empresaId) return;
    fetchSaldo();
    // Cada montagem precisa de um tópico próprio. Em desenvolvimento, o
    // StrictMode monta, limpa e monta o efeito novamente; o encerramento do
    // canal anterior é assíncrono e o cliente pode devolver o canal já
    // inscrito quando o nome é reutilizado.
    const channelId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`ai-credits-${empresaId}-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'empresas', filter: `id=eq.${empresaId}` },
        (payload: any) => {
          const novo = payload?.new?.creditos_consumidos;
          if (typeof novo === 'number') setConsumidos(novo);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [empresaId, fetchSaldo]);

  // Eventos disparados pelo wrapper invokeEdgeFunction
  useEffect(() => {
    const onConsumed = () => setConsumidos((c) => c + 1);
    const onExhausted = () => fetchSaldo();
    window.addEventListener('ai-credit-consumed', onConsumed);
    window.addEventListener('ai-credits-exhausted', onExhausted);
    return () => {
      window.removeEventListener('ai-credit-consumed', onConsumed);
      window.removeEventListener('ai-credits-exhausted', onExhausted);
    };
  }, [fetchSaldo]);

  return useMemo<AiCreditsState>(() => {
    const restantes = Math.max(0, franquia - consumidos);
    const percentual = franquia > 0 ? Math.min(100, Math.round((consumidos / franquia) * 100)) : 0;
    const esgotado = franquia > 0 && restantes <= 0;
    return {
      franquia,
      consumidos,
      restantes,
      percentual,
      esgotado,
      isSuperAdmin,
      loading,
      refetch: fetchSaldo,
    };
  }, [franquia, consumidos, isSuperAdmin, loading, fetchSaldo]);
}
