import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight, IconInfo } from '@/components/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

/** Cartão do painel: título + ícone de info, descrição, conteúdo e link opcional no topo ou no rodapé. */
export function BentoTile({ title, description, href, hrefLabel, footerHref, footerLabel, className, children, delay = 0 }: {
  title: string; description?: string; href?: string; hrefLabel?: string;
  footerHref?: string; footerLabel?: string; className?: string; children: ReactNode; delay?: number;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <section
      className={cn('flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 animate-fade-in motion-reduce:animate-none dark:shadow-none', className)}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            {title}
            {description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} aria-label={description} className="inline-flex text-muted-foreground"><IconInfo className="h-4 w-4" /></span>
                </TooltipTrigger>
                <TooltipContent>{description}</TooltipContent>
              </Tooltip>
            )}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {href && (
          <button type="button" onClick={() => navigate(href)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            {hrefLabel ?? t('bento.seeAll')} <IconArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {footerHref && (
        <button type="button" onClick={() => navigate(footerHref)}
          className="mt-4 inline-flex items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {footerLabel} <IconArrowRight className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}

export function BentoEmpty({ children }: { children: ReactNode }) {
  return <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Número que conta de 0 até o valor (respeita reduced-motion). */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(value); return; }
    let raf = 0; const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{v}</>;
}

/** Liga um valor após o primeiro frame, para animar larguras/traços via CSS transition. */
export function useMounted(delay = 50) {
  const [m, setM] = useState(false);
  useEffect(() => { const id = setTimeout(() => setM(true), delay); return () => clearTimeout(id); }, [delay]);
  return m;
}
