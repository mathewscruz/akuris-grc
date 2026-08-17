/**
 * Camada regulatória configurável (LGPD / RGPD / GDPR).
 * Textos em português (pt-PT/pt-BR neutro) e inglês, conforme CONVENCOES.md.
 */
export const jurisdicao = {
  pt: {
    jurisdicao: {
      label: 'Jurisdição / Regime de proteção de dados',
      descricao: 'Define a lei aplicável, a autoridade de controlo e os prazos legais usados no módulo de Privacidade.',
      placeholder: 'Selecione a jurisdição',
      opcoes: {
        BR: 'Brasil (LGPD)',
        PT_EU: 'Portugal / União Europeia (RGPD)',
        INTL: 'Outro / Internacional (GDPR)',
      },
      autoridades: {
        anpd: 'Autoridade Nacional de Proteção de Dados (ANPD)',
        cnpd: 'Comissão Nacional de Proteção de Dados (CNPD)',
        intl: 'autoridade de controlo competente',
      },
      prazos: {
        titular: {
          br: '15 dias',
          ptEu: '1 mês (prorrogável por mais 2)',
          intl: '1 mês (prorrogável por mais 2)',
        },
        violacao: {
          br: 'prazo razoável definido pela ANPD',
          ptEu: '72 horas à autoridade de controlo',
          intl: '72 horas à autoridade de controlo',
        },
      },
      artigos: {
        titular: {
          br: 'LGPD, art. 19',
          ptEu: 'RGPD, art. 12(3)',
          intl: 'GDPR, art. 12(3)',
        },
      },
      direitos: {
        confirmacao: 'Confirmação de tratamento',
        acesso: 'Acesso',
        correcao: 'Correção',
        retificacao: 'Retificação',
        anonimizacao: 'Anonimização, bloqueio ou eliminação',
        apagamento: 'Apagamento (direito a ser esquecido)',
        limitacao: 'Limitação do tratamento',
        portabilidade: 'Portabilidade',
        eliminacao: 'Eliminação dos dados',
        informacao: 'Informação sobre partilha de dados',
        revogacao: 'Revogação do consentimento',
        oposicao: 'Oposição',
        decisaoAutomatizada: 'Não sujeição a decisões automatizadas',
      },
      privacidade: {
        descricao: 'Proteção de dados pessoais, mapeamento e ROPA ({lei})',
        foraPrazo: 'Fora do prazo {lei}',
        excederamPrazo: 'Excederam {prazo}',
        prazoLegal: 'Prazo legal de resposta: {prazo} ({artigo})',
        ropaSubtitulo: 'Registro das atividades de tratamento — {lei}',
        violacaoNota: 'Notificação de violação: {prazo}',
      },
    },
  },
  en: {
    jurisdicao: {
      label: 'Jurisdiction / Data protection regime',
      descricao: 'Sets the applicable law, supervisory authority and legal deadlines used across the Privacy module.',
      placeholder: 'Select jurisdiction',
      opcoes: {
        BR: 'Brazil (LGPD)',
        PT_EU: 'Portugal / European Union (GDPR)',
        INTL: 'Other / International (GDPR)',
      },
      autoridades: {
        anpd: 'Brazilian Data Protection Authority (ANPD)',
        cnpd: 'Portuguese Data Protection Authority (CNPD)',
        intl: 'competent supervisory authority',
      },
      prazos: {
        titular: {
          br: '15 days',
          ptEu: '1 month (extendable by 2 more)',
          intl: '1 month (extendable by 2 more)',
        },
        violacao: {
          br: 'reasonable period defined by the ANPD',
          ptEu: '72 hours to the supervisory authority',
          intl: '72 hours to the supervisory authority',
        },
      },
      artigos: {
        titular: {
          br: 'LGPD, art. 19',
          ptEu: 'GDPR, art. 12(3)',
          intl: 'GDPR, art. 12(3)',
        },
      },
      direitos: {
        confirmacao: 'Confirmation of processing',
        acesso: 'Access',
        correcao: 'Correction',
        retificacao: 'Rectification',
        anonimizacao: 'Anonymisation, blocking or deletion',
        apagamento: 'Erasure (right to be forgotten)',
        limitacao: 'Restriction of processing',
        portabilidade: 'Portability',
        eliminacao: 'Deletion of data',
        informacao: 'Information on data sharing',
        revogacao: 'Withdrawal of consent',
        oposicao: 'Objection',
        decisaoAutomatizada: 'Not subject to automated decisions',
      },
      privacidade: {
        descricao: 'Personal data protection, mapping and ROPA ({lei})',
        foraPrazo: 'Past the {lei} deadline',
        excederamPrazo: 'Exceeded {prazo}',
        prazoLegal: 'Legal response deadline: {prazo} ({artigo})',
        ropaSubtitulo: 'Record of processing activities — {lei}',
        violacaoNota: 'Breach notification: {prazo}',
      },
    },
  },
};
