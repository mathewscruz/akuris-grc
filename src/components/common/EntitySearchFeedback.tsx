import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { QueryError } from '@/components/ui/query-error';

export function EntitySearchFeedback({ loading, error, empty, retry }: {
  loading: boolean; error: boolean; empty: boolean; retry: () => void;
}) {
  const { t } = useLanguage();
  if (loading) return <div role="status" aria-label={t('common.loading')} className="flex justify-center py-6"><AkurisPulse size={20} /></div>;
  if (error) return <div className="p-2"><QueryError onRetry={retry} /></div>;
  if (empty) return <div role="status" className="py-6 text-center text-sm text-muted-foreground">{t('entidadeSelect.empty')}</div>;
  return null;
}
