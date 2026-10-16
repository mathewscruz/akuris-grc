import { supabase } from '@/integrations/supabase/client';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/components/AuthProvider';

/** Tabelas que podem alimentar o mini gráfico (todas com empresa_id e created_at). */
export type TabelaSerie =
  | 'riscos' | 'documentos' | 'access_reviews' | 'planos_acao' | 'ativos_chaves_criptograficas'
  | 'ativos_licencas' | 'ativos' | 'contratos' | 'fornecedores' | 'continuidade_planos'
  | 'incidentes' | 'controles' | 'auditorias' | 'sistemas_privilegiados' | 'denuncias'
  | 'dados_pessoais' | 'relatorios_customizados';

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
const cache = new Map<string, number[] | null>();

export function useSerieSemanal(tabela?: TabelaSerie) {
  const empresaId = useContext(AuthContext)?.profile?.empresa_id;
  const chave = empresaId && tabela ? `${empresaId}:${tabela}` : null;
  const [serie, setSerie] = useState<number[] | null | undefined>(chave ? cache.get(chave) : undefined);
  useEffect(() => {
    if (!chave) return;
    if (cache.has(chave)) { setSerie(cache.get(chave)); return; }
    let vivo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from(tabela as any) as any)
      .select('created_at')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data, error }: { data: { created_at: string }[] | null; error: unknown }) => {
        const s = error ? null : acumularPorSemana((data ?? []).map((r) => r.created_at));
        const final = s && s.some((v) => v > 0) ? s : null;
        cache.set(chave, final);
        if (vivo) setSerie(final);
      });
    return () => { vivo = false; };
  }, [chave, tabela, empresaId]);
  return serie ?? undefined;
}
