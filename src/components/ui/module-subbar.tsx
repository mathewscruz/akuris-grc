import { type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { IconSearch } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';

/** O caminho do módulo já aparece no header; title/activeLabel/icon são aceitos mas não exibidos. */
export function ModuleSubbar({ children, searchValue, onSearchChange }: {
  title: string; activeLabel?: string; icon?: ReactNode; children: ReactNode;
  searchValue?: string; onSearchChange?: (value: string) => void;
}) {
  const { t } = useLanguage();
  return <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 bg-background">
    <div className="min-w-0 flex-1">{children}</div>
    {onSearchChange && <div className="relative hidden w-48 shrink-0 lg:block xl:w-56">
      <IconSearch aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input value={searchValue ?? ''} onChange={event => onSearchChange(event.target.value)} aria-label={t('layout.search')} placeholder={t('layout.search')} className="h-9 pl-8" />
    </div>}
  </div>;
}