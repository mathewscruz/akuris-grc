/**
 * Configuração da matriz de risco activa da empresa.
 * Usa a MESMA queryKey da página de Riscos ('riscos-matriz-config', empresaId)
 * para partilhar cache e não duplicar pedidos.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import type { MatrizConfiguracao } from '@/components/riscos/matriz-config';

export function useMatrizConfigEmpresa() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['riscos-matriz-config', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MatrizConfiguracao | null> => {
      const { data, error } = await supabase
        .from('riscos_matriz_configuracao')
        .select('niveis_risco, escala_probabilidade, escala_impacto, metodo_calculo, matriz:riscos_matrizes!inner(empresa_id)')
        .eq('matriz.empresa_id', empresaId!)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        niveis_risco: (data as any).niveis_risco || [],
        escala_probabilidade: (data as any).escala_probabilidade || [],
        escala_impacto: (data as any).escala_impacto || [],
        metodo_calculo: (data as any).metodo_calculo,
      };
    },
  });
}
