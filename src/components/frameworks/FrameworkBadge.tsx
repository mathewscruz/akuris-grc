import { cn } from '@/lib/utils';
import { resolveFrameworkBrand, getToneStyle } from '@/lib/framework-brand';

type Size = 'sm' | 'md' | 'lg';

interface FrameworkBadgeProps {
  name: string;
  versao?: string;
  size?: Size;
  className?: string;
  /** Optional override URL (e.g. uploaded by super-admin via DB) */
  logoUrl?: string | null;
}

const SIZE_MAP: Record<Size, { box: string; text: string; img: string }> = {
  sm: { box: 'h-7 w-7 rounded-md', text: 'text-[9px]', img: 'h-5 w-5' },
  md: { box: 'h-10 w-10 rounded-lg', text: 'text-[11px]', img: 'h-7 w-7' },
  lg: { box: 'h-16 w-16 rounded-xl', text: 'text-base', img: 'h-12 w-12' },
};

/**
 * Editorial framework identifier badge.
 * Renders official logo when available, falls back to typographic acronym
 * with semantic tone (privacy / security / governance / risk / etc.).
 */
export const FrameworkBadge = ({
  name,
  versao,
  size = 'md',
  className,
  logoUrl,
}: FrameworkBadgeProps) => {
  const brand = resolveFrameworkBrand(name, versao);
  const tone = getToneStyle(brand.tone);
  const dims = SIZE_MAP[size];
  const src = logoUrl || brand.logoSrc;

  if (src) {
    return (
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center bg-white/95 ring-1 ring-border/40',
          dims.box,
          className,
        )}
        aria-label={brand.fullName}
        title={brand.fullName}
      >
        <img src={src} alt={brand.fullName} className={cn('object-contain', dims.img)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-center justify-center font-bold tracking-tight ring-1',
        'shadow-sm select-none',
        tone.bg,
        tone.text,
        tone.ring,
        dims.box,
        dims.text,
        className,
      )}
      aria-label={brand.fullName}
      title={brand.fullName}
    >
      {brand.acronym}
    </div>
  );
};
