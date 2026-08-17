import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { AkurisPulse } from "@/components/ui/AkurisPulse"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Search, Filter, Download, RefreshCw, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { countActiveFilters } from "@/lib/filter-active"
import { ModuleToolbar, ToolbarField } from "@/components/ui/module-toolbar"
import { rowOpenProps } from "@/lib/row-interaction"


/** Colunas utilitárias que nunca são ordenáveis. */
const NON_SORTABLE_KEYS = new Set(['acoes', 'ações', 'actions', 'action', 'menu', 'select', 'seleccao', 'seleção'])

/** Comparação estável e acento-insensível para ordenação A-Z / Z-A. */
function compareValues(a: unknown, b: unknown): number {
  const emptyA = a === null || a === undefined || a === ''
  const emptyB = b === null || b === undefined || b === ''
  if (emptyA && emptyB) return 0
  if (emptyA) return 1
  if (emptyB) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b)
  const sa = String(a)
  const sb = String(b)
  const da = Date.parse(sa)
  const db = Date.parse(sb)
  const isoLike = /^\d{4}-\d{2}-\d{2}/
  if (!Number.isNaN(da) && !Number.isNaN(db) && isoLike.test(sa) && isoLike.test(sb)) return da - db
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
}

export interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: any, item: T) => React.ReactNode
  className?: string
}

export interface Filter {
  key: string
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filters?: Filter[]
  onExport?: () => void
  onRefresh?: () => void
  emptyState?: {
    icon?: React.ReactNode
    title: string
    description?: string
    action?: {
      label: string
      onClick: () => void
    }
  }
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (field: string) => void
  className?: string
  // Pagination props
  paginated?: boolean
  pageSize?: number
  pageSizeOptions?: number[]
  onRowClick?: (item: T) => void
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder,
  searchValue = "",
  onSearchChange,
  filters = [],
  onExport,
  onRefresh,
  emptyState,
  sortField,
  sortDirection,
  onSort,
  className,
  paginated = false,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  onRowClick
}: DataTableProps<T>) {
  const { t } = useLanguage()
  const _searchPlaceholder = searchPlaceholder ?? t('common.searchPlaceholder')
  const [showFilters, setShowFilters] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(initialPageSize)

  // Ordenação interna (A-Z / Z-A) quando a página não controla a ordenação.
  const [internalSort, setInternalSort] = React.useState<{ field: string; direction: 'asc' | 'desc' } | null>(null)
  const externalSort = typeof onSort === 'function'
  const activeSortField = externalSort ? sortField : internalSort?.field
  const activeSortDirection = externalSort ? sortDirection : internalSort?.direction

  const isSortable = (column: Column<T>) =>
    column.sortable !== false && !NON_SORTABLE_KEYS.has(String(column.key).toLowerCase())

  const sortedData = React.useMemo(() => {
    if (externalSort || !internalSort) return data
    const { field, direction } = internalSort
    const factor = direction === 'asc' ? 1 : -1
    return [...data].sort((a, b) => factor * compareValues(a?.[field], b?.[field]))
  }, [data, internalSort, externalSort])

  // Reset page when data changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [data.length, pageSize])

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = paginated
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData

  const handleSort = (field: string) => {
    if (onSort) {
      onSort(field)
      return
    }
    setInternalSort((prev) =>
      prev?.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    )
    setCurrentPage(1)
  }

  const getSortIcon = (field: string) => {
    if (activeSortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/th:opacity-60" strokeWidth={1.5} />
    }
    return activeSortDirection === 'asc'
      ? <ChevronUp className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      : <ChevronDown className="h-4 w-4 text-foreground" strokeWidth={1.5} />
  }

  if (loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 py-16", className)}>
        <AkurisPulse size={40} />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  // Always render the table structure to show headers
  return (
    <div className={cn("", className)}>
      {/* Barra padrão do sistema: pesquisa à esquerda, filtros rotulados e acções à direita */}
      <div className="p-4 sm:p-6 pb-4">
        <ModuleToolbar
          searchValue={searchable ? searchValue : undefined}
          onSearchChange={searchable ? (onSearchChange ?? (() => {})) : undefined}
          searchPlaceholder={_searchPlaceholder}
          filters={filters.map((filter) => (
            <ToolbarField key={filter.key} label={filter.label}>
              <Select
                value={filter.value || (filter.options.some((o) => o.value === 'all') ? 'all' : filter.value)}
                onValueChange={filter.onChange}
              >
                <SelectTrigger className="w-full min-w-[160px]">
                  <SelectValue placeholder={filter.options.find((o) => o.value === 'all')?.label ?? filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
          ))}
        >
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.export')}</span>
            </Button>
          )}
        </ModuleToolbar>
      </div>


      {/* Table - with horizontal scroll for mobile */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const sortable = isSortable(column)
                return (
                  <TableHead
                    key={String(column.key)}
                    aria-sort={
                      sortable && activeSortField === String(column.key)
                        ? activeSortDirection === 'asc' ? 'ascending' : 'descending'
                        : undefined
                    }
                    className={cn(
                      "group/th",
                      column.className,
                      sortable && "cursor-pointer select-none hover:bg-muted/50 transition-colors"
                    )}
                    onClick={() => sortable && handleSort(String(column.key))}
                  >
                    <div className="flex items-center gap-1.5">
                      {column.label}
                      {sortable && getSortIcon(String(column.key))}
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  {emptyState && (
                    <EmptyState
                      icon={emptyState.icon}
                      title={emptyState.title}
                      description={emptyState.description}
                      action={emptyState.action}
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => (
                <TableRow
                  key={item.id || index}
                  {...(onRowClick
                    ? rowOpenProps(() => onRowClick(item), (item as any).titulo || (item as any).nome || undefined)
                    : { className: 'transition-colors' })}
                >

                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={column.className}
                    >
                      {column.render
                        ? column.render(item[column.key as keyof T], item)
                        : String(item[column.key as keyof T] || '-')
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-t">
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, data.length)} {t('common.of')} {data.length}
            </span>
            <label className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              <span>{t('p3Filtros.table.rowsPerPage')}</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-[76px] h-8" title={t('p3Filtros.table.rowsPerPage')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page = i + 1;
                if (totalPages > 5) {
                  if (currentPage > 3) {
                    page = currentPage - 2 + i;
                  }
                  if (page > totalPages) {
                    page = totalPages - 4 + i;
                  }
                }
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}