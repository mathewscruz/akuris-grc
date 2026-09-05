import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  /**
   * A área de rolagem é medida por flex, não por percentagem.
   *
   * A receita original do Radix punha `h-full` no viewport. Altura em
   * percentagem só resolve contra um pai de altura definida, e dentro de um
   * diálogo a altura vem do flex — que não conta como definida. O `h-full`
   * caía para `auto`, o viewport crescia com o conteúdo e o rodapé do diálogo
   * saía pela borda. Era o corte do botão Salvar.
   *
   * Com o Root em `flex flex-col` e o viewport em `flex-1 min-h-0`, a medida
   * passa a vir do flex nos dois níveis e nunca há percentagem a resolver.
   * Onde o Root tem altura automática — um menu, uma lista curta — o `flex-1`
   * sobre o único filho continua a dar a altura do conteúdo.
   */
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative flex flex-col min-w-0 overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="min-h-0 flex-1 min-w-0 w-full rounded-[inherit] [&>div]:!block">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
