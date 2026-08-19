import { cn } from '@/lib/utils';
import { FrameworkGlyph } from '@/components/frameworks/FrameworkGlyph';
import { resolveFrameworkBrand, getToneStyle } from '@/lib/framework-brand';

type Size = 'sm' | 'md' | 'lg';

interface FrameworkBadgeProps {
  name: string;
  versao?: string;
  /** `tipo_framework` — decide o glifo de reserva para frameworks próprios. */
  tipo?: string | null;
  size?: Size;
  className?: string;
  /** Optional override URL (e.g. uploaded by super-admin via DB) */
  logoUrl?: string | null;
}

const SIZE_MAP: Record<Size, { box: string; text: string; img: string; glifo: number }> = {
  sm: { box: 'h-7 w-7 rounded-md', text: 'text-micro', img: 'h-5 w-5', glifo: 16 },
  md: { box: 'h-10 w-10 rounded-lg', text: 'text-micro', img: 'h-7 w-7', glifo: 22 },
  lg: { box: 'h-16 w-16 rounded-lg', text: 'text-base', img: 'h-12 w-12', glifo: 34 },
};

/**
 * Identificador visual de um framework.
 *
 * Mostrava a SIGLA dentro de um quadrado colorido — "27001", "27701", "62443",
 * "20000". Num catálogo de vinte e quatro frameworks isso são vinte e quatro
 * quadrados iguais com números diferentes: o nome outra vez, em corpo menor,
 * sem nada para reconhecer sem ler.
 *
 * Agora desenha o ASSUNTO de cada norma (ver `FrameworkGlyph`), que é
 * reconhecível em miniatura e não usa marca registada de ninguém. Um logótipo
 * carregado pelo super-admin continua a ganhar de tudo.
 */
export const FrameworkBadge = ({
  name,
  versao,
  tipo,
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
        'flex-shrink-0 flex items-center justify-center ring-1 shadow-sm select-none',
        tone.bg,
        tone.text,
        tone.ring,
        dims.box,
        className,
      )}
      role="img"
      aria-label={brand.fullName}
      title={brand.fullName}
    >
      <FrameworkGlyph nome={name} tipo={tipo} size={dims.glifo} />
    </div>
  );
};
