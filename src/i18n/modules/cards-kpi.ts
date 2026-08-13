/**
 * Rótulos de cards de KPI, abas e cabeçalhos de painel que ainda viviam fixos
 * no JSX das páginas de módulo. Mantidos num módulo próprio para que a varredura
 * anti-regressão de textos PT tenha um destino óbvio para novos rótulos.
 */
export const cardsKpi = {
  pt: {
    cardsKpi: {
      contratos: {
        totalContratos: 'Total de Contratos',
        valorTotal: 'Valor Total',
        valorEmAtivos: 'Valor em contratos ativos',
        emptyContratos: 'Comece criando contratos para gerenciar suas parcerias.',
        emptyFornecedores: 'Cadastre fornecedores para associar aos contratos.',
      },
      privacidade: {
        totalDados: 'Total de Dados',
        dadosSensiveis: 'Dados Sensíveis',
        requeremProtecao: 'Requerem proteção especial',
        solicitacoesPendentes: 'Solicitações Pendentes',
        foraPrazoLgpd: 'Fora do Prazo LGPD',
        abaCatalogo: 'Catálogo & Mapeamento',
        abaSolicitacoes: 'Solicitações',
        detalhesDado: 'Detalhes do Dado Pessoal',
      },
      denuncias: {
        total: 'Total',
        denunciasRegistradas: 'Denúncias registradas',
        aguardandoAnalise: 'Aguardando análise',
        concluidas: 'Concluídas',
        relatorios: 'Relatórios de Denúncias',
      },
      licencas: {
        totalLicencas: 'Total de Licenças',
        licencasRegistradas: 'Licenças registradas',
        licencasAtivas: 'Licenças Ativas',
      },
      continuidade: {
        totalPlanos: 'Total de Planos',
        emRevisao: 'Em Revisão',
        coberturaTestes: 'Cobertura de testes',
      },
      chaves: {
        totalChaves: 'Total de Chaves',
      },
    },
  },
  en: {
    cardsKpi: {
      contratos: {
        totalContratos: 'Total contracts',
        valorTotal: 'Total value',
        valorEmAtivos: 'Value in active contracts',
        emptyContratos: 'Start by creating contracts to manage your partnerships.',
        emptyFornecedores: 'Register suppliers to link them to contracts.',
      },
      privacidade: {
        totalDados: 'Total data records',
        dadosSensiveis: 'Sensitive data',
        requeremProtecao: 'Require special protection',
        solicitacoesPendentes: 'Pending requests',
        foraPrazoLgpd: 'Past the LGPD deadline',
        abaCatalogo: 'Catalog & mapping',
        abaSolicitacoes: 'Requests',
        detalhesDado: 'Personal data details',
      },
      denuncias: {
        total: 'Total',
        denunciasRegistradas: 'Reports filed',
        aguardandoAnalise: 'Awaiting review',
        concluidas: 'Completed',
        relatorios: 'Whistleblowing reports',
      },
      licencas: {
        totalLicencas: 'Total licenses',
        licencasRegistradas: 'Licenses registered',
        licencasAtivas: 'Active licenses',
      },
      continuidade: {
        totalPlanos: 'Total plans',
        emRevisao: 'Under review',
        coberturaTestes: 'Test coverage',
      },
      chaves: {
        totalChaves: 'Total keys',
      },
    },
  },
};
