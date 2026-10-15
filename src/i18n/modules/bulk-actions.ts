/**
 * Ações em lote (item 3 do plano "menos interações").
 *
 * Textos da barra genérica `ModuleBulkActionBar`, usada pelos módulos
 * cujas listas passam a permitir selecionar vários registos e agir sobre
 * todos de uma vez (mudar situação, exportar, limpar seleção).
 */
export const bulkActions = {
  pt: {
    bulkActions: {
      selectedSingular: '{count} item selecionado',
      selectedPlural: '{count} itens selecionados',
      changeStatus: 'Alterar situação',
      exportSelected: 'Exportar selecionados',
      clearSelection: 'Limpar seleção',
      applying: 'Aplicando…',
      statusApplied: 'Situação atualizada em {count} itens.',
      statusAppliedPartial: '{done} itens atualizados; {skipped} não permitem esta ação.',
      statusError: 'Não foi possível atualizar a situação. Tente novamente.',
      exported: '{count} itens exportados.',
      selectAll: 'Selecionar todos desta página',
      selectRow: 'Selecionar {name}',
    },
  },
  en: {
    bulkActions: {
      selectedSingular: '{count} item selected',
      selectedPlural: '{count} items selected',
      changeStatus: 'Change status',
      exportSelected: 'Export selected',
      clearSelection: 'Clear selection',
      applying: 'Applying…',
      statusApplied: 'Status updated on {count} items.',
      statusAppliedPartial: '{done} items updated; {skipped} do not allow this action.',
      statusError: 'Could not update the status. Please try again.',
      exported: '{count} items exported.',
      selectAll: 'Select all on this page',
      selectRow: 'Select {name}',
    },
  },
};
