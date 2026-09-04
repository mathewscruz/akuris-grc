import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

export const useUsuariosEmpresa = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['usuarios-empresa', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome, email, role')
        .eq('ativo', true)
        .eq('empresa_id', empresaId!)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
  });
};
