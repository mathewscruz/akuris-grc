import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/**
 * Riscos — sinal de atenção com exclamação e terminal em losango Akuris.
 * A leitura convencional é imediata; o ponto angular mantém a identidade.
 */
export const RiscosIcon = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
  <BaseModuleIcon ref={ref} {...props}>
    <path d="M12 3 21 20H3L12 3Z" />
    <path d="M12 9v5" />
    <path d="m12 16.2 1 1-1 1-1-1 1-1Z" fill="currentColor" stroke="none" />
  </BaseModuleIcon>
));
RiscosIcon.displayName = 'RiscosIcon';
