/**
 * As empresas cujo canal esta pessoa pode tratar.
 *
 * Normalmente é uma: a dela. Numa consultoria que gere o canal de vários
 * clientes — o modelo de receita de quem vende canal de denúncia à parte — são
 * várias, e é preciso escolher qual se está a ver.
 *
 * O alcance é SÓ o canal. Uma consultoria com acesso à CyberMe vê as denúncias
 * da CyberMe e não vê um risco, um contrato ou um documento dela — isso ficaria
 * a depender de `get_user_empresa_id()`, de que dependem 322 políticas, e não
 * era um risco proporcional ao problema.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface EmpresaDoCanal {
  empresa_id: string;
  nome: string;
  /** `true` é a empresa da própria pessoa; `false` é cliente de consultoria. */
  propria: boolean;
}

export function useEmpresasDoCanal() {
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ['empresas-do-canal', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('empresas_do_canal');
      if (error) throw error;
      return ((data ?? []) as EmpresaDoCanal[]).sort((a, b) => {
        /* A própria em primeiro; os clientes por nome. */
        if (a.propria !== b.propria) return a.propria ? -1 : 1;
        return a.nome.localeCompare(b.nome);
      });
    },
  });

  return {
    empresas: data,
    carregando: isLoading,
    /** Só faz sentido mostrar seletor a quem gere mais do que uma. */
    ehConsultoria: data.length > 1,
  };
}
