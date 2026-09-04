import * as React from "react"

import { cn } from "@/lib/utils"
import { useTableDensity } from "@/hooks/useTableDensity"

/**
 * Tabela base com densidade reativa global.
 * - `comfortable` (padrão): linhas mais espaçadas, header h-12, cell p-4
 * - `compact`: header h-9, cell py-2 px-3 — útil para grandes volumes
 * Densidade é controlada por `<DensityToggle />` + `useTableDensity` (localStorage).
 */
type Density = "compact" | "comfortable"
const DensityCtx = React.createContext<Density>("comfortable")

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
  const [density] = useTableDensity()
  return (
    <DensityCtx.Provider value={density}>
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          data-density={density}
          className={cn("akuris-table w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </DensityCtx.Provider>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  /* O realce do cabeçalho é por COLUNA, não pela linha.
     O `hover` do `TableRow` valia também aqui, e passar o rato em cima do
     cabeçalho pintava as dez colunas de uma vez — o que não diz nada, porque
     não há uma "linha de cabeçalho" para escolher. Fica desligado aqui e é o
     `TableHead` que trata do seu próprio realce. */
  <thead ref={ref} className={cn("akuris-table-header [&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      /*
       * O realce vive no padrão da tabela, não em cada módulo. A classe
       * desenha o mesmo degradê de Atividades Recentes e preserva as pontas
       * suaves mesmo em linhas clicáveis, selecionadas ou com células fixas.
       */
      "realce-linha-tabela border-b data-[state=selected]:bg-accent",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const density = React.useContext(DensityCtx)
  const sizing =
    density === "compact"
      ? "h-9 px-3"
      : "h-12 px-4"
  return (
    <th
      ref={ref}
      className={cn(
        sizing,
        /* O cabeçalho é uma etiqueta, não conteúdo: corpo mais pequeno que a
           célula, caixa alta e cor apagada. Antes tinha o MESMO tamanho do
           conteúdo e a tabela não tinha estrutura visível. */
        "text-left align-middle text-micro font-medium uppercase tracking-wide",
        "text-muted-foreground/75 [&:has([role=checkbox])]:pr-0",
        /* Só o botão de uma coluna ordenável reage ao rato. Um cabeçalho
           passivo que acende parece clicável e induz ao erro. */
        "transition-colors",
        className
      )}
      {...props}
    />
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const density = React.useContext(DensityCtx)
  const sizing = density === "compact" ? "py-2.5 px-3" : "p-4"
  return (
    <td
      ref={ref}
      className={cn(
        sizing,
        /* O conteúdo secundário recua para cinzento: o que fica preto é o
           nome do registo (ver `PRIMARY_CELL` no DataTable) e os estados. */
        "align-middle text-xs text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
})
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
