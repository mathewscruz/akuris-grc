import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/**
 * Governança — decisão central que orienta duas frentes de execução.
 *
 * O quadro representa a estrutura institucional; o losango Akuris é a
 * deliberação e as ligações tornam explícita a função de direção e supervisão.
 */
export const GovernancaIcon = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
  <BaseModuleIcon ref={ref} {...props}>
    <path d="M4 4h16v16H4Z" />
    <path d="m12 6 3 3-3 3-3-3 3-3Z" />
    <path d="M12 12v2M8 14h8M8 14v2M16 14v2" />
    <circle cx="8" cy="17.5" r="1.5" />
    <circle cx="16" cy="17.5" r="1.5" />
  </BaseModuleIcon>
));

GovernancaIcon.displayName = 'GovernancaIcon';
