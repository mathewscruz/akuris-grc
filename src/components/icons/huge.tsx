import * as React from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { cn } from '@/lib/utils';

/**
 * Fábrica dos ícones Akuris sobre Hugeicons "Stroke Rounded".
 * Mantém a API histórica do catálogo (size, className, strokeWidth,
 * currentColor) para que nenhuma tela precise mudar.
 */
export interface HugeProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  strokeWidth?: number;
}

export const huge = (nome: string, icon: IconSvgElement, defaultSize = 16) => {
  const C = React.forwardRef<SVGSVGElement, HugeProps>(
    ({ size = defaultSize, strokeWidth = 1.5, className, ...rest }, ref) => (
      <HugeiconsIcon
        ref={ref as never}
        icon={icon}
        size={size}
        strokeWidth={strokeWidth}
        color="currentColor"
        className={cn('shrink-0', className)}
        aria-hidden="true"
        focusable="false"
        {...(rest as Record<string, unknown>)}
      />
    ),
  );
  C.displayName = nome;
  return C;
};
