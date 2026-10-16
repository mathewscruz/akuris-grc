import * as React from 'react';
import { SidebarLeftIcon, SidebarRightIcon } from '@hugeicons/core-free-icons';
import { huge, type HugeProps } from './huge';

const Aberto = huge('SidebarAberto', SidebarLeftIcon, 20);
const Fechado = huge('SidebarFechado', SidebarRightIcon, 20);

export const AkurisSidebarIcon = React.forwardRef<SVGSVGElement, HugeProps & { open?: boolean }>(
  ({ open = true, ...props }, ref) =>
    open ? <Aberto ref={ref} {...props} /> : <Fechado ref={ref} {...props} />,
);
AkurisSidebarIcon.displayName = 'AkurisSidebarIcon';
