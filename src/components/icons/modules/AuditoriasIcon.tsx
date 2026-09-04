import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/**
 * Auditorias — evidência documental observada por uma lente.
 *
 * A folha sozinha significava apenas “arquivo”. A dobra identifica o objeto,
 * as linhas são os testes e a lente comunica revisão independente.
 */
export const AuditoriasIcon = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
  <BaseModuleIcon ref={ref} {...props}>
    <path d="M5 3h9l4 4v5" />
    <path d="M14 3v5h4" />
    <path d="M5 3v18h8" />
    <path d="M8 11h5M8 15h3" />
    <circle cx="15.5" cy="16.5" r="3.5" />
    <path d="m18 19 2.5 2.5" />
  </BaseModuleIcon>
));

AuditoriasIcon.displayName = 'AuditoriasIcon';
