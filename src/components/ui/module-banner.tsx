import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type BannerIcon = React.ElementType<{
  className?: string
  "aria-hidden"?: boolean | "true" | "false"
}>

interface ModuleBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: BannerIcon
  contentClassName?: string
  iconClassName?: string
}

/**
 * Faixa editorial dos módulos Akuris.
 *
 * O ícone em marca-d'água dá contexto antes da leitura, mas permanece fora da
 * árvore acessível e abaixo do conteúdo. Assim, todos os heroes têm identidade
 * de módulo sem competir com o título, a métrica ou a ação principal.
 */
export function ModuleBanner({
  icon: Icon,
  children,
  className,
  contentClassName,
  iconClassName,
  ...props
}: ModuleBannerProps) {
  return (
    <Card
      className={cn(
        "akuris-module-banner relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-primary/[0.055]",
          iconClassName,
        )}
      >
        <Icon className="h-36 w-36" aria-hidden="true" />
      </span>
      <CardContent className={cn("relative z-[1]", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
