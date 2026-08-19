import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { IconTrendUp, IconTrendDown, IconMinus } from '@/components/icons';

interface TrendData {
  riscosChange: number;
  incidentesChange: number;
  controlesChange: number;
  documentosChange: number;
}

export function useTrendData() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['trend-indicators', profile?.empresa_id],
    queryFn: async (): Promise<TrendData> => {
      if (!profile?.empresa_id) return { riscosChange: 0, incidentesChange: 0, controlesChange: 0, documentosChange: 0 };
      
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [riscosThis, riscosLast, incThis, incLast, ctrlThis, ctrlLast, docsThis, docsLast] = await Promise.all([
        supabase.from('riscos').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', thisMonth),
        supabase.from('riscos').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', lastMonth).lt('created_at', thisMonth),
        supabase.from('incidentes').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', thisMonth),
        supabase.from('incidentes').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', lastMonth).lt('created_at', thisMonth),
        supabase.from('controles').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', thisMonth),
        supabase.from('controles').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', lastMonth).lt('created_at', thisMonth),
        supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', thisMonth),
        supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id).gte('created_at', lastMonth).lt('created_at', thisMonth),
      ]);

      return {
        riscosChange: (riscosThis.count || 0) - (riscosLast.count || 0),
        incidentesChange: (incThis.count || 0) - (incLast.count || 0),
        controlesChange: (ctrlThis.count || 0) - (ctrlLast.count || 0),
        documentosChange: (docsThis.count || 0) - (docsLast.count || 0),
      };
    },
    enabled: !!profile?.empresa_id,
    staleTime: 10 * 60 * 1000,
  });
}

export function TrendBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  if (value === 0) return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <IconMinus className="h-3 w-3" /> 0
    </span>
  );

  const isPositive = inverted ? value < 0 : value > 0;
  
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
      {value > 0 ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
      {value > 0 ? '+' : ''}{value}
    </span>
  );
}
