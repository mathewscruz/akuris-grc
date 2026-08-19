/**
 * Painel lateral genérico de detalhe de registro (Envio 11 · T2 — regra do clique).
 * Usado nos módulos que ainda não tinham vista de detalhe própria.
 */
export const detalheRegisto = {
  pt: {
    /**
     * Rótulos de coluna para a trilha de auditoria.
     *
     * O visor lista os campos alterados pelo nome da coluna que o gatilho
     * gravou; sem estes rótulos, um UPDATE de contrato mostrava
     * "data_fim, valor, gestor_contrato" cru na tela.
     */
    trilhaCampos: {
      moeda: 'Moeda',
      dataAssinatura: 'Data de assinatura',
      areaSolicitante: 'Área solicitante',
      prazoRenovacao: 'Prazo de renovação (meses)',
      sla: 'SLA principal',
      numeroAditivo: 'Número do aditivo',
      motivo: 'Motivo',
      valorAnterior: 'Valor anterior',
      valorNovo: 'Valor novo',
      novaDataFim: 'Nova data de fim',
      justificativa: 'Justificativa',
    },
    detalheRegisto: {
      titulo: 'Detalhe do registro',
      abrirRegisto: 'Abrir registro',
      visao: 'Visão geral',
      criadoPor: 'Criado por',
      criadoEm: 'Criado em',
      atualizadoEm: 'Atualizado em',
      semValor: '—',
      semCampos: 'Este registro ainda não tem campos preenchidos.',
      fechar: 'Fechar',
      editar: 'Editar',
      algoritmo: 'Algoritmo',
      dataCriacao: 'Data de criação',
      observacoes: 'Observações',
      quantidade: 'Quantidade',
      fornecedor: 'Fornecedor',
      vencimento: 'Vencimento',
      valorRenovacao: 'Valor de renovação',
      sistema: 'Sistema',
      nivelPrivilegio: 'Nível de privilégio',
      tipoAcesso: 'Tipo de acesso',
      justificativa: 'Justificativa de negócio',
      concessao: 'Concessão',
      expiracao: 'Expiração',
      url: 'Endereço',
      responsavel: 'Responsável',
      dataFim: 'Data de fim',
    },
  },
  en: {
    trilhaCampos: {
      moeda: 'Currency',
      dataAssinatura: 'Signature date',
      areaSolicitante: 'Requesting area',
      prazoRenovacao: 'Renewal notice (months)',
      sla: 'Main SLA',
      numeroAditivo: 'Amendment number',
      motivo: 'Reason',
      valorAnterior: 'Previous value',
      valorNovo: 'New value',
      novaDataFim: 'New end date',
      justificativa: 'Rationale',
    },
    detalheRegisto: {
      titulo: 'Record details',
      abrirRegisto: 'Open record',
      visao: 'Overview',
      criadoPor: 'Created by',
      criadoEm: 'Created on',
      atualizadoEm: 'Updated on',
      semValor: '—',
      semCampos: 'This record has no filled fields yet.',
      fechar: 'Close',
      editar: 'Edit',
      algoritmo: 'Algorithm',
      dataCriacao: 'Created on',
      observacoes: 'Notes',
      quantidade: 'Quantity',
      fornecedor: 'Vendor',
      vencimento: 'Expiry date',
      valorRenovacao: 'Renewal value',
      sistema: 'System',
      nivelPrivilegio: 'Privilege level',
      tipoAcesso: 'Access type',
      justificativa: 'Business justification',
      concessao: 'Granted on',
      expiracao: 'Expires on',
      url: 'Address',
      responsavel: 'Owner',
      dataFim: 'End date',
    },
  },
};
