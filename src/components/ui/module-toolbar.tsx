import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/contexts/LanguageContext"
import { Button } from "@/components/ui/button"
import { IconSearch, IconFilter, IconChevronDown, IconChevronUp } from '@/components/icons';

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
  /**
   * Quantos filtros estão aplicados, para o botão de telemóvel.
   *
   * Sem isto o botão dobrado esconderia filtros activos sem dizer que existem,
   * que é o defeito ao contrário: em vez de ocupar o ecrã, mentir sobre ele.
   */
  activeFilterCount?: number
  /** Alternador de vista (tabela/kanban/calendário) quando existir. */
  viewSwitcher?: React.ReactNode
}

export function ModuleToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilterCount = 0,
  viewSwitcher,
  className,
  children,
  ...props
}: ModuleToolbarProps) {
  const { t } = useLanguage()
  const showSearch = typeof onSearchChange === "function"

  // Um array vazio e um Fragment vazio são truthy em JavaScript. Contar os
  // filhos evita desenhar o segundo botão "Filtros" nas páginas que já têm a
  // sua própria barra (Planos de Ação era o caso visível no telemóvel).
  const hasFilters = React.Children.count(filters) > 0
  /* Abre já aberto quando há filtro aplicado: esconder o que está a mexer no
     resultado seria a mesma mentira, com outra roupa. */
  const [filtrosAbertos, setFiltrosAbertos] = React.useState(activeFilterCount > 0)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between",
        className
      )}
      {...props}
    >
      {showSearch ? (
        <div className="w-full md:max-w-sm">
          {hasFilters && (
            <span aria-hidden className="hidden md:block text-xs font-medium leading-4 mb-1 invisible">
              &nbsp;
            </span>
          )}
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
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

      {/*
        Em telemóvel os filtros ficam atrás de um botão.

        Medido em 375px: Activos tem quatro filtros, cada um com rótulo por cima
        e o controlo por baixo, empilhados — cerca de 450px antes do primeiro
        registo, num ecrã de 812px. Somando cabeçalho, acções e a faixa de KPIs,
        a primeira linha de dados chegava ao fundo do ecrã. Numa lista, os dados
        vêm primeiro e o filtro é a excepção.

        Havia um interruptor destes: a `DataTable` ainda declara `showFilters`,
        importa `countActiveFilters` e `IconFilter` — e não usa nenhum dos três.
        Desapareceu e deixou os restos.

        A partir de `md` nada muda: os filtros estão sempre à vista, que é onde
        há largura para eles.
      */}
      <div className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between xl:w-auto xl:justify-end">
        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="md:hidden w-full justify-between"
            aria-expanded={filtrosAbertos}
            onClick={() => setFiltrosAbertos((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <IconFilter className="h-4 w-4" strokeWidth={1.5} />
              {t("common.filters")}
              {/* `rounded-md` e não `rounded-full`: é uma caixa de texto, e o
                  raio redondo fica para avatar, ponto e barra de progresso —
                  é a mesma forma que o contador da barra lateral usa. */}
              {activeFilterCount > 0 && (
                <span className="rounded-md bg-primary/15 px-1.5 text-micro tabular-nums text-primary">
                  {activeFilterCount}
                </span>
              )}
            </span>
            {filtrosAbertos ? (
              <IconChevronUp className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <IconChevronDown className="h-4 w-4" strokeWidth={1.5} />
            )}
          </Button>
        )}
        <div
          className={cn(
            "flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-end md:justify-end",
            filtrosAbertos ? "flex" : "hidden",
          )}
        >
          {filters}
        </div>
        <div className="flex flex-wrap items-end gap-3 md:justify-end">
          {children}
          {viewSwitcher}
        </div>
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
  // O rótulo é um <span> solto: sem o grupo, o leitor de ecrã anunciava só
  // "caixa de combinação" e o utilizador não sabia que filtro estava a mexer.
  const labelId = React.useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn("flex min-w-[168px] shrink-0 flex-col gap-1", "[&_button[role=combobox]]:w-full", className)}
    >
      <span id={labelId} className="text-xs font-medium leading-4 text-muted-foreground">{label}</span>
      {children}
    </div>
  )

}
