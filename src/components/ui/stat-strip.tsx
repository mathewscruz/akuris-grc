import * as React from "react"
import { useMotionAllowed } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import { useKpiDrillDown } from "@/components/dashboard/KpiDrillDownProvider"
import type { DrillDownKey } from "@/components/dashboard/KpiDrillDownDrawer"
import type { LucideIcon } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useSerieSemanal, type TabelaSerie } from "@/hooks/useSerieSemanal"

/**
 * StatStrip (Envio 14 — faixa dentro de um cartão único).
 *
 * Um só objeto: mesma superfície, borda e raio dos restantes cartões da app.
 * Itens distribuídos por igual, divisores verticais finos e uma hierarquia
 * executiva: rótulo, valor, contexto e (quando aplicável) progresso/meta.
 *
 * Regra de cor: número neutro por omissão; só ganha cor semântica
 * (destructive/warning) quando exige ação E o valor é > 0.
 */

export type StatStripTone = "neutral" | "destructive" | "orange" | "warning" | "success"
export type StatStripDirection = "higher-is-better" | "lower-is-better" | "neutral"

export interface StatStripTrend {
  label: string
  direction?: "up" | "down" | "flat"
  favorable?: boolean
}

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
  /** Contexto curto que deve permanecer visível, sem depender de hover. */
  context?: string
  /** Zero só é favorável quando o domínio o declara, nunca por inferência. */
  zeroState?: { label: string; tone?: StatStripTone }
  dataState?: 'ready' | 'unavailable'
  mobilePriority?: number
  /** Valor atual da microbarra. Percentuais em `value` são inferidos. */
  progress?: number
  /** Máximo da microbarra. */
  progressMax?: number
  /** Meta operacional, mostrada e usada para determinar saúde. */
  target?: number
  /** Explica se alcançar um valor maior ou menor representa melhora. */
  direction?: StatStripDirection
  /** Comparação com o período anterior. */
  trend?: StatStripTrend
  /** Movimento único para um risco crítico recém-chegado. */
  attentionPulse?: boolean
  /** Série real (mais antiga → mais recente) para o mini gráfico de área. */
  series?: number[]
}

interface StatStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatStripItem[]
  /** Tabela do módulo: o cartão de TOTAL ganha o mini gráfico com o total acumulado real. */
  serieTabela?: TabelaSerie
  loading?: boolean
  error?: boolean
}

const TONE_TEXT: Record<StatStripTone, string> = {
  neutral: "text-foreground",
  destructive: "text-destructive",
  orange: "text-severity-high",
  warning: "text-warning",
  success: "text-foreground",
}

const TONE_ACCENT: Record<StatStripTone, string> = {
  neutral: "bg-transparent",
  destructive: "bg-destructive",
  orange: "bg-severity-high",
  warning: "bg-warning",
  success: "bg-state-done",
}

const TONE_PROGRESS: Record<StatStripTone, string> = {
  neutral: "bg-state-active",
  destructive: "bg-destructive",
  orange: "bg-severity-high",
  warning: "bg-warning",
  success: "bg-state-done",
}

const TONE_CONTEXT: Record<StatStripTone, string> = {
  neutral: "text-muted-foreground",
  destructive: "text-destructive",
  orange: "text-severity-high",
  warning: "text-warning",
  success: "text-state-done",
}

const metricNumber = (value: number | string): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const match = value.trim().match(/^-?\d+(?:[.,]\d+)?\s*%$/)
  if (!match) return null
  const parsed = Number.parseFloat(match[0].replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

interface MetricParts {
  target: number
  prefix: string
  suffix: string
  decimals: number
  decimalComma: boolean
}

const metricParts = (value: number | string): MetricParts | null => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    const decimals = Number.isInteger(value) ? 0 : Math.min(2, String(value).split('.')[1]?.length ?? 0)
    return { target: value, prefix: '', suffix: '', decimals, decimalComma: false }
  }

  /* Só anima métricas com UM número. “10 de 14” permanece texto, porque
     interpolar apenas metade da relação produziria uma leitura falsa. */
  const match = value.trim().match(/^([^\d-]*)(-?\d+(?:[.,]\d+)?)([^\d]*)$/)
  if (!match) return null
  const target = Number.parseFloat(match[2].replace(',', '.'))
  if (!Number.isFinite(target)) return null
  const fraction = match[2].split(/[.,]/)[1]
  return {
    target,
    prefix: match[1],
    suffix: match[3],
    decimals: Math.min(2, fraction?.length ?? 0),
    decimalComma: match[2].includes(','),
  }
}

export function AnimatedMetricValue({ value }: { value: number | string }) {
  const motionAllowed = useMotionAllowed()
  const parts = React.useMemo(() => metricParts(value), [value])
  const previous = React.useRef(0)
  const [displayed, setDisplayed] = React.useState(parts?.target ?? value)

  React.useLayoutEffect(() => {
    if (!parts) {
      setDisplayed(value)
      return
    }

    const from = previous.current
    const to = parts.target
    previous.current = to
    if (!motionAllowed || from === to || typeof requestAnimationFrame === 'undefined') {
      setDisplayed(to)
      return
    }

    let frame = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      /* A leitura ganha velocidade logo no primeiro instante e pousa no
         valor final sem travar. O ease-out exponencial entrega ~88% do número
         no primeiro terço e usa o restante para a desaceleração perceptível. */
      const elapsed = Math.min(1, (now - start) / 560)
      const eased = elapsed === 1 ? 1 : 1 - Math.pow(2, -10 * elapsed)
      setDisplayed(from + (to - from) * eased)
      if (elapsed < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [parts, value, motionAllowed])

  if (!parts || typeof displayed !== 'number') return <>{value}</>
  const number = displayed.toFixed(parts.decimals)
  return <>{parts.prefix}{parts.decimalComma ? number.replace('.', ',') : number}{parts.suffix}</>
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function StatStrip({ items: itemsIn, serieTabela, loading = false, error = false, className, ...props }: StatStripProps) {
  const serie = useSerieSemanal(serieTabela)
  const items = React.useMemo(() => serie && itemsIn?.length ? itemsIn.map((it) => !it.series && (/total/i.test(it.key ?? '') || /total/i.test(it.label)) ? { ...it, series: serie } : it) : itemsIn, [itemsIn, serie])
  const drill = useKpiDrillDown()
  const { t } = useLanguage()
  const [mobileExpanded, setMobileExpanded] = React.useState(false)
  const summaryId = React.useId()
  const mobileOrder = [...items].sort((a, b) => {
    const rank = (item: StatStripItem) => {
      const value = metricNumber(item.value)
      const missedTarget = value !== null && item.target !== undefined && (
        item.direction === 'higher-is-better' ? value < item.target : item.direction === 'lower-is-better' && value > item.target
      )
      const attention = missedTarget || (value ?? 0) > 0 && ['destructive', 'warning', 'orange'].includes(item.tone ?? '')
      return item.mobilePriority ?? (item === items[0] ? 0 : attention ? 1 : 10 + items.indexOf(item))
    }
    return rank(a) - rank(b)
  })

  const separatorClasses = (index: number, mobileIndex = index) => {
    const lMobile = mobileIndex % 2 !== 0
    const lSm = index % 3 !== 0
    const lLg = index > 0
    const tMobile = mobileIndex >= 2
    const tSm = index >= 3

    return cn(
      "min-w-0 border-border/60 lg:flex-1",
      lMobile && "border-l",
      lSm !== lMobile && (lSm ? "sm:border-l" : "sm:border-l-0"),
      lLg !== lSm && (lLg ? "lg:border-l" : "lg:border-l-0"),
      tMobile && "border-t",
      tSm !== tMobile && (tSm ? "sm:border-t" : "sm:border-t-0"),
      tSm && "lg:border-t-0"
    )
  }

  if (loading) {
    const skeletonCount = Math.max(3, Math.min(items?.length || 5, 6))
    return (
      <div
        className={cn(
          "grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 lg:flex lg:items-stretch dark:shadow-none",
          className
        )}
        {...props}
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={index}
            className={cn(
              separatorClasses(index),
              "min-h-[88px] px-4 py-3 sm:min-h-[104px] sm:px-5 sm:py-4",
              index >= 2 && "hidden sm:block",
              index === skeletonCount - 1 && skeletonCount % 2 === 1 && "col-span-2 sm:col-span-1"
            )}
          >
            <div className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="mt-3 h-7 w-14 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="mt-2 h-3 w-32 max-w-full animate-pulse rounded bg-muted/80 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) return null

  return (
    <div
      id={summaryId}
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:items-stretch",
        className
      )}
      {...props}
    >
      {items.map((item, index) => {
        const numeric = metricNumber(item.value)
        const positive = numeric !== null && numeric > 0
        const unavailable = error || item.dataState === 'unavailable'
        const zeroState = numeric === 0 ? item.zeroState : undefined
        const hasTarget = item.target !== undefined && item.direction && item.direction !== "neutral" && numeric !== null
        const targetMet = hasTarget && (
          item.direction === "higher-is-better"
            ? numeric >= item.target!
            : numeric <= item.target!
        )
        const tone: StatStripTone = unavailable ? "neutral" : hasTarget
          ? targetMet ? "success" : item.tone ?? "warning"
          : zeroState ? zeroState.tone ?? "neutral" : item.tone && positive ? item.tone : "neutral"
        const interactive = !unavailable && (!!item.onClick || !!item.drillDown)
        const inferredPercent = typeof item.value === "string" && /%\s*$/.test(item.value) ? numeric : null
        const progressValue = item.progress ?? inferredPercent
        const progressMax = item.progressMax ?? 100
        const progressPercent = !unavailable && progressValue !== null && progressValue !== undefined && progressMax > 0
          ? clamp((progressValue / progressMax) * 100, 0, 100)
          : null
        const context = unavailable ? t('experience.unavailable') : zeroState?.label ?? item.context ?? item.hint
        const targetLabel = item.target !== undefined
          ? t("cardsKpi.metricas.meta", { value: item.target })
          : undefined
        const supportingText = [context, targetLabel].filter(Boolean).join(" · ")

        const activate = () => {
          if (item.onClick) return item.onClick()
          if (item.drillDown) drill.open(item.drillDown)
        }

        const content = (
          <>
            <span className="flex min-h-4 min-w-0 items-start justify-between gap-3">
              <span className="line-clamp-2 text-micro font-semibold leading-4 tracking-[0.02em] text-muted-foreground">
                {item.label}
              </span>
              {interactive && (
                <span
                  aria-hidden="true"
                  className="shrink-0 -translate-x-1 text-sm leading-none text-muted-foreground/60 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
                >
                  →
                </span>
              )}
            </span>
            <span
              className={cn(
                "mt-2 block text-2xl font-semibold leading-none tracking-[-0.025em] tabular-nums",
                item.attentionPulse && "akuris-risk-attention",
                TONE_TEXT[tone]
              )}
            >
              {unavailable ? '—' : <AnimatedMetricValue value={item.value} />}
            </span>
            <span className={cn("mt-1.5 block min-h-4 line-clamp-2 text-micro leading-4", TONE_CONTEXT[tone])}>
              {supportingText || "\u00a0"}
            </span>
            {!unavailable && item.trend && (
              <span
                className={cn(
                  "mt-1 inline-flex text-micro font-medium leading-none",
                  item.trend.favorable === true && "text-state-done",
                  item.trend.favorable === false && "text-destructive",
                  item.trend.favorable === undefined && "text-muted-foreground"
                )}
              >
                {item.trend.direction === "up" ? "↑ " : item.trend.direction === "down" ? "↓ " : ""}
                {item.trend.label}
              </span>
            )}
            {!unavailable && item.series && item.series.length > 1 && (
              <MiniArea series={item.series} tone={tone} />
            )}
            {progressPercent !== null && (
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progressMax}
                aria-valuenow={clamp(progressValue!, 0, progressMax)}
                aria-label={`${item.label}: ${item.value}`}
                className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className={cn("akuris-motion-data block h-full rounded-full transition-[width] motion-reduce:transition-none", TONE_PROGRESS[tone])}
                  style={{ width: `${progressPercent}%` }}
                />
              </span>
            )}
          </>
        )

        return (
          <div
            key={item.key ?? `${item.label}-${index}`}
            data-mobile-hidden={!mobileExpanded && mobileOrder.indexOf(item) >= 2}
            style={{ '--metric-order': mobileOrder.indexOf(item) } as React.CSSProperties}
            className={cn(
              "akuris-stat-item relative min-h-[96px] overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.03)] dark:shadow-none sm:min-h-[112px] lg:flex-1 lg:min-w-0",
              mobileExpanded && mobileOrder.indexOf(item) === items.length - 1 && items.length % 2 === 1 && "col-span-2 sm:col-span-1"
            )}
          >
            <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-0.5", TONE_ACCENT[tone])} />

            {interactive ? (
              <button
                type="button"
                onClick={activate}
                title={item.hint ?? item.label}
                aria-label={`${item.label}: ${item.value}`}
                className="group h-full w-full cursor-pointer px-4 py-3 sm:px-5 sm:py-4 text-left transition-colors duration-150 hover:bg-accent/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none"
              >
                {content}
              </button>
            ) : (
              <div className="h-full px-4 py-3 sm:px-5 sm:py-4" title={item.hint ?? item.label}>
                {content}
              </div>
            )}
          </div>
        )
      })}
      {items.length > 2 && (
        <button type="button" aria-expanded={mobileExpanded} aria-controls={summaryId} onClick={() => setMobileExpanded((value) => !value)} className="order-last col-span-2 min-h-9 border-t px-4 py-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:hidden">
          {t(mobileExpanded ? 'experience.hideMetrics' : 'experience.showMetrics')}
        </button>
      )}
    </div>
  )
}

const SPARK_TONE: Record<StatStripTone, string> = {
  neutral: "hsl(var(--primary))",
  destructive: "hsl(var(--destructive))",
  orange: "hsl(var(--severity-high))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--state-done))",
}

/** Mini gráfico de área com degradê (padrão do dashboard). Só com série real. */
export function MiniArea({ series, tone = "neutral" }: { series: number[]; tone?: StatStripTone }) {
  const id = React.useId().replace(/:/g, "")
  const w = 100, h = 28
  const min = Math.min(...series), max = Math.max(...series)
  const span = max - min || 1
  const pts = series.map((v, i) => [ (i / (series.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 6) ])
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const cor = SPARK_TONE[tone]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className="mt-2 block h-7 w-full">
      <defs>
        <linearGradient id={`sa-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#sa-${id})`} />
      <path d={line} fill="none" stroke={cor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
