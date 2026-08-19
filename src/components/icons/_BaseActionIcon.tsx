import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Base dos ícones do Akuris.
 *
 * A primeira versão era estritamente reta: só horizontais, verticais e
 * diagonais a 45°, cantos em esquadria, terminais quadrados. A ideia era
 * afastar-se do catálogo genérico. Afastou — e ficou dura: uma lupa em
 * losango não se lê como lupa, e um rosto feito de retas não é simpático.
 *
 * A regra agora é outra, e é mais simples de defender: **o glifo tem de se
 * parecer com a coisa**. Uma lupa é um círculo com um cabo. Um olho é um
 * olho. Onde a forma verdadeira é curva, é curva.
 *
 * O que faz o conjunto ser um conjunto:
 *
 *   - grelha 24×24, desenho contido em 20×20 (inset óptico de 2);
 *   - `strokeLinecap="round"` e `strokeLinejoin="round"` — é daqui que vem o
 *     ar amável, e é o oposto da esquadria de antes;
 *   - traço 1.5 em toda a família, o mesmo peso do texto de interface;
 *   - raios generosos nas formas retangulares, contadores abertos, nada de
 *     detalhe que feche a menos de 1px a 16 pixels;
 *   - `currentColor` sempre: **o ícone nunca tem fundo**. Quando precisa de
 *     cor, a cor está no traço, não numa cápsula atrás dele.
 *
 * Os ícones de módulo (`_BaseModuleIcon`) usam 1.75 como peso de marca. É aí,
 * e no símbolo, que vive a identidade — não em tornar uma lupa estranha.
 */

export interface ActionIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const BaseActionIcon = React.forwardRef<
  SVGSVGElement,
  ActionIconProps & { children: React.ReactNode }
>(({ size = 16, className, children, ...rest }, ref) => (
  <svg
    ref={ref}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('shrink-0', className)}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
));
BaseActionIcon.displayName = 'BaseActionIcon';

/** Ponto cheio. Precisa de `fill` próprio porque a base desenha só o traço. */
export const Ponto = ({ cx, cy, r = 1.4 }: { cx: number; cy: number; r?: number }) => (
  <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
);
