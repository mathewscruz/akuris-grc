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
      if (error || !frameworks) return { count: 0, matched: [] as string[] };

      const tokens = frameworkNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
      const matchedFw = frameworks.filter((fw: any) => {
        const nome = (fw.nome || '').toLowerCase();
        return tokens.some((t) => nome.includes(t) || t.includes(nome));
      });
      if (!matchedFw.length) return { count: 0, matched: [] };

      const ids = matchedFw.map((f: any) => f.id);
      const { count } = await supabase
        .from('gap_analysis_requirements')
        .select('id', { count: 'exact', head: true })
        .in('framework_id', ids);

      return {
        count: count || 0,
        matched: matchedFw.map((f: any) => f.nome),
      };
    },
  });
}
