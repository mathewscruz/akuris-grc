import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Retorna a contagem total de requisitos cobertos pelos frameworks
 * informados (matching por substring no nome — ex: "ISO 27001" casa
 * com "ISO/IEC 27001"). Usado no briefing do DocGen para mostrar ao
 * usuário quantos requisitos serão considerados pela IA.
 */
export function useFrameworkRequirementCount(frameworkNames: string[]) {
  const key = [...frameworkNames].map((n) => n.trim().toLowerCase()).sort();
  return useQuery({
    queryKey: ['docgen-fw-req-count', key],
    enabled: frameworkNames.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: frameworks, error } = await supabase
        .from('gap_analysis_frameworks')
        .select('id, nome');
      if (error || !frameworks) return { count: 0, matched: [] as string[], matchedIds: [] as string[] };

      const tokens = frameworkNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
      // Match por palavras (geral, funciona para qualquer framework): considera
      // casado quando TODAS as palavras do rótulo aparecem no nome do framework,
      // ou vice-versa. Assim "ISO 27001" casa com "ISO/IEC 27001" (o "/IEC" no
      // meio quebrava o antigo `includes` de string inteira).
      const words = (s: string) => s.split(/[^a-z0-9]+/i).filter(Boolean);
      const matchedFw = frameworks.filter((fw: any) => {
        const nomeWords = words((fw.nome || '').toLowerCase());
        return tokens.some((t) => {
          const tWords = words(t);
          if (!tWords.length) return false;
          const allInNome = tWords.every((w) => nomeWords.includes(w));
          const allInToken = nomeWords.length > 0 && nomeWords.every((w) => tWords.includes(w));
          return allInNome || allInToken;
        });
      });
      if (!matchedFw.length) return { count: 0, matched: [] as string[], matchedIds: [] as string[] };

      const ids = matchedFw.map((f: any) => f.id);
      const { count } = await supabase
        .from('gap_analysis_requirements')
        .select('id', { count: 'exact', head: true })
        .in('framework_id', ids);

      return {
        count: count || 0,
        matched: matchedFw.map((f: any) => f.nome),
        matchedIds: ids as string[],
      };
    },
  });
}
