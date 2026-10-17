import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { RequirementDrawer } from '@/components/gap-analysis/v2/RequirementDrawer';

/** Revisão de requisito em página cheia (ler à esquerda, decidir à direita). */
export default function GapAnalysisRequirementPage() {
  const { frameworkId = '', requirementId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const empresaId = useAuth().profile?.empresa_id ?? '';
  const sequenciaRecebida = (location.state as { sequence?: string[] } | null)?.sequence;

  // Sem sequência (link direto): ordem dos requisitos do framework por código.
  const { data: sequenciaFramework } = useQuery({
    queryKey: ['gap-req-sequencia', frameworkId],
    enabled: !sequenciaRecebida && !!frameworkId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('gap_analysis_requirements')
        .select('id, codigo')
        .eq('framework_id', frameworkId)
        .order('codigo', { ascending: true })
        .limit(2000);
      return (data ?? []).map((r) => r.id as string);
    },
  });
  const sequence = sequenciaRecebida ?? sequenciaFramework;
  const voltar = () => navigate(`/gap-analysis/framework/${frameworkId}`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest('[role="dialog"],[role="listbox"]')) voltar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkId]);

  if (!empresaId) return null;
  return (
    <RequirementDrawer
      asPage
      open
      onOpenChange={(v) => { if (!v) voltar(); }}
      requirementId={requirementId}
      empresaId={empresaId}
      sequence={sequence}
      onNavigate={(id) => navigate(`/gap-analysis/framework/${frameworkId}/requisito/${id}`, { replace: true, state: { sequence } })}
    />
  );
}
