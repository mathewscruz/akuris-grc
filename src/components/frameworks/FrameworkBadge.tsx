import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';
import { resolveFrameworkBrand } from '@/lib/framework-brand';
import { iconeDoSelo, seloDoFramework } from '@/components/frameworks/framework-seal-icon';
import { useLanguage } from '@/contexts/LanguageContext';

type Size = 'sm' | 'md' | 'lg' | 'xl';

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

const PX: Record<Size, number> = { sm: 32, md: 48, lg: 72, xl: 104 };

/**
 * Selo do framework (proposta B): disco escuro, aro brilhante na cor do
 * framework, círculo interno com ícone + sigla, nome no arco de cima, tema no
 * arco de baixo e dois pontos laterais. Abaixo de 72px fica a versão simples
 * (sem arcos de texto), para continuar legível.
 */
export const FrameworkBadge = ({ name, versao, size = 'md', className, logoUrl }: FrameworkBadgeProps) => {
  const { locale } = useLanguage();
  const brand = resolveFrameworkBrand(name, versao);
  const selo = seloDoFramework(name, brand);
  const id = React.useId().replace(/:/g, '');
  const px = PX[size];
  const completo = px >= 72;
  const cor = `hsl(var(${selo.cor}))`;
  const src = logoUrl || brand.logoSrc;

  if (src) {
    return (
      <div className={cn('flex-shrink-0 flex items-center justify-center rounded-full bg-card ring-1 ring-border overflow-hidden', className)} style={{ width: px, height: px }} title={brand.fullName}>
        <img src={src} alt={brand.fullName} className="h-3/4 w-3/4 object-contain" />
      </div>
    );
  }

  const tema = selo.tema[String(locale).startsWith('en') ? 'en' : 'pt'].toUpperCase();
  const sigla = brand.acronym === 'SOC2' ? 'SOC 2' : brand.acronym;
  const rInterno = completo ? 36 : 50;
  const iconePx = Math.round(px * (completo ? 0.2 : 0.3));

  return (
    <div
      role="img"
      aria-label={brand.fullName}
      title={brand.fullName}
      className={cn('relative flex-shrink-0 select-none transition-transform duration-200 group-hover:scale-[1.04]', className)}
      style={{ width: px, height: px, color: cor }}
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <path id={`top-${id}`} d="M 18 60 A 42 42 0 0 1 102 60" />
          <path id={`bot-${id}`} d="M 14 60 A 46 46 0 0 0 106 60" />
        </defs>
        <circle cx="60" cy="60" r="57" fill="hsl(var(--fw-disc))" />
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth={completo ? 2.5 : 5} style={{ filter: `drop-shadow(0 0 3px ${cor})` }} />
        <circle cx="60" cy="60" r={rInterno} fill="hsl(var(--fw-disc-inner))" stroke="currentColor" strokeOpacity={completo ? 0.18 : 0} />
        {completo && (
          <>
            <circle cx="9.5" cy="60" r="1.8" fill="currentColor" />
            <circle cx="110.5" cy="60" r="1.8" fill="currentColor" />
            <text fontSize="9" fontWeight="700" letterSpacing="1" fill="#fff" fillOpacity="0.92">
              <textPath href={`#top-${id}`} startOffset="50%" textAnchor="middle">{selo.nome}</textPath>
            </text>
            <text fontSize="7.5" fontWeight="600" letterSpacing="1" fill="currentColor">
              <textPath href={`#bot-${id}`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">{tema}</textPath>
            </text>
          </>
        )}
        <text
          x="60"
          y={completo ? 76 : 80}
          textAnchor="middle"
          fontSize={completo ? (sigla.length > 5 ? 13 : 17) : (sigla.length > 4 ? 20 : 26)}
          fontWeight="800"
          fill="#fff"
          letterSpacing="-0.3"
        >
          {sigla}
        </text>
      </svg>
      <span className="absolute left-1/2 -translate-x-1/2" style={{ top: completo ? '27%' : '17%' }}>
        <HugeiconsIcon icon={iconeDoSelo(name, brand.tone)} size={iconePx} strokeWidth={1.75} color="currentColor" />
      </span>
    </div>
  );
};
