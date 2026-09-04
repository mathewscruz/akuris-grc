import { useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';

interface ModuleLoadingSkeletonProps {
  statCards?: number;
  showTable?: boolean;
  tableRows?: number;
}

/** Reserva a forma final da tela enquanto o chunk da rota é carregado. */
export function ModuleLoadingSkeleton({
  statCards = 4,
  showTable = true,
  tableRows = 6,
}: ModuleLoadingSkeletonProps = {}) {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const dashboard = pathname === '/dashboard';
  const settings = pathname.startsWith('/configuracoes');

  return (
    <div
      className="w-full animate-in fade-in-0 space-y-6 duration-200 motion-reduce:animate-none"
      role="status"
      aria-label={t('residuos.geral.carregandoModulo')}
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 max-w-[70%]" />
        <Skeleton className="h-4 w-[28rem] max-w-[90%]" />
      </div>

      {settings ? (
        <div className="grid gap-6 lg:grid-cols-[224px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-lg border p-3">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
          <div className="space-y-4 rounded-lg border p-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : dashboard ? (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
            {Array.from({ length: statCards }, (_, index) => (
              <div key={index} className="space-y-2 bg-card p-4">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-[340px] w-full rounded-lg" />
            <Skeleton className="h-[340px] w-full rounded-lg" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            {Array.from({ length: statCards }, (_, index) => (
              <div key={index} className="space-y-2 bg-card p-4">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
            ))}
          </div>
          {showTable && (
            <div className="overflow-hidden rounded-lg border">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:justify-between">
                <Skeleton className="h-10 w-full sm:w-72" />
                <Skeleton className="h-10 w-full sm:w-52" />
              </div>
              <div className="divide-y">
                {Array.from({ length: tableRows }, (_, index) => (
                  <div key={index} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-[32%]" />
                    <Skeleton className="h-4 w-[22%]" />
                    <Skeleton className="ml-auto h-6 w-20" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <span className="sr-only">{t('residuos.geral.carregandoModulo')}</span>
    </div>
  );
}
