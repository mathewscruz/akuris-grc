import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/contexts/LanguageContext"

/**
 * Toolbar partilhada dos módulos de lista (Envio 8).
 *
 * Ordem fixa: pesquisa à esquerda; à direita os filtros (com rótulo visível)
 * e o alternador de vista quando existir.
 */
interface ModuleToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** Controlos de filtro já rotulados (ex.: <ToolbarField label=...>). */
  filters?: React.ReactNode
  /** Alternador de vista (tabela/kanban/calendário) quando existir. */
  viewSwitcher?: React.ReactNode
}

export function ModuleToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  viewSwitcher,
  className,
  children,
  ...props
}: ModuleToolbarProps) {
  const { t } = useLanguage()
  const showSearch = typeof onSearchChange === "function"

  const hasFilters = Boolean(filters)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className
      )}
      {...props}
    >
      {showSearch ? (
        <div className="w-full md:max-w-sm">
          {hasFilters && (
            <span aria-hidden className="hidden md:block text-[11px] font-medium uppercase tracking-wide leading-4 mb-1 invisible">
              &nbsp;
            </span>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder ?? t("common.searchPlaceholder")}
              className="pl-9"
              aria-label={searchPlaceholder ?? t("common.searchPlaceholder")}
            />
          </div>
        </div>
      ) : (
        <div />
      )}

      <div className="flex flex-wrap items-end gap-3 md:justify-end">
        {filters}
        {children}
        {viewSwitcher}
      </div>
    </div>
  )
}

/** Campo de filtro com rótulo visível acima do controlo. */
export function ToolbarField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-[150px] flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide leading-4 text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export default ModuleToolbar
