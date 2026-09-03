/**
 * Chaves do envio P3 (p3-wizard). Estrutura: { pt: {...}, en: {...} }.
 * O dicionário pt-BR é derivado automaticamente do pt (ver lib/pt-variants.ts).
 *
 * Também usado pelo módulo Planos de Ação para os textos do assistente de
 * criação/edição (validação por etapa) e para os rótulos dos filtros da lista.
 */
export const p3Wizard = {
  pt: {
    planosAcaoWizard: {
      titleRequiredError: 'O título é obrigatório.',
      missingFieldsPrefix: 'Falta preencher',
      missingFieldTitle: 'Título',
      stepIdentificationHasErrors: 'Há campos obrigatórios por preencher nesta etapa.',
    },
    planosAcaoFiltros: {
      statusLabel: 'Status',
      priorityLabel: 'Prioridade',
      pageSizeLabel: 'Itens por página',
    },
  },
  en: {
    planosAcaoWizard: {
      titleRequiredError: 'Title is required.',
      missingFieldsPrefix: 'Missing',
      missingFieldTitle: 'Title',
      stepIdentificationHasErrors: 'There are required fields missing in this step.',
    },
    planosAcaoFiltros: {
      statusLabel: 'Status',
      priorityLabel: 'Priority',
      pageSizeLabel: 'Items per page',
    },
  },
};
