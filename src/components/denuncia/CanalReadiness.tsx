import { useQuery } from '@tanstack/react-query';
import { Check, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Uses saved settings, not the draft: this is a setup checklist, not a compliance certification. */
export function CanalReadiness({ empresaId, config }: {
  empresaId: string;
  config: { ativo: boolean; politica_privacidade: string | null; texto_apresentacao: string | null } | null;
}) {
  const { t } = useLanguage();
  const { data, isPending, isError } = useQuery({
    queryKey: ['canal-readiness', empresaId],
    queryFn: async () => {
      const [categories, committee] = await Promise.all([
        supabase.from('denuncias_categorias').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('ativo', true),
        supabase.from('denuncias_comite').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
      ]);
      if (categories.error || committee.error) throw categories.error || committee.error;
      return { categories: (categories.count ?? 0) > 0, committee: (committee.count ?? 0) > 0 };
    },
  });
  const checks = [
    ['activeCheck', !!config?.ativo], ['policyCheck', !!config?.politica_privacidade?.trim()],
    ['introCheck', !!config?.texto_apresentacao?.trim()], ['categoryCheck', data?.categories], ['committeeCheck', data?.committee],
  ] as const;
  return <Card>
    <CardHeader><CardTitle className="text-base">{t('canalExperience.readiness')}</CardTitle><CardDescription>{t('canalExperience.readinessHint')}</CardDescription></CardHeader>
    <CardContent>
      {isError ? <p role="alert" className="text-sm text-destructive">{t('denunciasAdmin.config.errorLoad')}</p> :
        <ul className="grid gap-3 sm:grid-cols-2" aria-busy={isPending}>{checks.map(([key, ready]) => <li key={key} className="flex items-center gap-2 text-sm">
          {ready ? <Check className="h-4 w-4 shrink-0 text-state-done" aria-hidden="true" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span>{t(`canalExperience.${key}`)}</span><span className="sr-only">: {t(ready ? 'canalExperience.ready' : 'canalExperience.pending')}</span>
        </li>)}</ul>}
    </CardContent>
  </Card>;
}
