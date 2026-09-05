import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useMinhasPendencias } from '@/hooks/useMinhasPendencias';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { QueryError } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';

export function NotificationTasks({ onNavigate }: { onNavigate: () => void }) {
  const { itens, total, isLoading, isError, refetch } = useMinhasPendencias();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const size = 8;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(total / size) - 1));
  if (isLoading) return <div className="p-4 space-y-3" role="status" aria-label={t('common.loading')}><Skeleton className="h-12" /><Skeleton className="h-12" /></div>;
  if (isError) return <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>;
  return <section className="p-4" aria-label={t('experience.notificationTasks')}>
    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t('experience.notificationTaskScope')}</p>
    {total === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('dashWidgets.pendencias.empty')}</p> : <>
      <ul className="divide-y divide-border/70">
        {itens.slice(currentPage * size, (currentPage + 1) * size).map(item => <li key={item.id}>
          <button type="button" className="realce-linha group flex w-full items-center gap-3 py-3 text-left focus-visible:outline-primary" onClick={() => { onNavigate(); navigate(item.href); }}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.atrasada ? 'bg-destructive' : 'bg-muted-foreground/40'}`} />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium text-foreground">{item.titulo}</span>
              <span className={`mt-1 block text-xs ${item.atrasada ? 'text-destructive' : 'text-muted-foreground'}`}>{item.prazo ? formatDateOnly(item.prazo) : t('dashWidgets.pendencias.semPrazo')}{item.atrasada && ` · ${t('dashWidgets.drill.overdue')}`}</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </button>
        </li>)}
      </ul>
      {total > size && <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <Button variant="ghost" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('experience.previous')}</Button>
        <span className="text-xs tabular-nums text-muted-foreground">{currentPage + 1} / {Math.ceil(total / size)}</span>
        <Button variant="ghost" size="sm" disabled={(currentPage + 1) * size >= total} onClick={() => setPage(currentPage + 1)}>{t('experience.next')}</Button>
      </div>}
    </>}
  </section>;
}
