import * as React from "react";
import { cn } from "@/lib/utils";

interface AkurisSidebarIconProps extends React.SVGProps<SVGSVGElement> {
  /** When true, the side rail is filled — signals "sidebar expanded". */
  open?: boolean;
  size?: number;
}

/**
 * AkurisSidebarIcon
 * --------------------------------------------------------------------------
 * Ícone proprietário da Akuris para o toggle da sidebar.
 *
 * Combina a metáfora de painel lateral (rail à esquerda) com um mini-escudo
 * GRC ao centro — referência sutil a Governança, Risco e Compliance, núcleo
 * do produto. O rail à esquerda alterna preenchimento conforme o estado da
 * sidebar (aberta vs. recolhida), reforçando o feedback visual.
 *
 * Usa `currentColor` para herdar a cor do header em qualquer tema.
 */
export const AkurisSidebarIcon = React.forwardRef<
  SVGSVGElement,
  AkurisSidebarIconProps
>(({ open = true, size = 20, className, ...props }, ref) => {
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-ui duration-200", className)}
      aria-hidden="true"
      {...props}
    >
      {/* Moldura externa do painel */}
      <rect x="3" y="4" width="18" height="16" rx="3" />

      {/* Rail vertical separador */}
      <line x1="8.5" y1="4" x2="8.5" y2="20" />

      {/* Rail preenchido quando aberto (3 "itens" de menu) */}
      {open ? (
        <>
          <line x1="5.75" y1="8" x2="5.75" y2="8.01" strokeWidth={2.25} />
          <line x1="5.75" y1="12" x2="5.75" y2="12.01" strokeWidth={2.25} />
          <line x1="5.75" y1="16" x2="5.75" y2="16.01" strokeWidth={2.25} />
        </>
      ) : (
        <line x1="5.75" y1="12" x2="5.75" y2="12.01" strokeWidth={2.25} />
      )}

      {/* Mini escudo GRC ao centro-direita */}
      <path d="M14.75 8.25 L17 7.5 L19.25 8.25 V11.5 C19.25 13.4 17.7 14.75 17 15.25 C16.3 14.75 14.75 13.4 14.75 11.5 Z" />

      {/* Check sutil dentro do escudo (ponto de confiança) */}
      <path d="M15.9 11.25 L16.7 12.05 L18.1 10.5" strokeWidth={1.5} />
    </svg>
  );
});

AkurisSidebarIcon.displayName = "AkurisSidebarIcon";
