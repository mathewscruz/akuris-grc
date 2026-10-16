import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

export function useSupplierCount() {
  const empresaId = useAuth().profile?.empresa_id;
  return useQuery({
    queryKey: ['supplier-count', empresaId], enabled: !!empresaId,
    queryFn: async () => {
      if (!empresaId) return null;
      const result = await supabase.from('fornecedores').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId);
      if (result.error) throw result.error;
      return result.count;
    },
  });
}