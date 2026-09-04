import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/** Documentos — dossiê em camadas, com a peça ativa em primeiro plano. */
export const DocumentosIcon = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
  <BaseModuleIcon ref={ref} {...props}>
    <path d="M7 3h8l4 4v4" />
    <path d="M15 3v5h4" />
    <path d="M4 7h8l4 4v10H4Z" />
    <path d="M12 7v5h4M7 16h6M7 19h4" />
  </BaseModuleIcon>
));
DocumentosIcon.displayName = 'DocumentosIcon';
