import { Toaster as Sonner, toast } from "sonner"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toaster Akuris — pill horizontal com listras diagonais + chip sólido.
 *
 * Anatomia (alinhada com a estrutura interna do Sonner):
 *   ┌──────────────────────────────────────────────┐
 *   │ ●  Title                          [ Action ] │
 *   │    Description (line-clamp)                  │
 *   └──────────────────────────────────────────────┘
 *     ↑ chip 24px sólido (cor do tom, glyph branco)
 *     ↑ fundo: listras diagonais tingidas pelo tom (akuris-stripes-*)
 *
 * Toda estilização vive aqui — proibido recriar regras globais em CSS
 * (exceto utilitários de listra em src/index.css).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-right"
      expand={false}
      richColors={false}
      duration={4500}
      gap={12}
      offset={16}
      icons={{
        success: <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />,
        error: <XCircle className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />,
        warning: <AlertTriangle className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />,
        info: <Info className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />,
      }}
      toastOptions={{
        classNames: {
          // Container do pill: largura 380px, listras aplicadas por tom abaixo
          toast: [
            "group toast relative w-[380px] max-w-[92vw]",
            "text-foreground",
            "border border-border/50 rounded-2xl",
            "shadow-[0_10px_28px_-12px_hsl(var(--foreground)/0.18)]",
            "!p-3.5 !pl-4 !pr-3 overflow-hidden",
            "animate-toast-slide-in",
            "!items-center !gap-3",
          ].join(" "),
          // Chip sólido 24px circular — cor sobrescrita por tom abaixo
          icon: [
            "!m-0 shrink-0",
            "flex h-6 w-6 items-center justify-center rounded-full",
            "bg-muted text-white",
          ].join(" "),
          content: "min-w-0 flex-1",
          title: "text-[13px] font-semibold leading-tight tracking-tight text-foreground",
          description: "text-xs text-muted-foreground leading-relaxed mt-0.5 break-words",
          actionButton:
            "!bg-background !text-foreground hover:!bg-muted/50 !border !border-border/60 !text-xs !font-semibold !px-3 !py-1.5 !rounded-lg !shadow-sm !ml-2 !mr-0",
          cancelButton:
            "!bg-transparent !text-muted-foreground hover:!text-foreground !text-xs !px-2 !py-1.5 !rounded-lg",
          closeButton: [
            "!bg-transparent !border-0 !text-muted-foreground/60 hover:!text-foreground",
            "!top-2 !right-2 !left-auto !translate-x-0 !translate-y-0",
            "!h-6 !w-6",
          ].join(" "),
          // Listras + chip sólido por tom
          success: "akuris-stripes-success [&_[data-icon]]:!bg-success",
          error: "akuris-stripes-destructive [&_[data-icon]]:!bg-destructive",
          warning: "akuris-stripes-warning [&_[data-icon]]:!bg-warning",
          info: "akuris-stripes-info [&_[data-icon]]:!bg-info",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
