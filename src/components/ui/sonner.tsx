import { Toaster as Sonner, toast } from "sonner"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toaster Akuris — "Editorial precision":
 *   ┌──────────────────────────────────────────────┐
 *   │▌ ●  Title                                  × │
 *   │    Description (line-clamp)                  │
 *   │    Action (link inline em text-primary)      │
 *   └──────────────────────────────────────────────┘
 *     ▌ acento vertical 3px na cor do tom (before:)
 *     ● chip 32px circular sólido na cor do tom, glyph branco
 *     surface bg-card, borda fina, sem listras diagonais.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-right"
      expand={true}
      visibleToasts={4}
      richColors={false}
      duration={4500}
      gap={12}
      offset={16}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={2.25} />,
        error: <XCircle className="h-4 w-4 text-white" strokeWidth={2.25} />,
        warning: <AlertTriangle className="h-4 w-4 text-white" strokeWidth={2.25} />,
        info: <Info className="h-4 w-4 text-white" strokeWidth={2.25} />,
      }}
      toastOptions={{
        classNames: {
          // Surface sólida + acento vertical 3px à esquerda via before
          toast: [
            "group toast relative w-[380px] max-w-[92vw]",
            "!bg-card !text-foreground",
            "!border !border-border rounded-lg",
            "shadow-[0_18px_40px_-16px_hsl(0_0%_0%/0.55),0_2px_6px_-2px_hsl(0_0%_0%/0.25)]",
            "!p-4 !pl-5 overflow-hidden",
            "data-[state=open]:animate-toast-enter data-[state=closed]:animate-toast-exit",
            "!items-start !gap-3",
            // Acento vertical 3px — tons via data-type do Sonner
            "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:content-['']",
            "before:bg-primary",
            "data-[type=success]:before:bg-success",
            "data-[type=error]:before:bg-destructive",
            "data-[type=warning]:before:bg-warning",
            "data-[type=info]:before:bg-info",
          ].join(" "),
          // Chip circular 32px sólido na cor do tom
          icon: [
            "!m-0 shrink-0",
            "flex h-8 w-8 items-center justify-center rounded-full",
            "bg-primary text-white",
            "group-data-[type=success]:!bg-success",
            "group-data-[type=error]:!bg-destructive",
            "group-data-[type=warning]:!bg-warning",
            "group-data-[type=info]:!bg-info",
          ].join(" "),
          content: "min-w-0 flex-1 pt-0.5",
          title: "text-[14px] font-semibold leading-tight text-foreground",
          description: "text-[13px] text-muted-foreground leading-relaxed mt-1 break-words",
          // Action como link inline (sem pill)
          actionButton: [
            "!bg-transparent !text-primary hover:!text-primary/80",
            "!font-medium !text-[12px] !px-0 !py-0 !border-0 !shadow-none",
            "!mt-3 !ml-0 !mr-0 !rounded-none",
            "!h-auto !w-auto",
          ].join(" "),
          cancelButton: [
            "!bg-transparent !text-muted-foreground hover:!text-foreground",
            "!font-medium !text-[12px] !px-0 !py-0 !border-0 !shadow-none",
            "!mt-3 !ml-3 !rounded-none !h-auto !w-auto",
          ].join(" "),
          closeButton: [
            "!bg-transparent !border-0 !text-muted-foreground/70 hover:!text-foreground",
            "!top-3 !right-3 !left-auto !translate-x-0 !translate-y-0",
            "!h-5 !w-5",
          ].join(" "),
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
