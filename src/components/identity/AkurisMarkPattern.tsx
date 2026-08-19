import * as React from 'react';
import { cn } from '@/lib/utils';

interface AkurisMarkPatternProps {
  className?: string;
  /** Opacidade global do padrão (0–1). Default 0.04 */
  opacity?: number;
  /** Tamanho da célula da grade em px. Default 28 */
  cellSize?: number;
  /** Cor base — usa a primary se não informado. */
  color?: string;
  /** Aplica fade radial no centro p/ não competir com o conteúdo. */
  fade?: boolean;
}

/**
 * Akuris Mark Pattern — assinatura visual proprietária.
 * Padrão sutil de grade fina + pontos violeta usado como "papel timbrado"
 * em Hero cards, telas de bloqueio e EmptyStates.
 *
 * Renderiza como camada absolute pointer-events-none — wrapper precisa ser relative.
 */
export const AkurisMarkPattern: React.FC<AkurisMarkPatternProps> = ({
  className,
  opacity = 0.04,
  cellSize = 28,
  color = 'hsl(var(--primary))',
  fade = true,
}) => {
  const id = React.useId();

  return (
    <div
      className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          maskImage: fade
            ? 'radial-gradient(ellipse at center, hsl(0 0% 0%) 30%, transparent 75%)'
            : undefined,
          WebkitMaskImage: fade
            ? 'radial-gradient(ellipse at center, hsl(0 0% 0%) 30%, transparent 75%)'
            : undefined,
        }}
      >
        <defs>
          <pattern
            id={`akuris-grid-${id}`}
            width={cellSize}
            height={cellSize}
            patternUnits="userSpaceOnUse"
          >
            {/* Linha vertical fina */}
            <path
              d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
              fill="none"
              stroke={color}
              strokeWidth={0.6}
            />
            {/* Ponto central da célula */}
            <circle cx={cellSize / 2} cy={cellSize / 2} r={0.9} fill={color} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#akuris-grid-${id})`} />
      </svg>
    </div>
  );
};

