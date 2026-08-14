/**
 * DEFECT 5 — textos genéricos de bloqueio/validação de wizards (WizardDialog)
 * usados pelos assistentes "Novo Ativo", "Novo Controle" e "Novo Risco".
 * Namespace: p7Wizard.
 */
export const p7Wizard = {
  pt: {
    p7Wizard: {
      missingFieldsPrefix: 'Falta preencher',
      nextBlockedTooltip: 'Preencha os campos obrigatórios desta etapa antes de continuar.',
      ativos: {
        nameRequiredError: 'O nome do ativo é obrigatório.',
        typeRequiredError: 'O tipo do ativo é obrigatório.',
        stepIdentificationHasErrors: 'Há campos obrigatórios por preencher nesta etapa.',
        missingFieldName: 'Nome',
        missingFieldType: 'Tipo',
      },
      controles: {
        nameRequiredError: 'O nome do controle é obrigatório.',
        stepIdentificationHasErrors: 'Há campos obrigatórios por preencher nesta etapa.',
        missingFieldName: 'Nome',
      },
      riscos: {
        nameRequiredError: 'O nome do risco é obrigatório.',
        matrizRequiredError: 'A matriz de risco é obrigatória.',
        probabilidadeRequiredError: 'A probabilidade inicial é obrigatória.',
        impactoRequiredError: 'O impacto inicial é obrigatório.',
        stepIdentificationHasErrors: 'Há campos obrigatórios por preencher nesta etapa.',
        stepEvaluationHasErrors: 'Há campos obrigatórios por preencher nesta etapa.',
        missingFieldName: 'Nome',
        missingFieldMatriz: 'Matriz de risco',
        missingFieldProbabilidade: 'Probabilidade inicial',
        missingFieldImpacto: 'Impacto inicial',
      },
    },
  },
  en: {
    p7Wizard: {
      missingFieldsPrefix: 'Missing',
      nextBlockedTooltip: 'Fill in the required fields of this step before continuing.',
      ativos: {
        nameRequiredError: 'Asset name is required.',
        typeRequiredError: 'Asset type is required.',
        stepIdentificationHasErrors: 'There are required fields missing in this step.',
        missingFieldName: 'Name',
        missingFieldType: 'Type',
      },
      controles: {
        nameRequiredError: 'Control name is required.',
        stepIdentificationHasErrors: 'There are required fields missing in this step.',
        missingFieldName: 'Name',
      },
      riscos: {
        nameRequiredError: 'Risk name is required.',
        matrizRequiredError: 'Risk matrix is required.',
        probabilidadeRequiredError: 'Initial probability is required.',
        impactoRequiredError: 'Initial impact is required.',
        stepIdentificationHasErrors: 'There are required fields missing in this step.',
        stepEvaluationHasErrors: 'There are required fields missing in this step.',
        missingFieldName: 'Name',
        missingFieldMatriz: 'Risk matrix',
        missingFieldProbabilidade: 'Initial probability',
        missingFieldImpacto: 'Initial impact',
      },
    },
  },
};
