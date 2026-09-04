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

/**
 * Um total que não mistura moedas.
 *
 * Recebe o mapa `{ BRL: 696000, EUR: 12000 }` e devolve «R$ 696 mil + €12 mil».
 * Com uma moeda só, o resultado é exactamente o de sempre — é o caso normal.
 * Com duas, o cartão passa a dizer as duas em vez de somar peras com maçãs e
 * carimbar-lhes a moeda da empresa por cima.
 *
 * O mapa vazio devolve zero na moeda da empresa: um cartão sem valor nenhum
 * mostra «€0», não um travessão que se confunde com «não sei».
 */
export function formatMoedasSomadas(
  porMoeda: Record<string, number> | null | undefined,
  moedaDaEmpresa: MoedaCodigo = 'EUR',
  compact = false,
  referenciaQuandoZero?: Record<string, number> | null,
): string {
  const entradas = Object.entries(porMoeda ?? {}).filter(([, v]) => v !== 0);
  if (entradas.length === 0) {
    // Um KPI zerado deve conservar a unidade dos demais KPIs da mesma tela.
    // Ex.: contratos em BRL não podem mostrar “R$ 692 mil” ao lado de “0 €”.
    const moedaDeReferencia = Object.entries(referenciaQuandoZero ?? {})
      .filter(([m]) => MOEDAS.includes(m.toUpperCase() as MoedaCodigo))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]?.[0]
      ?.toUpperCase() as MoedaCodigo | undefined;
    return formatMoeda(0, moedaDeReferencia || moedaDaEmpresa, compact);
  }
  return entradas
    // A maior primeiro: é a que interessa a quem olha de relance.
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([m, v]) => formatMoeda(v, (MOEDAS.includes(m as MoedaCodigo) ? m : 'EUR') as MoedaCodigo, compact))
    .join(' + ');
}

/**
 * Última moeda conhecida da empresa. Permite formatar em helpers puros
 * (ex.: exportações/PDF) que não podem chamar hooks.
 */
let moedaAtual: MoedaCodigo = 'EUR';
export function getMoedaAtual(): MoedaCodigo {
  return moedaAtual;
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
  moedaAtual = moeda;

  return {
    moeda,
    simbolo: SIMBOLO_MOEDA[moeda],
    format: (value?: number | null, compact = false) => formatMoeda(value, moeda, compact),
    /** Formata na moeda DO REGISTO, com a da empresa como reserva. */
    formatNaMoedaDo: (value?: number | null, moedaDoRegisto?: string | null, compact = false) => {
      const m = (moedaDoRegisto || moeda).toUpperCase() as MoedaCodigo;
      return formatMoeda(value, MOEDAS.includes(m) ? m : moeda, compact);
    },
    /** Total sem misturar moedas — ver `formatMoedasSomadas`. */
    formatSoma: (
      porMoeda?: Record<string, number> | null,
      compact = false,
      referenciaQuandoZero?: Record<string, number> | null,
    ) => formatMoedasSomadas(porMoeda, moeda, compact, referenciaQuandoZero),
  };
}
