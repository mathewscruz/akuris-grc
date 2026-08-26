import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "@/lib/utils"
import { IconCheck } from '@/components/icons';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      /*
        A área de TOQUE cresce; o quadrado continua do mesmo tamanho.

        Medido a 375 px na tabela de requisitos do Gap Analysis: a caixa mede
        14 px de lado — o `h-4` são 16 px nominais, e a raiz da aplicação está
        a 14.15 px, por isso todo o `rem` vale 88%. Catorze pixéis é menos de
        um terço do alvo recomendado, e é com estas caixas que se seleciona um
        lote de requisitos para tratar em bloco.

        Crescer o quadrado mudaria o desenho de todos os formulários; um
        pseudo-elemento estende só o que o dedo acerta, e desaparece a partir
        de `lg`, onde há rato. Os 10 px de cada lado dão ~34 px de alvo e cabem
        dentro da célula (`w-10`) e da linha da tabela.
      */
      "relative after:absolute after:-inset-2.5 after:content-[''] lg:after:hidden",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <IconCheck className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
