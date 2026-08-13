export const acessosDd = {
  pt: {
    acessosDd: {
      contas: {
        contaDialog: {
          zodNomeObrigatorio: 'Nome do usuário é obrigatório',
          zodEmailInvalido: 'Email inválido',
          zodSistemaObrigatorio: 'Sistema é obrigatório',
          zodTipoObrigatorio: 'Tipo de acesso é obrigatório',
          zodNivelObrigatorio: 'Nível de privilégio é obrigatório',
          zodDataConcessaoObrigatoria: 'Data de concessão é obrigatória',
          zodDataExpiracaoObrigatoria: 'Data de expiração é obrigatória',
          zodJustificativaMinima: 'Justificativa deve ter pelo menos 10 caracteres',
        },
        sistemaDialog: {
          zodNomeObrigatorio: 'Nome do sistema é obrigatório',
          zodTipoObrigatorio: 'Tipo do sistema é obrigatório',
          zodCriticidadeObrigatoria: 'Criticidade é obrigatória',
          zodUrlInvalida: 'URL inválida',
        },
      },
      revisao: {
        usuarioDialog: {
          zodSistemaObrigatorio: 'Sistema é obrigatório',
          zodNomeObrigatorio: 'Nome do usuário é obrigatório',
          zodEmailInvalido: 'Email inválido',
        },
        itemDecisionDialog: {
          zodJustificativaMinima: 'Justificativa deve ter no mínimo 10 caracteres',
        },
      },
      dueDiligence: {
        scoreNotFoundTitle: 'Score não encontrado',
        scoreNotFoundDescription: 'Não foi possível carregar os detalhes do score',
        errorTitle: 'Erro',
      },
    },
  },
  en: {
    acessosDd: {
      contas: {
        contaDialog: {
          zodNomeObrigatorio: 'User name is required',
          zodEmailInvalido: 'Invalid email',
          zodSistemaObrigatorio: 'System is required',
          zodTipoObrigatorio: 'Access type is required',
          zodNivelObrigatorio: 'Privilege level is required',
          zodDataConcessaoObrigatoria: 'Grant date is required',
          zodDataExpiracaoObrigatoria: 'Expiration date is required',
          zodJustificativaMinima: 'Justification must be at least 10 characters',
        },
        sistemaDialog: {
          zodNomeObrigatorio: 'System name is required',
          zodTipoObrigatorio: 'System type is required',
          zodCriticidadeObrigatoria: 'Criticality is required',
          zodUrlInvalida: 'Invalid URL',
        },
      },
      revisao: {
        usuarioDialog: {
          zodSistemaObrigatorio: 'System is required',
          zodNomeObrigatorio: 'User name is required',
          zodEmailInvalido: 'Invalid email',
        },
        itemDecisionDialog: {
          zodJustificativaMinima: 'Justification must be at least 10 characters',
        },
      },
      dueDiligence: {
        scoreNotFoundTitle: 'Score not found',
        scoreNotFoundDescription: 'Could not load score details',
        errorTitle: 'Error',
      },
    },
  },
};
