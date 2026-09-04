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
import { IconDownload, IconRefresh, IconChevronDown, IconChevronUp, IconSort } from '@/components/icons';
import { compararEscala } from '@/lib/ordem-de-escala'
import { useRecorteDaUrl } from '@/hooks/useRecorteDaUrl'

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
  /* Crítico > Alto > Médio > Baixo, e não C < A < M por alfabeto. Aqui e não
     em cada tabela: quem escrever a próxima coluna de criticidade herda-o. */
  const escala = compararEscala(a, b)
  if (escala !== null) return escala
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
  /**
   * Por que valor esta coluna ORDENA, quando não é o do `key`.
   *
   * Uma coluna que desenha uma coisa e guarda outra ordena pela outra, e o
   * resultado não se explica a ninguém. A severidade dos riscos mostrava o
   * nível efectivo e ordenava pelo INERENTE, e ainda por cima como texto:
   * descendente devolvia «Baixo, Médio, Crítico, Médio». Num registo de
   * riscos, «mostra-me os piores primeiro» é das perguntas mais feitas.
   *
   * Devolva um número quando a ordem é uma escala (severidade,
   * criticidade, prioridade) — alfabético põe Alto antes de Baixo antes de
   * Crítico, que é exactamente ao contrário do que interessa.
   */
  sortAccessor?: (item: T) => string | number | null | undefined
  className?: string
  /** Ordem dos campos no cartão de telemóvel (menor aparece primeiro). */
  mobilePriority?: number
  /** Campo disponível na tabela larga, mas omitido do cartão de telemóvel. */
  mobileHidden?: boolean
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
  /** Quantidade de campos essenciais antes de "Ver detalhes" no telemóvel. */
  mobileCollapsedFields?: number
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
  paginated = true,
  pageSize: initialPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  onRowClick,
  mobileCollapsedFields = 4,
}: DataTableProps<T>) {
  const { t } = useLanguage()
  const _searchPlaceholder = searchPlaceholder ?? t('common.searchPlaceholder')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(initialPageSize)
  const [expandedMobileRows, setExpandedMobileRows] = React.useState<Set<string>>(() => new Set())

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
  /*
     O recorte que veio do painel.

     Os cartões de KPI abrem uma gaveta com cinco linhas do recorte pedido e um
     botão «Ver todos» — que ia para a rota nua do módulo. Medido: «10 Alta ou
     crítica» levava a `/ativos` com as 12 linhas e o filtro em «Todas». Agora a
     gaveta manda a lista, e a tabela mostra-a com um chip que diz o que é e que
     se tira. Aqui, e não em doze páginas.
  */
  const recorte = useRecorteDaUrl()

  /*
     Se o recorte não conhece nenhuma destas linhas, não é desta tabela.

     Alguns KPIs contam uma coisa e navegam para a lista de outra — «tarefas de
     continuidade» conta tarefas e vai para a página dos PLANOS. Aplicar ali o
     recorte dava uma tabela vazia com um chip a explicá-la: pior do que a lista
     larga que havia antes, porque parece uma resposta. Zero correspondências =
     o recorte não é para aqui, e a tabela mostra o que mostrava.
  */
  const dadosRecortados = React.useMemo(() => {
    if (!recorte.ids) return data
    const recortados = data.filter((item) => recorte.ids!.has(String((item as any)?.id)))
    return recortados.length > 0 ? recortados : data
  }, [data, recorte.ids])

  const recorteAplicado = Boolean(recorte.ids) && dadosRecortados.length < data.length

  const aFiltrar =
    filtering?.active ||
    Boolean(searchValue?.trim()) ||
    filtrosActivos.length > 0 ||
    recorteAplicado

  const limparTudo = () => {
    filtering?.onClear()
    onSearchChange?.('')
    filtrosActivos.forEach((f) => f.onChange(f.options[0]?.value ?? ''))
    recorte.limpar()
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
    if (externalSort || !internalSort) return dadosRecortados
    const { field, direction } = internalSort
    const factor = direction === 'asc' ? 1 : -1
    const coluna = columns.find((c) => String(c.key) === field)
    const valor = (item: T) =>
      coluna?.sortAccessor ? coluna.sortAccessor(item) : (item as any)?.[field]
    return [...dadosRecortados].sort((a, b) => factor * compareValues(valor(a), valor(b)))
  }, [dadosRecortados, internalSort, externalSort, columns])

  // Reset page when data changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [data.length, pageSize, recorte.ids])

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = paginated
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData

  const rowId = React.useCallback((item: T, index: number) =>
    String((item as any).id ?? (item as any).codigo ?? index), [])
  const seenRows = React.useRef<Set<string>>(new Set())
  const rowsInitialized = React.useRef(false)
  const newRowsTimer = React.useRef<number | null>(null)
  const [newRows, setNewRows] = React.useState<Set<string>>(() => new Set())

  /* Diferencia “a lista terminou de carregar” de “entrou um registo”. O
     primeiro lote não pisca; IDs que surgem depois recebem o marcador curto.
     O conjunto é cumulativo para limpar um filtro não parecer inserção. */
  React.useEffect(() => {
    if (loading) return
    const ids = data.map(rowId)
    if (!rowsInitialized.current) {
      ids.forEach((id) => seenRows.current.add(id))
      rowsInitialized.current = true
      return
    }
    const added = ids.filter((id) => !seenRows.current.has(id))
    ids.forEach((id) => seenRows.current.add(id))
    if (added.length === 0) return
    setNewRows(new Set(added))
    if (newRowsTimer.current !== null) window.clearTimeout(newRowsTimer.current)
    newRowsTimer.current = window.setTimeout(() => setNewRows(new Set()), 950)
  }, [data, loading, rowId])

  React.useEffect(() => () => {
    if (newRowsTimer.current !== null) window.clearTimeout(newRowsTimer.current)
  }, [])

  const dataMotionKey = React.useMemo(() => [
    currentPage,
    pageSize,
    searchValue,
    activeSortField ?? '',
    activeSortDirection ?? '',
    filters.map((filter) => `${filter.key}:${filter.value}`).join('|'),
    paginatedData.map(rowId).join('|'),
  ].join('::'), [currentPage, pageSize, searchValue, activeSortField, activeSortDirection, filters, paginatedData, rowId])

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
      return <IconSort className="h-3.5 w-3.5 opacity-30 transition-opacity group-hover/th:opacity-70" strokeWidth={1.5} />
    }
    return activeSortDirection === 'asc'
      ? <IconChevronUp className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      : <IconChevronDown className="h-4 w-4 text-foreground" strokeWidth={1.5} />
  }

  const hasToolbar =
    (searchable && typeof onSearchChange === 'function') ||
    filters.length > 0 ||
    Boolean(onExport) ||
    Boolean(onRefresh)

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
    <div className={cn("bg-card", className)}>
      {/* Barra padrão do sistema: pesquisa à esquerda, filtros rotulados e acções à direita */}
      {hasToolbar && <div className="border-b border-border/60 p-4">
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
          activeFilterCount={countActiveFilters(filters)}
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
      </div>}

      {/* O recorte que veio do painel, dito por extenso e com saída.
          Sem isto a lista encolhia sem explicação — que é a outra maneira de
          mentir sobre o que está no ecrã. */}
      {recorteAplicado && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground">
            {t(`dashWidgets.drill.${recorte.de}.title`)}
            <span className="tabular-nums text-muted-foreground">({dadosRecortados.length})</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={recorte.limpar}
              aria-label={t('common.clearFilters')}
              title={t('common.clearFilters')}
            >
              <span aria-hidden>×</span>
            </Button>
          </span>
        </div>
      )}

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
          <div key={`mobile-${dataMotionKey}`} className="akuris-data-refresh divide-y border-t">
            {paginatedData.map((item, index) => {
              const acoes = columns.find(isActionsColumn)
              const semAcoes = columns.filter((c) => !isActionsColumn(c))
              // O cartão é encabeçado pelo nome do registo, não pela primeira
              // coluna — que costuma ser o código e não identifica nada a quem lê.
              const principal =
                semAcoes.find((c) => TITLE_KEYS.has(String(c.key).toLowerCase())) ?? semAcoes[0]
              const resto = semAcoes
                .filter((c) => c !== principal && !c.mobileHidden)
                .map((column, originalIndex) => ({ column, originalIndex }))
                .sort((a, b) =>
                  (a.column.mobilePriority ?? 100) - (b.column.mobilePriority ?? 100) ||
                  a.originalIndex - b.originalIndex
                )
                .map(({ column }) => column)
              const rowKey = String((item as any).id ?? index)
              const expanded = expandedMobileRows.has(rowKey)
              const visibleColumns = expanded ? resto : resto.slice(0, mobileCollapsedFields)
              const hasMore = resto.length > mobileCollapsedFields
              const abrir = onRowClick
                ? rowOpenProps(() => onRowClick(item), (item as any).titulo || (item as any).nome || undefined)
                : null
              const valor = (column: Column<T>) =>
                column.render
                  ? column.render(item[column.key as keyof T], item)
                  : String(item[column.key as keyof T] ?? '-')
              return (
                <div
                  key={rowId(item, index)}
                  data-focus-id={(item as any).id}
                  data-row-new={newRows.has(rowId(item, index)) || undefined}
                  {...(abrir ?? {})}
                  className={cn('akuris-data-card p-4 space-y-3', abrir?.className)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 font-medium">{principal && valor(principal)}</div>
                    {acoes && <div className="shrink-0">{valor(acoes)}</div>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {visibleColumns.map((column) => (
                      <div key={String(column.key)} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{column.label}</dt>
                        <dd className="text-sm">{valor(column)}</dd>
                      </div>
                    ))}
                  </dl>
                  {hasMore && (
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-expanded={expanded}
                      onClick={(event) => {
                        event.stopPropagation()
                        setExpandedMobileRows((current) => {
                          const next = new Set(current)
                          if (next.has(rowKey)) next.delete(rowKey)
                          else next.add(rowKey)
                          return next
                        })
                      }}
                    >
                      {expanded ? t('common.hideDetails') : t('common.showDetails')}
                      {expanded
                        ? <IconChevronUp className="h-4 w-4" strokeWidth={1.5} />
                        : <IconChevronDown className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ecrã largo: a tabela densa, que continua a ser a melhor leitura. */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-20">
            <TableRow>
              {columns.map((column, columnIndex) => {
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
                      isActionsColumn(column) && 'sticky right-0 z-10',
                      columnIndex === 0 && 'sticky left-0 z-20',
                      sortable && "select-none"
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="inline-flex w-full items-center gap-1.5 rounded-md py-2 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => handleSort(String(column.key))}
                      >
                        {column.label}
                        {getSortIcon(String(column.key))}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">{column.label}</div>
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody key={`desktop-${dataMotionKey}`} className="akuris-data-refresh">
            {!loading && data.length === 0 ? (
              <TableRow data-table-static="">
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
                  key={rowId(item, index)}
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
                  data-row-new={newRows.has(rowId(item, index)) || undefined}
                  {...(() => {
                    const base = onRowClick
                      ? rowOpenProps(() => onRowClick(item), (item as any).titulo || (item as any).nome || undefined)
                      : { className: 'transition-colors' };
                    // A célula fixa herda o fundo da linha (incluindo o realce
                    // do rato), por isso a linha precisa de um fundo próprio.
                    return { ...base, className: `bg-card ${base.className ?? ''}` };
                  })()}
                >

                  {columns.map((column, columnIndex) => (
                    <TableCell
                      key={String(column.key)}
                      className={cn(
                        column.className,
                        column === colunaPrincipal && PRIMARY_CELL,
                        isActionsColumn(column) && STICKY_CELL,
                        columnIndex === 0 && 'sticky left-0 z-10 bg-inherit',
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
              {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sortedData.length)} {t('common.of')} {sortedData.length}
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
