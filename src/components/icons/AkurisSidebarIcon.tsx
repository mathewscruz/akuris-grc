import * as React from "react";
import { cn } from "@/lib/utils";

interface AkurisSidebarIconProps extends React.SVGProps<SVGSVGElement> {
  /** Aberta: a coluna lateral aparece cheia. Recolhida: fica vazia. */
  open?: boolean;
  size?: number;
}

/**
 * AkurisSidebarIcon — o botão que abre e fecha o menu lateral.
 *
 * O desenho anterior era um painel com um mini-escudo GRC e um check lá dentro,
 * mais um trilho de três pontos. Duas coisas estavam erradas:
 *
 *  1. **Não cabia.** O botão renderiza a 16px (`[&_svg]:size-4`). Seis formas
 *     distintas — moldura, divisória, três pontos, escudo e o check dentro do
 *     escudo — em 16 pixels não são um ícone, são uma mancha.
 *
 *  2. **Dizia a coisa errada.** Escudo e check são o vocabulário de
 *     conformidade, que é o assunto do PRODUTO. Este botão não fala de
 *     conformidade: abre e fecha o menu. Um ícone existe para identificar a
 *     ação, e enfeitá-lo com a marca é o mesmo erro que já tinha sido corrigido
 *     quando a estrela de IA decorava o produto inteiro.
 *
 * Ficam três formas e uma ideia: a moldura é o ecrã, a divisória é onde o menu
 * encosta, e a coluna da esquerda enche-se quando o menu está aberto. O estado
 * lê-se de relance, que é a única coisa que este botão precisa de comunicar.
 *
 * Usa `currentColor` para herdar a cor do cabeçalho em qualquer tema.
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
      {/* O ecrã. */}
      <rect x="3" y="4" width="18" height="16" rx="3" />

      {/*
        A coluna do menu, cheia quando ele está aberto.

        Preenchida em vez de tracejada de propósito: a 16px, um bloco cheio
        contra um vazio distingue-se; três pontinhos dentro de um trilho não.
        É a única forma cheia do ícone, e é ela que carrega o estado.
      */}
      {open && (
        <path
          d="M6 4h2.5v16H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"
          fill="currentColor"
          stroke="none"
        />
      )}

      {/* Onde o menu encosta ao conteúdo. */}
      <line x1="8.5" y1="4" x2="8.5" y2="20" />
    </svg>
  );
});

AkurisSidebarIcon.displayName = "AkurisSidebarIcon";
