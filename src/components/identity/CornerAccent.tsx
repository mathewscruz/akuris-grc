import * as React from 'react';
import { cn } from '@/lib/utils';

interface CornerAccentProps {
  /** Posição do canto. Default 'top-left'. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Tamanho em px. Default 14. */
  size?: number;
  className?: string;
}

const POSITION_CLASSES: Record<NonNullable<CornerAccentProps['position']>, string> = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2 -scale-x-100',
  'bottom-left': 'bottom-2 left-2 -scale-y-100',
  'bottom-right': 'bottom-2 right-2 -scale-100',
};

/**
 * Corner Accent — assinatura Akuris para cards de destaque.
 * Pequeno chevron violeta no canto, exclusivo de Hero cards / KPIs principais
 * / modais de IA. Substitui a barra lateral animada `governaii-accent-bar`.
 *
 * Wrapper precisa ser relative.
 */
export const CornerAccent: React.FC<CornerAccentProps> = ({
  position = 'top-left',
  size = 14,
  className,
}) => {
  return (
    <svg
      className={cn('absolute pointer-events-none text-primary', POSITION_CLASSES[position], className)}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      {/* Duas linhas em "L" formando um chevron — assinatura discreta */}
      <path
        d="M1 1 L13 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M1 1 L1 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Ponto final do "L" para reforçar identidade */}
      <circle cx="1" cy="1" r="1.6" fill="currentColor" />
    </svg>
  );
};

