import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Padrão oficial de botões Akuris — use SEMPRE uma destas variantes (não crie
 * classes de fundo/borda soltas em `className`, para manter consistência e
 * facilitar manutenção). Todas usam tokens de tema, funcionando em claro/escuro.
 *
 * Hierarquia de uso:
 *  - default    → ação primária da tela/diálogo (só UMA por contexto): Salvar, Criar.
 *  - outline    → ação secundária com fundo sólido (branco no claro): Cancelar,
 *                 Exportar, Filtrar. NÃO é transparente — tem `bg-background`.
 *  - secondary  → alternativa neutra preenchida (cinza) a `outline`.
 *  - ghost      → ação terciária SEM fundo: botões só-ícone, itens de toolbar/menu,
 *                 ações de linha em tabela. Fundo aparece só no hover.
 *  - destructive→ ação destrutiva (Excluir).
 *  - link       → navegação inline com aparência de texto.
 *  - success/warning → confirmações/alertas semânticos preenchidos.
 *  - soft/gradient/premium/glow → variantes de destaque; usar com parcimônia.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-elegant active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]",
        // Secundário com fundo sólido (branco no tema claro) — não transparente.
        outline: "border border-border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-[0.98]",
        // Terciário sem fundo — ícones, toolbars, itens de menu, ações de linha.
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90 active:scale-[0.98]",
        warning: "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90 active:scale-[0.98]",
        // GovernAII Signature Variants
        gradient: "bg-gradient-primary text-primary-foreground shadow-elegant hover:shadow-glow active:scale-[0.98] hover:brightness-110",
        premium: "bg-gradient-primary text-primary-foreground shadow-elegant hover:shadow-glow active:scale-[0.98] hover:brightness-110",
        glow: "bg-primary text-primary-foreground shadow-glow hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] active:scale-[0.98]",
        soft: "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-base",
        xl: "h-12 rounded-lg px-8 text-base font-semibold",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }