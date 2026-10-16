import { Toaster as Sonner } from "sonner"
import { toast } from '@/lib/toast'
import { IconSuccess, IconWarning, IconError, IconInfo } from '@/components/icons';

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toaster Akuris — "Editorial precision":
 *   ┌──────────────────────────────────────────────┐
 *   │▌ ●  Title                                  × │
 *   │    Description (line-clamp)                  │
 *   │    Action (link inline em text-primary)      │
 *   └──────────────────────────────────────────────┘
 *     Pílula escura (bg-foreground), ícone colorido sem fundo, sem listras.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-right"
      expand={true}
      /*
        Três é o limite; três segundos é apenas o fallback para chamadas sem
        tom. A política real vive em `src/lib/toast.ts`: sucesso 2s,
        informação 3s, aviso 4,5s e erro 6s.
        
        Estava em quatro visíveis e 4,5s cada: uma acção que dispara três avisos
        seguidos tapava o canto do ecrã durante quase cinco segundos. Um aviso
        de confirmação não é para ser lido com atenção — é para se ver de canto
        de olho que a coisa correu bem. O que exige leitura tem de estar no
        ecrã, não num aviso que foge.

        Quem precisar de mais tempo passa `duration` na chamada, e a guarda em
        `src/__tests__/aviso-nao-se-demora.test.ts` obriga a que seja uma
        excepção deliberada e rara.
      */
      visibleToasts={3}
      richColors={false}
      duration={3000}
      gap={12}
      offset={16}
      icons={{
        success: <IconSuccess className="h-4 w-4" strokeWidth={2} />,
        error: <IconError className="h-4 w-4" strokeWidth={2} />,
        warning: <IconWarning className="h-4 w-4" strokeWidth={2} />,
        info: <IconInfo className="h-4 w-4" strokeWidth={2} />,
      }}
      toastOptions={{
        classNames: {
          // Surface sólida + acento vertical 3px à esquerda via before
          // Pílula escura: igual no tema claro e escuro
          toast: [
            "group toast relative w-[380px] max-w-[92vw]",
            "!bg-foreground !text-background !border-0 !rounded-2xl",
            "shadow-[0_18px_40px_-16px_hsl(var(--foreground)/0.55)]",
            "!px-4 !py-3 overflow-hidden",
            "data-[state=open]:animate-toast-enter data-[state=closed]:animate-toast-exit motion-reduce:animate-none",
            "!items-center !gap-3",
          ].join(" "),
          // Só o ícone, na cor do tom (sem chip)
          icon: [
            "!m-0 shrink-0 flex h-6 w-6 items-center justify-center [&_svg]:h-5 [&_svg]:w-5",
            "text-primary",
            "group-data-[type=success]:!text-success",
            "group-data-[type=error]:!text-destructive",
            "group-data-[type=warning]:!text-warning",
            "group-data-[type=info]:!text-info",
          ].join(" "),
          content: "min-w-0 flex-1 pt-0.5",
          title: "text-sm font-semibold leading-tight !text-background",
          description: "text-xs !text-background/70 leading-relaxed mt-0.5 break-words",
          // Action como link inline (sem pill)
          actionButton: [
            "!bg-transparent !text-[hsl(var(--primary-glow,var(--primary)))] hover:!opacity-80",
            "!font-medium !text-xs !px-0 !py-0 !border-0 !shadow-none",
            "!mt-3 !ml-0 !mr-0 !rounded-none",
            "!h-auto !w-auto",
          ].join(" "),
          cancelButton: [
            "!bg-transparent !text-muted-foreground hover:!text-foreground",
            "!font-medium !text-xs !px-0 !py-0 !border-0 !shadow-none",
            "!mt-3 !ml-3 !rounded-none !h-auto !w-auto",
          ].join(" "),
          closeButton: [
            "!bg-transparent !border-0 !text-muted-foreground hover:!text-foreground",
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
