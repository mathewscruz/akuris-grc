import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

/** Tabelas que podem alimentar o mini gráfico (todas com empresa_id e created_at). */
export type TabelaSerie =
  | 'riscos' | 'documentos' | 'access_reviews' | 'planos_acao' | 'ativos_chaves_criptograficas'
  | 'ativos_licencas' | 'ativos' | 'contratos' | 'fornecedores' | 'continuidade_planos'
  | 'incidentes' | 'controles' | 'auditorias' | 'sistemas_privilegiados' | 'denuncias'
  | 'dados_pessoais' | 'projetos' | 'relatorios_customizados';

/** Total acumulado no fim de cada uma das últimas `semanas` semanas. */
export function acumularPorSemana(datas: string[], semanas = 8, agora = new Date()): number[] {
  const fim = agora.getTime();
  const semanaMs = 7 * 86400000;
  const tempos = datas.map((d) => new Date(d).getTime()).filter(Number.isFinite);
  return Array.from({ length: semanas }, (_, i) => {
    const corte = fim - (semanas - 1 - i) * semanaMs;
    return tempos.filter((t) => t <= corte).length;
  });
}

/**
 * Série semanal real de registos da empresa, para o mini gráfico de área dos
 * cartões de número. Sem dados (ou série plana com tudo zero) devolve
 * undefined: o cartão fica limpo em vez de mostrar uma curva falsa.
 */
export function useSerieSemanal(tabela?: TabelaSerie) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const { data } = useQuery({
    queryKey: ['serie-semanal', empresaId, tabela],
    enabled: !!empresaId && !!tabela,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(tabela as any) as any)
        .select('created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) return null;
      const serie = acumularPorSemana(((data ?? []) as { created_at: string }[]).map((r) => r.created_at));
      return serie.some((v) => v > 0) ? serie : null;
    },
  });
  return data ?? undefined;
}
