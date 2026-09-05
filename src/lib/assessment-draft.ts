export interface AssessmentCreationContext {
  fornecedorId?: string;
  fornecedorNome?: string;
  fornecedorEmail?: string;
  templateId?: string;
}

/** The header opens a blank form; a supplier/template action carries its context. */
export function assessmentCreationDraft(context?: AssessmentCreationContext | null) {
  return {
    fornecedor_id: context?.fornecedorId ?? null,
    fornecedor_nome: context?.fornecedorNome ?? '',
    fornecedor_email: context?.fornecedorEmail ?? '',
    template_id: context?.templateId ?? '',
  };
}
