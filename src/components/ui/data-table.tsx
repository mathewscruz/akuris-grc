import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { AkurisPulse } from "@/components/ui/AkurisPulse"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { useLanguage } from "@/contexts/LanguageContext"
import { countActiveFilters } from "@/lib/filter-active"
import { ModuleToolbar, ToolbarField } from "@/components/ui/module-toolbar"
import { rowOpenProps } from "@/lib/row-interaction"
import { IconSearch, IconFilter, IconDownload, IconRefresh, IconChevronDown, IconChevronUp, IconSort } from '@/components/icons';

/** Colunas utilitárias que nunca são ordenáveis. */
const NON_SORTABLE_KEYS = new Set(['acoes', 'ações', 'actions', 'action', 'menu', 'select', 'seleccao', 'seleção'])

/** Colunas que servem de título do cartão em telemóvel, por ordem de preferência. */
const TITLE_KEYS = new Set(['nome', 'name', 'titulo', 'título', 'title'])

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
  /**
   * Para a página que tem a SUA barra de busca e filtros, fora da tabela.
   *
   * Planos de Ação é o caso: passa `searchable={false}` porque a busca
   * vive no `ModuleToolbar` da página. A tabela não via nem o texto nem
   * os filtros, e continuava a dizer «Você não possui itens pendentes no
   * momento» a quem tinha cinco e estava só a filtrar.
   */
  filtering?: { active: boolean; onClear: () => void }
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
  filtering,
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

  /**
   * Filtrar e não ter são coisas diferentes, e a tabela sabe distingui-las.
   *
   * Medido no navegador: procurar "zzqxwv999" em Contratos — que tem três
   * contratos — devolvia «Comece criando contratos para gerenciar suas
   * parcerias», com um botão «Novo Contrato». Em Incidentes, com cinco
   * incidentes: «Registre o primeiro incidente para começar o monitoramento».
   * Em Sistemas, com três: «Cadastre um novo sistema para começar». O produto
   * dizia a quem tinha dados que não tinha nenhum, e oferecia a acção errada:
   * criar, quando o que resolve é limpar o filtro.
   *
   * Quatro dos dez módulos erravam; os outros seis resolviam-no cada um à sua
   * maneira, e um deles com a frase escrita à mão em português — que ficava em
   * português com a aplicação em inglês. Passa a ser a tabela a decidir, uma
   * vez só: se há busca ou filtro activo e o resultado é zero, o ecrã vazio é
   * o de «nenhum resultado», com o botão que limpa.
   */
  const filtrosActivos = (filters ?? []).filter(
    (f) => f.value !== (f.options[0]?.value ?? ''),
  )
  const aFiltrar =
    filtering?.active || Boolean(searchValue?.trim()) || filtrosActivos.length > 0

  const limparTudo = () => {
    filtering?.onClear()
    onSearchChange?.('')
    filtrosActivos.forEach((f) => f.onChange(f.options[0]?.value ?? ''))
  }

  const ecraVazio = aFiltrar
    ? {
        icon: emptyState?.icon,
        title: t('common.noResults'),
        description: t('common.noResultsHint'),
        action: { label: t('common.clearFilters'), onClick: limparTudo },
      }
    : emptyState

  // Ordenação interna (A-Z / Z-A) quando a página não controla a ordenação.
  const [internalSort, setInternalSort] = React.useState<{ field: string; direction: 'asc' | 'desc' } | null>(null)
  const externalSort = typeof onSort === 'function'
  const activeSortField = externalSort ? sortField : internalSort?.field
  const activeSortDirection = externalSort ? sortDirection : internalSort?.direction

  const isSortable = (column: Column<T>) =>
    column.sortable !== false && !NON_SORTABLE_KEYS.has(String(column.key).toLowerCase())

  /**
   * A coluna de ações fica colada à direita. Com 10 colunas a tabela passa dos
   * 1190px e, num ecrã de 1384px, o menu de três pontos de cada linha ficava
   * fora da área visível — sem barra de rolagem aparente e ainda por baixo do
   * botão flutuante do assistente.
   */
  const isActionsColumn = (column: Column<T>) =>
    NON_SORTABLE_KEYS.has(String(column.key).toLowerCase())
  const STICKY_CELL = 'sticky right-0 z-10 bg-inherit'
  /* A coluna que identifica o registo é a única em corpo de texto e cor
     plena. Sem isto, o nome pesava o mesmo que um "v1" ou um travessão. */
  const PRIMARY_CELL = 'text-sm font-medium text-foreground'
  const colunasSemAcoes = columns.filter((c) => !isActionsColumn(c))
  const colunaPrincipal =
    colunasSemAcoes.find((c) => TITLE_KEYS.has(String(c.key).toLowerCase())) ?? colunasSemAcoes[0]

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
      return <IconSort className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/th:opacity-60" strokeWidth={1.5} />
    }
    return activeSortDirection === 'asc'
      ? <IconChevronUp className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      : <IconChevronDown className="h-4 w-4 text-foreground" strokeWidth={1.5} />
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
          /*
            Sem `onSearchChange` de quem chama, NÃO se desenha caixa de busca.

            Havia aqui um `?? (() => {})`. Como o `ModuleToolbar` decide mostrar
            a busca por `typeof onSearchChange === "function"`, aquele handler
            de mentira contava como função: o campo aparecia, presa a
            `searchValue = ""`, com o `onChange` a não fazer nada. Quem
            escrevia não via NEM AS LETRAS -- lia-se como aplicação travada, não
            como busca sem resultados. Eram oito ecrãs assim.

            Melhor não oferecer do que oferecer algo que não responde.
          */
          onSearchChange={searchable ? onSearchChange : undefined}
          searchPlaceholder={_searchPlaceholder}
          filters={filters.map((filter) => (
            <ToolbarField key={filter.key} label={filter.label}>
              <Select
                value={filter.value || (filter.options.some((o) => o.value === 'all') ? 'all' : filter.value)}
                onValueChange={filter.onChange}
              >
                <SelectTrigger aria-label={filter.label} className="w-full min-w-[160px]">
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
          {/* `aria-label`: abaixo de `sm` o rótulo destes dois botões está
              escondido e sobra um ícone sozinho — no telemóvel o leitor de
              ecrã anunciava «botão», sem dizer qual. O nome fica sempre, a
              palavra continua a aparecer só quando há largura para ela. */}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} aria-label={t('common.refresh')}>
              <IconRefresh className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} aria-label={t('common.export')}>
              <IconDownload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common.export')}</span>
            </Button>
          )}
        </ModuleToolbar>
      </div>

      {/* Telemóvel: cartão por registo.
          A tabela tem até dez colunas e ~1190px; espremida em 375px, os
          cabeçalhos e os nomes partiam letra a letra ("Có/di/go"). O cartão
          empilha rótulo e valor e mantém as ações no canto. */}
      <div className="md:hidden">
        {!loading && data.length === 0 ? (
          ecraVazio && (
            <EmptyState
              icon={ecraVazio.icon}
              title={ecraVazio.title}
              description={ecraVazio.description}
              action={ecraVazio.action}
            />
          )
        ) : (
          <div className="divide-y border-t">
            {paginatedData.map((item, index) => {
              const acoes = columns.find(isActionsColumn)
              const semAcoes = columns.filter((c) => !isActionsColumn(c))
              // O cartão é encabeçado pelo nome do registo, não pela primeira
              // coluna — que costuma ser o código e não identifica nada a quem lê.
              const principal =
                semAcoes.find((c) => TITLE_KEYS.has(String(c.key).toLowerCase())) ?? semAcoes[0]
              const resto = semAcoes.filter((c) => c !== principal)
              const abrir = onRowClick
                ? rowOpenProps(() => onRowClick(item), (item as any).titulo || (item as any).nome || undefined)
                : null
              const valor = (column: Column<T>) =>
                column.render
                  ? column.render(item[column.key as keyof T], item)
                  : String(item[column.key as keyof T] ?? '-')
              return (
                <div
                  key={item.id || index}
                  data-focus-id={(item as any).id}
                  {...(abrir ?? {})}
                  className={cn('p-4 space-y-3', abrir?.className)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 font-medium">{principal && valor(principal)}</div>
                    {acoes && <div className="shrink-0">{valor(acoes)}</div>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {resto.map((column) => (
                      <div key={String(column.key)} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{column.label}</dt>
                        <dd className="text-sm">{valor(column)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ecrã largo: a tabela densa, que continua a ser a melhor leitura. */}
      <div className="hidden md:block overflow-x-auto">
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
                      /* A coluna de Ações é fixa, portanto precisa de fundo
                         opaco para tapar o que passa por baixo — e é por isso
                         que ficava de fora do realce, com o branco a cobrir a
                         tinta da linha. O realce dela vem do `hover:bg-accent`
                         do `TableHead`, que é igualmente opaco. */
                      isActionsColumn(column) && `${STICKY_CELL} bg-card`,
                      sortable && "cursor-pointer select-none"
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
                  {ecraVazio && (
                    <EmptyState
                      icon={ecraVazio.icon}
                      title={ecraVazio.title}
                      description={ecraVazio.description}
                      action={ecraVazio.action}
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => (
                <TableRow
                  key={item.id || index}
                  /*
                    O alvo do `?focus=<id>`.

                    `useFocusRow` procura por `data-focus-id`, e o `DataTable`
                    nao o emitia -- por isso o link profundo nao fazia nada em
                    NENHUM dos onze modulos que usam esta tabela. Ficava cinco
                    segundos em polling e desistia em silencio: a pagina abria
                    no topo e o registo procurado nao era destacado.

                    Quem gera estes links: a gaveta de KPI do painel, o feed de
                    atividades, a busca global e o "plano de acao ligado" na
                    ficha de um risco ou controlo. Quatro caminhos, todos
                    mortos do lado de ca.
                  */
                  data-focus-id={(item as any).id}
                  {...(() => {
                    const base = onRowClick
                      ? rowOpenProps(() => onRowClick(item), (item as any).titulo || (item as any).nome || undefined)
                      : { className: 'transition-colors' };
                    // A célula fixa herda o fundo da linha (incluindo o realce
                    // do rato), por isso a linha precisa de um fundo próprio.
                    return { ...base, className: `bg-card ${base.className ?? ''}` };
                  })()}
                >

                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={cn(
                        column.className,
                        column === colunaPrincipal && PRIMARY_CELL,
                        isActionsColumn(column) && STICKY_CELL,
                      )}
                    >
                      {column.render
                        ? column.render(item[column.key as keyof T], item)
                        /* `??` e não `||`: um `0` (ou `false`) é um valor, não
                           uma ausência. Com `||`, uma licença com 0 postos lia-se
                           "—" na tabela e "0" no cartão do telemóvel -- o mesmo
                           dado com duas verdades conforme o tamanho do ecrã. */
                        : String(item[column.key as keyof T] ?? '-')
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