import { cn } from '@/lib/utils';
import { FrameworkGlyph } from '@/components/frameworks/FrameworkGlyph';
import { resolveFrameworkBadgePalette, resolveFrameworkBrand } from '@/lib/framework-brand';

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
  sm: { box: 'h-8 w-8 rounded-lg', text: 'text-micro', img: 'h-5 w-5', glifo: 17 },
  md: { box: 'h-12 w-12 rounded-lg', text: 'text-micro', img: 'h-8 w-8', glifo: 27 },
  lg: { box: 'h-16 w-16 rounded-lg', text: 'text-base', img: 'h-12 w-12', glifo: 36 },
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
  const palette = resolveFrameworkBadgePalette(name, brand.tone);
  const dims = SIZE_MAP[size];
  const src = logoUrl || brand.logoSrc;

  if (src) {
    return (
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center bg-white/95 ring-1 ring-border/50 shadow-sm overflow-hidden',
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
        'relative isolate flex-shrink-0 flex items-center justify-center overflow-hidden text-white',
        'ring-1 ring-black/10 shadow-[0_6px_18px_-8px_rgba(15,23,42,0.65)] select-none',
        'transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.04]',
        dims.box,
        className,
      )}
      style={{ backgroundImage: `linear-gradient(145deg, ${palette.from}, ${palette.to})` }}
      role="img"
      aria-label={brand.fullName}
      title={brand.fullName}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_24%_16%,rgba(255,255,255,0.32),transparent_38%)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-1.5 -right-1.5 h-1/2 w-1/2 rounded-full border border-white/10 bg-white/[0.06]"
      />
      <FrameworkGlyph
        nome={name}
        tipo={tipo}
        size={dims.glifo}
        className="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.28)]"
      />
    </div>
  );
};
