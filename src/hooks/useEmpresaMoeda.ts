import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type MoedaCodigo = 'EUR' | 'BRL' | 'USD' | 'GBP';

export const MOEDAS: MoedaCodigo[] = ['EUR', 'BRL', 'USD', 'GBP'];

/** Locale usado para formatar cada moeda (separadores corretos por região). */
const LOCALE_POR_MOEDA: Record<MoedaCodigo, string> = {
  EUR: 'pt-PT',
  BRL: 'pt-BR',
  USD: 'en-US',
  GBP: 'en-GB',
};

export const SIMBOLO_MOEDA: Record<MoedaCodigo, string> = {
  EUR: '€',
  BRL: 'R$',
  USD: '$',
  GBP: '£',
};

/** Formata um valor monetário na moeda da empresa (fallback: EUR / pt-PT). */
export function formatMoeda(
  value?: number | null,
  moeda: MoedaCodigo = 'EUR',
  compact = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const locale = LOCALE_POR_MOEDA[moeda] || 'pt-PT';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moeda,
    ...(compact
      ? { notation: 'compact' as const, maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 }),
  }).format(value);
}

/** Moeda configurada para a empresa do utilizador autenticado. */
export function useEmpresaMoeda() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data } = useQuery({
    queryKey: ['empresa-moeda', empresaId],
    queryFn: async (): Promise<MoedaCodigo> => {
      const { data, error } = await supabase
        .from('empresas')
        .select('moeda')
        .eq('id', empresaId!)
        .maybeSingle();
      if (error) throw error;
      const moeda = (data as any)?.moeda as MoedaCodigo | undefined;
      return moeda && MOEDAS.includes(moeda) ? moeda : 'EUR';
    },
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 30,
  });

  const moeda: MoedaCodigo = data || 'EUR';

  return {
    moeda,
    simbolo: SIMBOLO_MOEDA[moeda],
    format: (value?: number | null, compact = false) => formatMoeda(value, moeda, compact),
  };
}
