import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export interface PerguntaDiagnostico { pergunta: string; peso: number; }
export type EstadoOrientacao = 'ok' | 'gerando' | 'indisponivel' | 'falha';
export interface Orientacao {
  texto: string | null;
  evidencias: string | null;
  perguntas: PerguntaDiagnostico[];
  estado: EstadoOrientacao;
  gerar: (forcar?: boolean) => Promise<void>;
}
interface GuidanceData {
  texto: string | null; evidencias: string | null; perguntas: PerguntaDiagnostico[];
  pending: boolean; attempts: number;
}
const perguntasDe = (raw: unknown): PerguntaDiagnostico[] => {
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((p): p is PerguntaDiagnostico =>
      !!p && typeof p.pergunta === 'string' && [1, 2, 3].includes(p.peso)) : [];
  } catch { return []; }
};
const empty: GuidanceData = { texto: null, evidencias: null, perguntas: [], pending: false, attempts: 0 };

// Both requirement surfaces share this query. Persistence belongs to the server;
// query caching only avoids duplicate reads while switching panels.
export function useOrientacaoRequisito(requirementId: string | null, ativo = true): Orientacao {
  const { locale: appLocale } = useLanguage();
  const locale = appLocale.startsWith('en') ? 'en' : 'pt';
  const client = useQueryClient();
  const key = ['requirement-guidance', requirementId, locale] as const;
  const [manual, setManual] = useState<{ key: string; state: 'gerando' | 'falha' } | null>(null);
  const identity = `${requirementId}:${locale}`;
  const invoke = async (force: boolean, fallback = empty): Promise<GuidanceData> => {
    const { data, error } = await supabase.functions.invoke('populate-requirement-guidance', {
      body: { requirement_id: requirementId, locale, force },
    });
    if (error) throw error;
    if (data?.pending) {
      const attempts = (client.getQueryData<GuidanceData>(key)?.attempts || 0) + 1;
      if (attempts > 15) throw new Error('guidance_temporarily_unavailable');
      return { ...fallback, pending: true, attempts };
    }
    if (!data?.orientacao_implementacao?.trim()) throw new Error('guidance_unavailable');
    return {
      texto: data.orientacao_implementacao,
      evidencias: data.exemplos_evidencias || null,
      perguntas: perguntasDe(data.perguntas_diagnostico), pending: false, attempts: 0,
    };
  };
  const query = useQuery<GuidanceData>({
    queryKey: key,
    enabled: !!requirementId && ativo,
    staleTime: Infinity,
    retry: false,
    refetchInterval: (q) => q.state.data?.pending && !q.state.error ? 10_000 : false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('gap_analysis_requirements')
        .select('orientacao_implementacao, exemplos_evidencias, perguntas_diagnostico, orientacao_implementacao_en, exemplos_evidencias_en, perguntas_diagnostico_en')
        .eq('id', requirementId!).abortSignal(signal).single();
      if (error) throw error;
      const row = (data || {}) as Record<string, string | null>;
      const suffix = locale === 'en' ? '_en' : '';
      const native = row[`orientacao_implementacao${suffix}` as keyof typeof row];
      const fallback: GuidanceData = {
        texto: native || row.orientacao_implementacao || null,
        evidencias: row[`exemplos_evidencias${suffix}` as keyof typeof row] || row.exemplos_evidencias || null,
        perguntas: perguntasDe(row[`perguntas_diagnostico${suffix}` as keyof typeof row] || row.perguntas_diagnostico),
        pending: false, attempts: 0,
      };
      if (native?.trim()) return fallback;
      if (signal.aborted) throw new Error('cancelled');
      return invoke(false, fallback);
    },
  });
  const gerar = async (forcar = false) => {
    if (!requirementId || !ativo) return;
    setManual({ key: identity, state: 'gerando' });
    try {
      if (forcar) {
        const result = await invoke(true, client.getQueryData<GuidanceData>(key) || empty);
        client.setQueryData(key, result);
      } else {
        client.setQueryData<GuidanceData>(key, previous => previous ? { ...previous, attempts: 0 } : previous);
        const result = await query.refetch();
        if (result.error) throw result.error;
      }
      setManual(null);
    } catch { setManual({ key: identity, state: 'falha' }); }
  };
  const data = query.data || empty;
  const manualState = manual?.key === identity ? manual.state : null;
  return {
    texto: data.texto, evidencias: data.evidencias, perguntas: data.perguntas, gerar,
    estado: manualState || (query.isError ? 'falha' : query.isLoading || data.pending ? 'gerando' : data.texto ? 'ok' : 'indisponivel'),
  };
}
