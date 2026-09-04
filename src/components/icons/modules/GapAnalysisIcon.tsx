import * as React from 'react';
import { BaseModuleIcon, type ModuleIconProps } from './_BaseModuleIcon';

/** Gap Analysis — ponte explícita entre o patamar atual e o patamar alvo. */
export const GapAnalysisIcon = React.forwardRef<SVGSVGElement, ModuleIconProps>((props, ref) => (
  <BaseModuleIcon ref={ref} {...props}>
    <path d="M4 19v-7h5v7M15 19V5h5v14" />
    <path d="m8 14 7-7" />
    <path d="M11 7h4v4" />
  </BaseModuleIcon>
));
GapAnalysisIcon.displayName = 'GapAnalysisIcon';
