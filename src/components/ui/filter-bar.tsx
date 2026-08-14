import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, X, RotateCcw } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

interface FilterOption {
  value: string
  label: string
  count?: number
}

interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'text' | 'date'
  options?: FilterOption[]
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterConfig[]
  activeFiltersCount?: number
  onClearFilters?: () => void
  showFilterToggle?: boolean
  filtersOpen?: boolean
  onFiltersToggle?: () => void
  actions?: React.ReactNode
}

export function FilterBar({
  className,
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  filters = [],
  activeFiltersCount = 0,
  onClearFilters,
  showFilterToggle = true,
  filtersOpen = false,
  onFiltersToggle,
  actions,
  ...props
}: FilterBarProps) {
  const { t } = useLanguage()
  const placeholder = searchPlaceholder ?? t('common.searchPlaceholder')

  const getActiveFiltersCount = () => {
    if (activeFiltersCount > 0) return activeFiltersCount

    const activeCount = countActiveFilters(filters)

    if (searchValue) return activeCount + 1
    return activeCount
  }

  const hasActiveFilters = getActiveFiltersCount() > 0

  return (
    <div className={cn("space-y-4", className)} {...props}>
      {/* Top row with search and actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter toggle and actions */}
        <div className="flex items-center gap-2">
          {showFilterToggle && filters.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFiltersToggle}
              className={cn(
                "relative",
                filtersOpen && "bg-muted"
              )}
            >
              <Filter className="h-4 w-4 mr-2" />
              {t('filterBar.filters')}
              {hasActiveFilters && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                >
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
          )}

          {hasActiveFilters && onClearFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('filterBar.clear')}
            </Button>
          )}

          {actions}
        </div>
      </div>

      {/* Filters row */}
      {filtersOpen && filters.length > 0 && (
        <div className="flex gap-4 items-center flex-wrap p-4 bg-muted/30 rounded-lg border animate-fade-in">
          {filters.map((filter) => (
            <div key={filter.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {filter.label}
              </label>
              {filter.type === 'select' && filter.options ? (
                <Select value={filter.value} onValueChange={filter.onChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={filter.placeholder || filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filterBar.all')}</SelectItem>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center justify-between w-full">
                          <span>{option.label}</span>
                          {option.count !== undefined && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {option.count}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={filter.placeholder || filter.label}
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-40"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Active filters chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{t('filterBar.activeFilters')}</span>
          {searchValue && (
            <Badge variant="secondary" className="gap-1">
              {t('filterBar.search')}: "{searchValue}"
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onSearchChange?.("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters
            .filter(filter => filter.value && filter.value !== 'all' && filter.value !== '')
            .map((filter) => {
              const option = filter.options?.find(opt => opt.value === filter.value)
              return (
                <Badge key={filter.key} variant="secondary" className="gap-1">
                  {filter.label}: {option?.label || filter.value}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => filter.onChange('all')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            })}
        </div>
      )}
    </div>
  )
}

export default FilterBar