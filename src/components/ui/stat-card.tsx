import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TrendingUp, TrendingDown, Minus, ArrowRight, Sparkles } from "lucide-react"
import { AkurisPulse } from "@/components/ui/AkurisPulse"
import { CornerAccent } from "@/components/identity/CornerAccent"
import { useKpiDrillDown } from "@/components/dashboard/KpiDrillDownProvider"
import type { DrillDownKey } from "@/components/dashboard/KpiDrillDownDrawer"
import { useLanguage } from "@/contexts/LanguageContext"

/**
 * StatCard editorial (Onda 5).
 *
 * Anatomia oficial:
 *  ┌──────────────────────────────────────────┐
 *  │ ◇ Riscos ativos                  ↗ +12%  │  ← ícone INLINE + delta no topo
 *  │                                          │
 *  │ 42                                       │  ← valor herói (4xl, semibold)
 *  │                                          │
 *  │ ████████░░░░  3 críticos · 5 altos       │  ← micro-segmentação visual
 *  │                                          │
 *  │ Ver detalhes                          →  │  ← CTA discreta (só se drillDown)
 *  └──────────────────────────────────────────┘
 *
 *  Sem pílula colorida no ícone, sem background colorido por variant
 *  (apenas accent-bar lateral 2px). Loading via AkurisPulse.
 */

type Tone = "destructive" | "warning" | "success" | "info" | "primary" | "neutral"

const TONE_BG: Record<Tone, string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
  primary: "bg-primary",
  neutral: "bg-muted-foreground/40",
}

const TONE_TEXT: Record<Tone, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
  primary: "text-primary",
  neutral: "text-muted-foreground",
}

const statCardVariants = cva(
  // h-full + min-h padronizam a altura de TODOS os StatCards no grid,
  // independente de o conteúdo ser segments, description ou nenhum.
  "group relative overflow-hidden transition-all duration-300 h-full min-h-[148px]",
  {
    variants: {
      variant: {
        default: "",
        success: "governaii-accent-bar before:!bg-success/70",
        warning: "governaii-accent-bar before:!bg-warning/70",
        destructive: "governaii-accent-bar before:!bg-destructive/70",
        info: "governaii-accent-bar before:!bg-info/70",
        primary: "governaii-accent-bar before:!bg-primary/70",
      },
      interactive: {
        true: "cursor-pointer hover:border-primary/40 hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
    },
  }
)

export interface StatCardSegment {
  label: string
  value: number
  tone?: Tone
}

interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof statCardVariants> {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label?: string
    period?: string
    direction?: "up" | "down" | "neutral"
  }
  badge?: {
    label: string
    variant?: "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "soft"
  }
  /** Composição do total — renderiza barra segmentada + legenda compacta. */
  segments?: StatCardSegment[]
  /** Conecta o card ao KpiDrillDownDrawer global. Torna o card clicável. */
  drillDown?: DrillDownKey
  /** Assinatura Akuris no canto (use no KPI herói da tela). */
  showAccent?: boolean
  actions?: React.ReactNode
  loading?: boolean
  /** Hint exibido quando o valor é 0, para guiar usuários novos. */
  emptyHint?: string
}

export function StatCard({
  className,
  variant,
  interactive,
  title,
  value,
  description,
  icon,
  trend,
  badge,
  segments,
  drillDown,
  showAccent,
  actions,
  loading = false,
  emptyHint,
  onClick,
  ...props
}: StatCardProps) {
  const { t } = useLanguage()
  const drill = useKpiDrillDown()
  const isInteractive = interactive || !!onClick || !!drillDown

  const handleActivate = React.useCallback(() => {
    if (onClick) {
      onClick({} as any)
      return
    }
    if (drillDown) drill.open(drillDown)
  }, [onClick, drillDown, drill])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isInteractive) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleActivate()
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card variant="elevated" className={cn("min-h-[160px] flex items-center justify-center", className)}>
        <AkurisPulse size={36} />
      </Card>
    )
  }

  const isZero = value === 0 || value === "0"
  const showEmptyHint = !!emptyHint && isZero
  const showCTA = isInteractive

  // ── Trend ─────────────────────────────────────────────────────────────────
  const trendDir = trend
    ? trend.direction ?? (trend.value > 0 ? "up" : trend.value < 0 ? "down" : "neutral")
    : null
  const trendIcon =
    trendDir === "up" ? <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> :
    trendDir === "down" ? <TrendingDown className="h-3 w-3" strokeWidth={1.5} /> :
    trendDir === "neutral" ? <Minus className="h-3 w-3" strokeWidth={1.5} /> : null
  const trendColor =
    trendDir === "up" ? "text-success" :
    trendDir === "down" ? "text-destructive" :
    "text-muted-foreground"

  // ── Segments ──────────────────────────────────────────────────────────────
  const segmentTotal = segments?.reduce((s, x) => s + Math.max(0, x.value), 0) ?? 0
  const renderSegments = () => {
    if (!segments || segments.length === 0 || segmentTotal === 0) return null
    return (
      <div className="space-y-1.5">
        {/* Barra segmentada */}
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {segments.map((seg, i) => {
            const pct = (Math.max(0, seg.value) / segmentTotal) * 100
            if (pct <= 0) return null
            return (
              <div
                key={`${seg.label}-${i}`}
                className={cn("h-full transition-all", TONE_BG[seg.tone ?? "neutral"])}
                style={{ width: `${pct}%` }}
                aria-label={`${seg.label}: ${seg.value}`}
              />
            )
          })}
        </div>
        {/* Legenda compacta */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {segments.map((seg, i) => (
            seg.value > 0 && (
              <span key={`${seg.label}-leg-${i}`} className="inline-flex items-center gap-1">
                <span className={cn("inline-block h-1.5 w-1.5 rounded-full", TONE_BG[seg.tone ?? "neutral"])} />
                <span className={cn("tabular-nums font-medium", TONE_TEXT[seg.tone ?? "neutral"])}>{seg.value}</span>
                <span className="text-muted-foreground/80">{seg.label}</span>
              </span>
            )
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card
      variant="elevated"
      interactive={isInteractive}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `${title}: ${value}` : undefined}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={handleKeyDown}
      className={cn(statCardVariants({ variant, interactive: isInteractive }), className)}
      {...props}
    >
      {showAccent && <CornerAccent position="top-right" size={12} className="opacity-60" />}

      <CardContent className="p-5 pl-6 flex flex-col gap-3 h-full">
        {/* Linha 1: ícone + título + badge | delta */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span className="text-muted-foreground flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4">
                {icon}
              </span>
            )}
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </span>
            {badge && (
              <Badge variant={badge.variant || "soft"} size="sm" className="ml-1">
                {badge.label}
              </Badge>
            )}
          </div>

          {trend && trendDir && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums", trendColor)}>
                    {trendIcon}
                    {trend.value > 0 ? "+" : ""}{trend.value}
                    {typeof trend.value === "number" ? "%" : ""}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {trend.label || t('sweepCore.statCard.variation')}{trend.period ? ` vs ${trend.period}` : ""}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Linha 2: valor herói */}
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-4xl font-semibold tracking-tight tabular-nums leading-none",
              isZero ? "text-muted-foreground/70" : "text-foreground"
            )}
          >
            {value}
          </span>
          {actions && <div className="ml-auto">{actions}</div>}
        </div>

        {/* Linha 3: segments OU description — slot reservado para padronizar altura */}
        <div className="min-h-[44px] flex flex-col justify-start gap-2">
          {segments && segments.length > 0 && segmentTotal > 0 ? (
            renderSegments()
          ) : description ? (
            <p className="text-xs text-muted-foreground leading-snug">{description}</p>
          ) : null}

          {/* Empty hint */}
          {showEmptyHint && (
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80">
              <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary/60" strokeWidth={1.5} />
              <span>{emptyHint}</span>
            </div>
          )}
        </div>

        {/* CTA discreta (só se interativo) — absolute, não reserva espaço */}
        {showCTA && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 right-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
          >
            <span>{drillDown ? "Ver detalhes" : "Abrir"}</span>
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default StatCard
