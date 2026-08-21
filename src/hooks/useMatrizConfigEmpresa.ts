/**
 * Matriz de risco vigente da empresa — fonte única.
 *
 * Havia duas cópias desta consulta (esta e uma dentro de `pages/Riscos.tsx`),
 * ambas com `.limit(1)` sobre TODAS as matrizes da empresa: qual delas
 * respondia dependia da ordenação, e as faixas com que a carteira era lida
 * podiam não ser as da matriz que o utilizador julgava estar a usar. Agora há
 * uma matriz vigente (`riscos_matrizes.ativa`) e uma consulta só.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import type { MatrizConfiguracao, NivelRisco, EscalaItem } from '@/components/riscos/matriz-config';

export interface MatrizVigente extends MatrizConfiguracao {
  matriz_id: string;
  nome: string;
  niveis_risco: NivelRisco[];
  escala_probabilidade: EscalaItem[];
  escala_impacto: EscalaItem[];
}

export const MATRIZ_QUERY_KEY = 'riscos-matriz-config';

export function useMatrizConfigEmpresa() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: [MATRIZ_QUERY_KEY, empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<MatrizVigente | null> => {
      const { data, error } = await supabase
        .from('riscos_matrizes')
        .select(`
          id, nome,
          configuracao:riscos_matriz_configuracao!inner(
            niveis_risco, escala_probabilidade, escala_impacto, metodo_calculo, apetite_score
          )
        `)
        .eq('empresa_id', empresaId!)
        .eq('ativa', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const cfg = Array.isArray(data.configuracao) ? data.configuracao[0] : data.configuracao;
      if (!cfg) return null;

      return {
        matriz_id: data.id,
        nome: data.nome,
        niveis_risco: (cfg.niveis_risco as unknown as NivelRisco[]) || [],
        escala_probabilidade: (cfg.escala_probabilidade as unknown as EscalaItem[]) || [],
        escala_impacto: (cfg.escala_impacto as unknown as EscalaItem[]) || [],
        metodo_calculo: cfg.metodo_calculo,
        apetite_score: cfg.apetite_score,
      };
    },
  });
}
