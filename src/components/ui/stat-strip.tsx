import * as React from "react"
import { useMotionAllowed } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import { useKpiDrillDown } from "@/components/dashboard/KpiDrillDownProvider"
import type { DrillDownKey } from "@/components/dashboard/KpiDrillDownDrawer"
import type { LucideIcon } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useSerieSemanal, type TabelaSerie } from "@/hooks/useSerieSemanal"
import {
  RiscosIcon, ControlesIcon, AuditoriasIcon, AtivosIcon, IncidentesIcon, GapAnalysisIcon, DueDiligenceIcon,
  DocumentosIcon, DenunciasIcon, PlanosAcaoIcon, ProjetosIcon, LicencasIcon, ChavesIcon, ContratosIcon,
  PrivacidadeIcon, SistemasIcon, ContasPrivilegiadasIcon, RevisaoAcessosIcon, ContinuidadeIcon, RelatoriosIcon,
  AkurisSidebarIcon,
} from "@/components/icons"

const BAND_ART = {
  riscos: RiscosIcon, controles: ControlesIcon, auditorias: AuditoriasIcon, ativos: AtivosIcon, incidentes: IncidentesIcon,
  gap: GapAnalysisIcon, dueDiligence: DueDiligenceIcon, documentos: DocumentosIcon, denuncias: DenunciasIcon,
  planosAcao: PlanosAcaoIcon, projetos: ProjetosIcon, licencas: LicencasIcon, chaves: ChavesIcon, contratos: ContratosIcon,
  privacidade: PrivacidadeIcon, sistemas: SistemasIcon, contas: ContasPrivilegiadasIcon, revisaoAcessos: RevisaoAcessosIcon,
  continuidade: ContinuidadeIcon, relatorios: RelatoriosIcon,
} as const
export type StatBandModule = keyof typeof BAND_ART

/** Desenho de fundo do módulo: traço fino, grande, cortado pela borda direita. */
function StatBandArt({ module }: { module?: StatBandModule }) {
  const Art = module ? BAND_ART[module] : null
  return (
    <span aria-hidden="true" className="akuris-stat-band-art pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 sm:-right-4">
      {Art ? <Art size={192} strokeWidth={0.18} className="h-32 w-32 sm:h-48 sm:w-48" /> : <AkurisSidebarIcon className="h-32 w-32 sm:h-48 sm:w-48" />}
    </span>
  )
}

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
  /** Divisão real do valor (barra + legenda). Itens com valor 0 continuam na legenda. */
  breakdown?: StatStripBreakdown[]
  /** Linha de alerta curta com ícone de relógio (ex.: "6 atrasados"). */
  alert?: { label: string; tone?: StatStripTone }
  /** Legenda sob o número do destaque (ex.: "riscos ativos"). */
  caption?: string
  /** Força este item como destaque (por omissão, o primeiro). */
  hero?: boolean
}

export type StatStripBreakdownTone =
  | "critical" | "high" | "medium" | "low" | "done" | "active" | "rest" | "muted" | "primary"

export interface StatStripBreakdown {
  label: string
  value: number
  tone: StatStripBreakdownTone
}

export const BREAKDOWN_DOT: Record<StatStripBreakdownTone, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  done: "bg-state-done",
  active: "bg-state-active",
  rest: "bg-state-rest",
  muted: "bg-muted-foreground/50",
  primary: "bg-primary",
}

/** Percentagens inteiras de cada segmento; soma 0 → lista vazia (sem barra). */
export function breakdownSegments(items: StatStripBreakdown[] = []) {
  const total = items.reduce((acc, b) => acc + Math.max(0, b.value), 0)
  if (total <= 0) return []
  return items.filter((b) => b.value > 0).map((b) => ({ ...b, percent: (b.value / total) * 100 }))
}

interface StatStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatStripItem[]
  /** Tabela do módulo: o cartão de TOTAL ganha o mini gráfico com o total acumulado real. */
  serieTabela?: TabelaSerie
  loading?: boolean
  error?: boolean
  /** Módulo que define o desenho de fundo da faixa. */
  module?: StatBandModule
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

export function StatStrip({ items: itemsIn, serieTabela, loading = false, error = false, module, className, ...props }: StatStripProps) {
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
      return item.mobilePriority ?? (item.hero || item === items[0] ? 0 : attention ? 1 : 10 + items.indexOf(item))
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
          "akuris-stat-band grid grid-cols-2 overflow-hidden rounded-2xl border sm:grid-cols-3 lg:flex lg:items-stretch",
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
            <div className="h-3 w-24 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            <div className="mt-3 h-7 w-14 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            <div className="mt-2 h-3 w-32 max-w-full animate-pulse rounded bg-white/10/80 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) return null

  const heroIndex = Math.max(0, items.findIndex((it) => it.hero))
  const ordered = [items[heroIndex], ...items.filter((_, i) => i !== heroIndex)]

  return (
    <div
      id={summaryId}
      className={cn(
        "akuris-stat-band relative grid grid-cols-2 overflow-hidden rounded-xl border lg:flex lg:items-stretch lg:py-5",
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="akuris-stat-band-glow pointer-events-none absolute inset-0" />
      <StatBandArt module={module} />
      {ordered.map((item, index) => {
        const isHero = index === 0
        const numeric = metricNumber(item.value)
        const unavailable = error || item.dataState === 'unavailable'
        const interactive = !unavailable && (!!item.onClick || !!item.drillDown)
        const segments = unavailable ? [] : breakdownSegments(item.breakdown)
        const total = segments.reduce((acc, b) => acc + b.value, 0)
        const list = unavailable ? [] : (item.breakdown ?? [])
        const mobileIdx = index - 1
        const zero = numeric === 0 && item.zeroState ? item.zeroState.label : undefined
        const caption = unavailable ? t('experience.unavailable') : isHero ? (zero ?? item.caption ?? item.context) : (!item.alert ? zero ?? item.context : undefined)
        const alertLabel = item.alert?.label

        const activate = () => {
          if (item.onClick) return item.onClick()
          if (item.drillDown) drill.open(item.drillDown)
        }

        const content = (
          <>
            <span className="band-label block truncate text-[10px] font-semibold uppercase tracking-[0.14em]">{item.label}</span>
            <span className={cn("mt-2 block font-bold leading-none tracking-[-0.04em] tabular-nums", isHero ? "band-fg text-[2.8rem]" : "band-accent text-[2.2rem]", item.attentionPulse && "akuris-risk-attention")}>
              {unavailable ? '—' : <AnimatedMetricValue value={item.value} />}
            </span>
            {caption && <span className={cn("band-muted mt-1.5 block", isHero ? "text-[13px]" : "text-xs")}>{caption}</span>}
            {!isHero && !unavailable && alertLabel && (
              <span className="band-accent mt-2 inline-flex items-center gap-1.5 text-xs font-semibold">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                {alertLabel}
              </span>
            )}
            {isHero && segments.length > 0 && (
              <span role="img" aria-label={segments.map((sg) => `${sg.label}: ${sg.value}`).join(", ")} className="band-track mt-5 flex h-[22px] w-full overflow-hidden rounded-full">
                {segments.map((sg) => (
                  <span key={sg.label} className={cn("akuris-motion-data block h-full transition-[width] motion-reduce:transition-none", BAND_TONE[sg.tone])} style={{ width: `${sg.percent}%` }} />
                ))}
              </span>
            )}
            {isHero && total > 0 && (
              <span className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:flex sm:justify-between">
                {list.map((b) => (
                  <span key={b.label} className="flex min-w-0 flex-col gap-0.5 text-xs">
                    <span className="band-fg flex items-center gap-2"><span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", BAND_TONE[b.tone])} />{b.label}</span>
                    <span className="band-muted pl-[18px] tabular-nums">{b.value} ({Math.round((b.value / total) * 100)}%)</span>
                  </span>
                ))}
              </span>
            )}
            {!isHero && list.length > 0 && (
              <span className={cn("flex flex-col gap-2 text-xs", alertLabel ? "mt-4" : "mt-[2.6rem]")}>
                {list.map((b) => (
                  <span key={b.label} className="flex items-center justify-between gap-4">
                    <span className="band-fg flex min-w-0 items-center gap-2"><span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", BAND_TONE[b.tone])} /><span className="truncate">{b.label}</span></span>
                    <span className="band-fg tabular-nums">{b.value}</span>
                  </span>
                ))}
              </span>
            )}
          </>
        )

        const pad = isHero ? "px-5 py-5 lg:px-8 lg:py-0" : "px-4 py-4 lg:px-9 lg:py-0"
        return (
          <div
            key={item.key ?? `${item.label}-${index}`}
            data-mobile-hidden={!isHero && !mobileExpanded && mobileOrder.indexOf(item) >= 2}
            style={{ '--metric-order': mobileOrder.indexOf(item) } as React.CSSProperties}
            className={cn(
              "akuris-stat-item band-divider relative z-[1] min-w-0",
              isHero
                ? "col-span-2 border-b lg:flex-[1.55] lg:border-b-0"
                : cn("lg:flex-1 lg:border-l", mobileIdx % 2 === 1 && "border-l", mobileIdx >= 2 && "border-t lg:border-t-0",
                    mobileIdx === ordered.length - 2 && mobileIdx % 2 === 0 && "col-span-2 lg:col-span-1")
            )}
          >
            {interactive ? (
              <button type="button" onClick={activate} title={item.hint ?? item.label} aria-label={`${item.label}: ${item.value}`}
                className={cn("relative flex h-full w-full cursor-pointer flex-col items-stretch justify-start rounded-xl text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary", pad)}>
                {content}
              </button>
            ) : (
              <div className={cn("relative flex h-full flex-col justify-start", pad)} title={item.hint ?? item.label}>{content}</div>
            )}
          </div>
        )
      })}
      {items.length > 2 && (
        <button type="button" aria-expanded={mobileExpanded} aria-controls={summaryId} onClick={() => setMobileExpanded((value) => !value)} className="band-accent band-divider order-last col-span-2 min-h-9 border-t px-4 py-2 text-xs font-medium focus-visible:outline-none sm:hidden">
          {t(mobileExpanded ? 'experience.hideMetrics' : 'experience.showMetrics')}
        </button>
      )}
    </div>
  )
}

export const BAND_TONE: Record<StatStripBreakdownTone, string> = {
  critical: "band-critical", high: "band-high", medium: "band-medium", low: "band-low",
  done: "band-low", active: "band-high", rest: "band-rest", muted: "band-rest", primary: "band-primary",
}

const SPARK_TONE: Record<StatStripTone, string> = {
  neutral: "hsl(var(--primary))",
  destructive: "hsl(var(--destructive))",
  orange: "hsl(var(--severity-high))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--state-done))",
}

/** Linha com contexto: um ponto por semana, valor inicial → atual, base tracejada e período. Só com série real. */
export function MiniArea({ series, tone = "neutral" }: { series: number[]; tone?: StatStripTone }) {
  const { t } = useLanguage()
  const id = React.useId().replace(/:/g, "")
  const w = 100, h = 40
  const min = Math.min(...series), max = Math.max(...series)
  const span = max - min || 1
  const pts = series.map((v, i) => [(i / (series.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 10)])
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const cor = SPARK_TONE[tone]
  const last = series.length - 1
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-micro tabular-nums text-muted-foreground">
        <span>{series[0]}</span>
        <span className="font-semibold" style={{ color: cor }}>{series[last]}</span>
      </div>
      <div className="relative h-10 w-full">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={`sa-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={cor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2={w} y1={h - 4} y2={h - 4} className="stroke-border" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#sa-${id})`} />
          <path d={line} fill="none" stroke={cor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {pts.map(([x, y], i) => (
          <span
            key={i}
            title={`${t("experience.semanaN", { n: i + 1 })}: ${series[i]}`}
            className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full", i === last ? "h-2 w-2 bg-card ring-2" : "h-1.5 w-1.5")}
            style={{ left: `${x}%`, top: `${(y / h) * 100}%`, backgroundColor: i === last ? undefined : cor, ["--tw-ring-color" as string]: cor }}
          />
        ))}
      </div>
      <p className="mt-1 text-micro text-muted-foreground">{t("experience.ultimasSemanas", { n: series.length })}</p>
    </div>
  )
}
