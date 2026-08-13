export const contratosDialogs = {
  pt: {
    contratosDialogs: {
      relatoriosContratos: {
        csvNumero: 'Numero',
        csvNome: 'Nome',
        csvTipo: 'Tipo',
        csvStatus: 'Status',
        csvValorTotal: 'Valor Total',
        csvDataInicio: 'Data Inicio',
        csvDataFim: 'Data Fim',
        pdfNumero: 'Numero',
        pdfNome: 'Nome',
        pdfTipo: 'Tipo',
        pdfStatus: 'Status',
        pdfValor: 'Valor',
        chartMilestonesByMonth: 'Marcos por Mês',
      },
      templatesContratos: {
        template1: {
          nome: 'Prestação de Serviços - TI',
          descricao: 'Template para contratos de prestação de serviços de TI',
          objetoPadrao: 'Prestação de serviços de tecnologia da informação',
          slaPadrao: 'Disponibilidade: 99.5% | Tempo de resposta: 4 horas | Tempo de resolução: 24 horas',
          penalidadesPadrao: 'Multa de 0,1% sobre o valor mensal por descumprimento de SLA',
          clausulasPadrao: `CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de tecnologia da informação, conforme especificações técnicas detalhadas no Anexo I.

CLÁUSULA 2ª - DA VIGÊNCIA
O presente contrato terá vigência de [PRAZO] meses, iniciando-se em [DATA_INICIO] e encerrando-se em [DATA_FIM].

CLÁUSULA 3ª - DO VALOR E FORMA DE PAGAMENTO
Pelo objeto do presente contrato, a CONTRATANTE pagará à CONTRATADA o valor total de R$ [VALOR], conforme cronograma de pagamento estabelecido no Anexo II.

CLÁUSULA 4ª - DOS NÍVEIS DE SERVIÇO
A CONTRATADA deverá manter os seguintes níveis de serviço:
- Disponibilidade: [SLA_DISPONIBILIDADE]%
- Tempo de resposta: [SLA_RESPOSTA]
- Tempo de resolução: [SLA_RESOLUCAO]`,
        },
        template2: {
          nome: 'Fornecimento de Materiais',
          descricao: 'Template para contratos de fornecimento de materiais e equipamentos',
          objetoPadrao: 'Fornecimento de materiais e equipamentos',
          penalidadesPadrao: 'Multa de 1% sobre o valor da entrega por atraso',
          clausulasPadrao: `CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto o fornecimento de materiais e/ou equipamentos, conforme especificações técnicas e quantidades detalhadas no Anexo I.

CLÁUSULA 2ª - DAS ENTREGAS
As entregas deverão ser realizadas conforme cronograma estabelecido, respeitando prazos, locais e quantidades especificadas.

CLÁUSULA 3ª - DA GARANTIA
Todos os materiais/equipamentos fornecidos deverão ter garantia mínima de [PRAZO_GARANTIA] contra defeitos de fabricação.`,
        },
        template3: {
          nome: 'Locação de Equipamentos',
          descricao: 'Template para contratos de locação de equipamentos',
          objetoPadrao: 'Locação de equipamentos',
          slaPadrao: 'Manutenção corretiva em até 24 horas',
          penalidadesPadrao: 'Desconto proporcional no aluguel por indisponibilidade',
          clausulasPadrao: `CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a locação de equipamentos conforme especificado no Anexo I.

CLÁUSULA 2ª - DO ALUGUEL
O valor mensal do aluguel é de R$ [VALOR_MENSAL], sendo reajustado anualmente pelo IPCA.

CLÁUSULA 3ª - DA MANUTENÇÃO
A manutenção preventiva e corretiva dos equipamentos será de responsabilidade da LOCADORA.`,
        },
      },
      aditivosDialog: {
        zodNumeroRequired: 'Número do aditivo é obrigatório',
        zodTipoRequired: 'Tipo é obrigatório',
        zodMotivoRequired: 'Motivo é obrigatório',
        zodJustificativaRequired: 'Justificativa é obrigatória',
      },
    },
  },
  en: {
    contratosDialogs: {
      relatoriosContratos: {
        csvNumero: 'Number',
        csvNome: 'Name',
        csvTipo: 'Type',
        csvStatus: 'Status',
        csvValorTotal: 'Total Value',
        csvDataInicio: 'Start Date',
        csvDataFim: 'End Date',
        pdfNumero: 'Number',
        pdfNome: 'Name',
        pdfTipo: 'Type',
        pdfStatus: 'Status',
        pdfValor: 'Value',
        chartMilestonesByMonth: 'Milestones by Month',
      },
      templatesContratos: {
        template1: {
          nome: 'IT Service Provision',
          descricao: 'Template for IT service provision contracts',
          objetoPadrao: 'Provision of information technology services',
          slaPadrao: 'Availability: 99.5% | Response time: 4 hours | Resolution time: 24 hours',
          penalidadesPadrao: 'Fine of 0.1% of the monthly value for SLA non-compliance',
          clausulasPadrao: `CLAUSE 1 - PURPOSE
This contract has as its purpose the provision of information technology services, as detailed in the technical specifications in Annex I.

CLAUSE 2 - TERM
This contract shall be valid for [PRAZO] months, starting on [DATA_INICIO] and ending on [DATA_FIM].

CLAUSE 3 - VALUE AND PAYMENT TERMS
For the purpose of this contract, the CONTRACTING PARTY shall pay the CONTRACTOR the total amount of R$ [VALOR], according to the payment schedule established in Annex II.

CLAUSE 4 - SERVICE LEVELS
The CONTRACTOR must maintain the following service levels:
- Availability: [SLA_DISPONIBILIDADE]%
- Response time: [SLA_RESPOSTA]
- Resolution time: [SLA_RESOLUCAO]`,
        },
        template2: {
          nome: 'Supply of Materials',
          descricao: 'Template for material and equipment supply contracts',
          objetoPadrao: 'Supply of materials and equipment',
          penalidadesPadrao: 'Fine of 1% of the delivery value for delay',
          clausulasPadrao: `CLAUSE 1 - PURPOSE
This contract has as its purpose the supply of materials and/or equipment, according to the technical specifications and quantities detailed in Annex I.

CLAUSE 2 - DELIVERIES
Deliveries must be made according to the established schedule, respecting deadlines, locations and specified quantities.

CLAUSE 3 - WARRANTY
All materials/equipment supplied must have a minimum warranty of [PRAZO_GARANTIA] against manufacturing defects.`,
        },
        template3: {
          nome: 'Equipment Rental',
          descricao: 'Template for equipment rental contracts',
          objetoPadrao: 'Equipment rental',
          slaPadrao: 'Corrective maintenance within 24 hours',
          penalidadesPadrao: 'Proportional discount on rent for unavailability',
          clausulasPadrao: `CLAUSE 1 - PURPOSE
This contract has as its purpose the rental of equipment as specified in Annex I.

CLAUSE 2 - RENT
The monthly rental amount is R$ [VALOR_MENSAL], adjusted annually by inflation index.

CLAUSE 3 - MAINTENANCE
Preventive and corrective maintenance of the equipment shall be the responsibility of the LESSOR.`,
        },
      },
      aditivosDialog: {
        zodNumeroRequired: 'Amendment number is required',
        zodTipoRequired: 'Type is required',
        zodMotivoRequired: 'Reason is required',
        zodJustificativaRequired: 'Justification is required',
      },
    },
  },
};
