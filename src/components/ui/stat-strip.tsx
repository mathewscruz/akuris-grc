import * as React from "react"
import { cn } from "@/lib/utils"
import { AkurisPulse } from "@/components/ui/AkurisPulse"
import { useKpiDrillDown } from "@/components/dashboard/KpiDrillDownProvider"
import type { DrillDownKey } from "@/components/dashboard/KpiDrillDownDrawer"
import type { LucideIcon } from "lucide-react"

/**
 * StatStrip (Envio 14 — faixa dentro de um cartão único).
 *
 * Um só objeto: mesma superfície, borda e raio dos restantes cartões da app.
 * Itens distribuídos por igual, divisores verticais finos, número grande,
 * rótulo pequeno em maiúsculas com ícone discreto ao lado, área de clique
 * própria por item com realce subtil.
 *
 * Regra de cor: número neutro por omissão; só ganha cor semântica
 * (destructive/warning) quando exige ação E o valor é > 0.
 */

export type StatStripTone = "neutral" | "destructive" | "warning"

export interface StatStripItem {
  /** Chave estável para React. */
  key?: string
  /** Rótulo (já traduzido via i18n). */
  label: string
  value: number | string
  /** Ícone pequeno e discreto, ao lado do rótulo. */
  icon?: LucideIcon
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

export function StatStrip({ items, loading = false, className, ...props }: StatStripProps) {
  const drill = useKpiDrillDown()

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-[76px] items-center justify-center rounded-lg border border-border bg-card dark:shadow-none",
          className
        )}
        {...props}
      >
        <AkurisPulse size={28} />
      </div>
    )
  }

  if (!items || items.length === 0) return null

  return (
    <div
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 lg:flex lg:items-stretch dark:shadow-none",
        className
      )}
      {...props}
    >
      {items.map((item, index) => {
        const numeric = typeof item.value === "number" ? item.value : Number(item.value)
        const positive = Number.isFinite(numeric) && numeric > 0
        const tone: StatStripTone = item.tone && positive ? item.tone : "neutral"
        const interactive = !!item.onClick || !!item.drillDown
        const Icon = item.icon

        const activate = () => {
          if (item.onClick) return item.onClick()
          if (item.drillDown) drill.open(item.drillDown)
        }

        const content = (
          <>
            <span
              className={cn(
                "block text-2xl font-semibold leading-none tabular-nums",
                TONE_TEXT[tone]
              )}
            >
              {item.value}
            </span>
            <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.5} aria-hidden />}
              <span className="truncate">{item.label}</span>
            </span>
          </>
        )

        // Divisores finos, sem conflitos entre breakpoints (2 → 3 → n colunas).
        const lMobile = index % 2 !== 0
        const lSm = index % 3 !== 0
        const lLg = index > 0
        const tMobile = index >= 2
        const tSm = index >= 3

        return (
          <div
            key={item.key ?? `${item.label}-${index}`}
            className={cn(
              "min-w-0 border-border/60 lg:flex-1",
              lMobile && "border-l",
              lSm !== lMobile && (lSm ? "sm:border-l" : "sm:border-l-0"),
              lLg !== lSm && (lLg ? "lg:border-l" : "lg:border-l-0"),
              tMobile && "border-t",
              tSm !== tMobile && (tSm ? "sm:border-t" : "sm:border-t-0"),
              tSm && "lg:border-t-0"
            )}
          >

            {interactive ? (
              <button
                type="button"
                onClick={activate}
                title={item.hint ?? item.label}
                aria-label={`${item.label}: ${item.value}`}
                className="h-full w-full cursor-pointer px-5 py-3.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                {content}
              </button>
            ) : (
              <div className="h-full px-5 py-3.5" title={item.hint ?? item.label}>
                {content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

