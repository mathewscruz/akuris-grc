import * as React from "react"
import { cn } from "@/lib/utils"
import { AkurisPulse } from "@/components/ui/AkurisPulse"
import { useKpiDrillDown } from "@/components/dashboard/KpiDrillDownProvider"
import type { DrillDownKey } from "@/components/dashboard/KpiDrillDownDrawer"

/**
 * StatStrip (Envio 8 — sistema visual).
 *
 * Substitui as grelhas de StatCards no topo dos módulos de lista.
 * Uma única linha horizontal, sem caixas/sombras/fundo próprio, itens
 * separados por divisores verticais finos. ~64px de altura.
 *
 *  42        7          0
 *  RISCOS    • ATRASADOS  TESTES
 *
 * Regra de cor: número neutro por omissão; só ganha cor semântica
 * (destructive/warning) quando exige ação E o valor é > 0. Zero nunca é
 * vermelho. Quando colorido, recebe um ponto pequeno antes do número.
 */

export type StatStripTone = "neutral" | "destructive" | "warning"

export interface StatStripItem {
  /** Chave estável para React. */
  key?: string
  /** Rótulo (já traduzido via i18n). */
  label: string
  value: number | string
  /** Só aplica cor quando o valor é > 0. */
  tone?: StatStripTone
  /** Destino do drill-down global (mesmo do "Ver detalhes" dos cards). */
  drillDown?: DrillDownKey
  /** Ação alternativa ao drill-down. */
  onClick?: () => void
  /** Texto auxiliar em tooltip nativo. */
  hint?: string
}

interface StatStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatStripItem[]
  loading?: boolean
}

const TONE_TEXT: Record<StatStripTone, string> = {
  neutral: "text-foreground",
  destructive: "text-destructive",
  warning: "text-warning",
}

const TONE_DOT: Record<StatStripTone, string> = {
  neutral: "bg-transparent",
  destructive: "bg-destructive",
  warning: "bg-warning",
}

export function StatStrip({ items, loading = false, className, ...props }: StatStripProps) {
  const drill = useKpiDrillDown()

  if (loading) {
    return (
      <div className={cn("flex h-16 items-center", className)} {...props}>
        <AkurisPulse size={28} />
      </div>
    )
  }

  if (!items || items.length === 0) return null

  return (
    <div
      className={cn(
        // grelha em ecrã estreito (nunca scroll horizontal escondido)
        "grid grid-cols-2 gap-x-0 gap-y-3 sm:grid-cols-3 lg:flex lg:items-stretch",
        "border-y border-border/60 py-2",
        className
      )}
      {...props}
    >
      {items.map((item, index) => {
        const numeric = typeof item.value === "number" ? item.value : Number(item.value)
        const isZero = !numeric || Number.isNaN(numeric) ? String(item.value) === "0" || item.value === 0 : false
        const tone: StatStripTone = item.tone && !isZero && numeric > 0 ? item.tone : "neutral"
        const interactive = !!item.onClick || !!item.drillDown

        const activate = () => {
          if (item.onClick) return item.onClick()
          if (item.drillDown) drill.open(item.drillDown)
        }

        const content = (
          <>
            <span className={cn("flex items-center gap-1.5 text-[26px] font-semibold leading-none tabular-nums", TONE_TEXT[tone])}>
              {tone !== "neutral" && (
                <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
              )}
              {item.value}
            </span>
            <span className="mt-1.5 block truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </span>
          </>
        )

        return (
          <div
            key={item.key ?? `${item.label}-${index}`}
            className={cn(
              "min-w-0 px-4 lg:flex-1 lg:px-5",
              index > 0 && "lg:border-l lg:border-border/60"
            )}
          >
            {interactive ? (
              <button
                type="button"
                onClick={activate}
                title={item.hint ?? item.label}
                aria-label={`${item.label}: ${item.value}`}
                className="w-full rounded-sm text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {content}
              </button>
            ) : (
              <div title={item.hint ?? item.label}>{content}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default StatStrip
