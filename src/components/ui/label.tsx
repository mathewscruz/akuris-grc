import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Caixa do rótulo com altura fixa (`leading-5` = 20px) e alinhamento por flex.
 *
 * Antes era `leading-none` sem display próprio: um rótulo simples ficava com
 * 18px (caixa de linha da fonte) e um rótulo com ícone — dica de ajuda ou
 * calendário — com 14px. Numa grelha de três colunas onde só uma tem ícone, os
 * campos dessa coluna subiam ~10px em relação aos vizinhos. Com uma altura só,
 * qualquer combinação de rótulos alinha na mesma linha.
 *
 * `flex` (e não `inline-flex`) de propósito: um rótulo em linha herda o
 * entrelinhamento da caixa de texto do pai e fica 2px mais abaixo do que um
 * irmão que já declara `flex` — o suficiente para desalinhar a coluna.
 *
 * `gap-1.5` já dá o respiro do ícone, sem cada chamada repetir `gap-1`.
 */
const labelVariants = cva(
  "flex items-center gap-1.5 text-sm font-medium leading-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
