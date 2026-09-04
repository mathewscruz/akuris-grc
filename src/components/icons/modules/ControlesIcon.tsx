import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/**
 * Controles — consola operacional com três parâmetros regulados.
 *
 * O escudo é reservado a proteção/segurança. Aqui cada losango Akuris move-se
 * numa régua diferente: a metáfora é controlar, ajustar e verificar.
 */
export const ControlesIcon = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
  <BaseModuleIcon ref={ref} {...props}>
    <path d="M4 4h16v16H4Z" />
    <path d="M7 8h3M14 8h3M7 12h6M7 16h1M12 16h5" />
    <path d="m12 6 2 2-2 2-2-2 2-2Z" fill="currentColor" stroke="none" />
    <path d="m15 10 2 2-2 2-2-2 2-2Z" fill="currentColor" stroke="none" />
    <path d="m10 14 2 2-2 2-2-2 2-2Z" fill="currentColor" stroke="none" />
  </BaseModuleIcon>
));
ControlesIcon.displayName = 'ControlesIcon';
