import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/** Incidentes — registo operacional atravessado por um pulso anómalo. */
export const IncidentesIcon = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
  <BaseModuleIcon ref={ref} {...props}>
    <path d="M5 4h14v16H5Z" />
    <path d="M5 8h14" />
    <circle cx="8" cy="6" r=".7" fill="currentColor" stroke="none" />
    <path d="M7.5 14h2.3l2-4 2.7 7 1.7-3H19" />
  </BaseModuleIcon>
));
IncidentesIcon.displayName = 'IncidentesIcon';
