import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowUpRight } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export function BentoTile({ title, description, href, className, children, delay = 0 }: {
  title: string; description?: string; href?: string; className?: string; children: ReactNode; delay?: number;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <section
      className={cn('flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 animate-fade-in motion-reduce:animate-none dark:shadow-none', className)}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <button type="button" onClick={() => navigate(href)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            {t('bento.seeAll')} <IconArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function BentoEmpty({ children }: { children: ReactNode }) {
  return <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
