import { Button } from '@/components/ui/button';
import { IconWarning } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';

/** Persistent failure state: absence of data must never look like an empty portfolio. */
export function QueryError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
      <IconWarning className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{t('experience.loadError')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('experience.retryHint')}</p>
      </div>
      {onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t('experience.retry')}</Button>}
    </div>
  );
}
