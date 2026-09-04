import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    /** Classe do indicador — é aqui que a cor da barra vive. */
    indicatorClassName?: string;
  }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    {/* `bg-primary` era fixo, e quem queria outra cor passava
        `--progress-background` — uma variável que este componente nunca leu.
        Todas as barras "coloridas" do produto eram roxas. */}
    <ProgressPrimitive.Indicator
      className={cn('akuris-motion-data h-full w-full flex-1 bg-primary transition-transform motion-reduce:transition-none', indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
