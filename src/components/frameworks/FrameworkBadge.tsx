import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';
import { resolveFrameworkBrand, TONE_THEME } from '@/lib/framework-brand';
import { iconeDoSelo } from '@/components/frameworks/framework-seal-icon';
import { useLanguage } from '@/contexts/LanguageContext';

type Size = 'sm' | 'md' | 'lg';

interface FrameworkBadgeProps {
  name: string;
  versao?: string;
  /** `tipo_framework` — mantido por compatibilidade. */
  tipo?: string | null;
  size?: Size;
  className?: string;
  /** Logótipo carregado pelo super-admin — ganha de tudo. */
  logoUrl?: string | null;
}

const SIZE_MAP: Record<Size, { box: string; sigla: string; icone: number }> = {
  sm: { box: 'h-8 w-8', sigla: 'text-micro', icone: 0 },
  md: { box: 'h-12 w-12', sigla: 'text-micro', icone: 12 },
  lg: { box: 'h-16 w-16', sigla: 'text-xs', icone: 14 },
};

/**
 * Selo do framework: aro na cor da família, sigla ao centro, ícone do assunto
 * acima e, no tamanho grande, o tema escrito em arco. Sem marcas registadas.
 */
export const FrameworkBadge = ({ name, versao, size = 'md', className, logoUrl }: FrameworkBadgeProps) => {
  const { locale } = useLanguage();
  const brand = resolveFrameworkBrand(name, versao);
  const dims = SIZE_MAP[size];
  const id = React.useId().replace(/:/g, '');
  const cor = `hsl(var(--fw-${brand.tone}))`;
  const src = logoUrl || brand.logoSrc;

  if (src) {
    return (
      <div className={cn('flex-shrink-0 flex items-center justify-center rounded-full bg-card ring-1 ring-border overflow-hidden', dims.box, className)} title={brand.fullName}>
        <img src={src} alt={brand.fullName} className="h-3/4 w-3/4 object-contain" />
      </div>
    );
  }

  const tema = TONE_THEME[brand.tone][String(locale).startsWith('en') ? 'en' : 'pt'].toUpperCase();
  const sigla = brand.acronym === 'SOC2' ? 'SOC 2' : brand.acronym;

  return (
    <div
      role="img"
      aria-label={brand.fullName}
      title={brand.fullName}
      className={cn(
        'relative flex-shrink-0 flex flex-col items-center justify-center rounded-full select-none',
        'transition-transform duration-200 group-hover:scale-[1.04]',
        dims.box,
        className,
      )}
      style={{ color: cor, backgroundColor: `hsl(var(--fw-${brand.tone}) / 0.1)`, boxShadow: `inset 0 0 0 1.5px ${cor}` }}
    >
      {size === 'lg' && (
        <svg aria-hidden="true" viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <path id={`arco-${id}`} d="M 14 50 A 36 36 0 0 0 86 50" />
          </defs>
          <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
          <text fontSize="7.5" fontWeight="600" letterSpacing="0.6" fill="currentColor" fillOpacity="0.85">
            <textPath href={`#arco-${id}`} startOffset="50%" textAnchor="middle">{tema}</textPath>
          </text>
        </svg>
      )}
      {dims.icone > 0 && (
        <HugeiconsIcon icon={iconeDoSelo(name, brand.tone)} size={dims.icone} strokeWidth={1.75} color="currentColor" className={size === 'lg' ? '-mt-2' : ''} />
      )}
      <span className={cn('relative font-bold leading-none tracking-tight text-foreground', dims.sigla, size === 'lg' && 'mb-2')}>
        {sigla}
      </span>
    </div>
  );
};
