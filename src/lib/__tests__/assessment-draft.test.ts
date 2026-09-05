import { describe, expect, it } from 'vitest';
import { assessmentCreationDraft } from '../assessment-draft';

describe('entrada da criação de avaliação', () => {
  it('aceita o evento sem detail emitido pelo cabeçalho', () => {
    const event = new CustomEvent('createAssessment');
    expect(assessmentCreationDraft(event.detail)).toEqual({ fornecedor_id: null, fornecedor_nome: '', fornecedor_email: '', template_id: '' });
  });
  it('preserva o fornecedor e o modelo de origem sem reaproveitar um formulário anterior', () => {
    expect(assessmentCreationDraft({ fornecedorId: 'f-1', fornecedorNome: 'Fornecedor', templateId: 't-1' })).toEqual({ fornecedor_id: 'f-1', fornecedor_nome: 'Fornecedor', fornecedor_email: '', template_id: 't-1' });
    expect(assessmentCreationDraft().fornecedor_id).toBeNull();
  });
});
