import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { AkurisPulse } from "@/components/ui/AkurisPulse"

/**
 * Padrão oficial de botões Akuris — use SEMPRE uma destas variantes (não crie
 * classes de fundo/borda soltas em `className`, para manter consistência e
 * facilitar manutenção). Todas usam tokens de tema, funcionando em claro/escuro.
 *
 * Hierarquia de uso (só três estilos):
 *  - default → principal (uma por tela)
 *  - outline → secundário
 *  - ghost/link → discreto
 *  - destructive → excluir
 */
const buttonVariants = cva(
  // `shrink-0`: um botão não encolhe abaixo do seu tamanho.
  //
  // Medido em 375px: botões de acção declarados `w-8` (32px) apareciam com
  // 28px porque o pai flex os espremia. Um alvo de toque de 28px falha o
  // mínimo de qualquer guia de acessibilidade, e falha sobretudo o polegar.
  "akuris-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Três estilos apenas: principal, secundário e discreto.
        // `destructive` mantém o vermelho para excluir; os nomes antigos
        // continuam aceites e apontam para um dos três.
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        outline: "border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Aliases legados
        secondary: "border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30",
        "outline-primary": "border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30",
        soft: "border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30",
        "outline-destructive": "border border-border bg-card text-destructive shadow-sm hover:bg-destructive/10",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        warning: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        gradient: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        premium: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        glow: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      },
      /*
        O alvo de toque mede-se em PIXELS, não em `rem`.

        A raiz da aplicação é 14.15px, não 16px — toda a medida em `rem` vale
        88% do nominal. O `h-11` escrito aqui para ser «44px», o mínimo de
        qualquer guia de acessibilidade, media 38.9px. E `w-8` num botão de
        ícone dava 28.3px: pequeno demais para um polegar.

        Por isso o mínimo é `min-h-[44px] min-w-[44px]` em pixel: a regra é
        física (o tamanho de um dedo), e não deve encolher porque alguém
        ajustou a escala do texto.

        E vale até `lg`, não até `md`: um tablet é tão táctil quanto um
        telemóvel, e era exactamente aí — 768px — que os ícones caíam para
        28px.
      */
      size: {
        default: "h-10 max-lg:min-h-[44px] px-4 py-2",
        sm: "h-9 max-lg:min-h-[40px] rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-base",
        xl: "h-12 rounded-lg px-8 text-base font-semibold",
        icon: "h-10 w-10 max-lg:min-h-[44px] max-lg:min-w-[44px]",
        "icon-sm": "h-8 w-8 max-lg:min-h-[40px] max-lg:min-w-[40px]",
        "icon-lg": "h-12 w-12",
        "icon-square": "h-9 w-9 rounded-lg border border-border",
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
  /** Estado de envio: mostra o AkurisPulse e, ao terminar, um ✓ breve no próprio botão. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const [saved, setSaved] = React.useState(false)
    const prev = React.useRef(loading)
    React.useEffect(() => {
      if (prev.current && !loading) {
        setSaved(true)
        const id = window.setTimeout(() => setSaved(false), 1400)
        prev.current = loading
        return () => window.clearTimeout(id)
      }
      prev.current = loading
    }, [loading])
    if (asChild || loading === undefined) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled} {...props}>
          {children}
        </Comp>
      )
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <AkurisPulse size={14} /> : saved ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4 animate-in zoom-in-50 duration-300 motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : null}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
