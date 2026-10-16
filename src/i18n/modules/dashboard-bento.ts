/** Dashboard em blocos. Raiz: `bento.*` */
export const dashboardBento = {
  pt: {
    bento: {
      subtitle: 'Visão geral da governança, riscos e conformidade da sua organização.',
      hello: 'Olá, {{name}}', helloTeam: 'Olá, time', search: 'Buscar no sistema…',
      period: { label: 'Período', last: 'Últimos {{count}} dias' },
      compliance: { title: 'Conformidade', desc: 'Evolução por framework.', more: 'Ver detalhes de conformidade', empty: 'Nenhum framework em avaliação.' },
      activity: { title: 'Atividade recente', desc: 'Últimas movimentações no sistema.', empty: 'Sem movimentações neste período.' },

      seeAll: 'Ver todos',
      index: { title: 'Índice operacional', desc: 'Mede a maturidade de GRC da sua organização.', of100: 'de 100', vsLastMonth: 'em relação ao mês anterior', empty: 'Ainda sem dados suficientes para calcular.' },
      risks: { title: 'Riscos', desc: 'Distribuição por probabilidade e impacto.', prob: 'Probabilidade', impact: 'Impacto', empty: 'Cadastre o primeiro risco para ver o mapa.', cell: '{{count}} riscos (P{{p}} × I{{i}})', levels: { vlow: 'Muito baixo', low: 'Baixo', mid: 'Médio', high: 'Alto', vhigh: 'Muito alto' }, sev: { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico' } },
      plans: { title: 'Planos de ação', desc: 'Status de execução dos planos de ação.', onTime: 'No prazo', late: 'Em atraso', done: 'Concluídos', total: 'planos', empty: 'Nenhum plano de ação cadastrado.' },
      incidents: { title: 'Incidentes abertos', desc: 'Em tratamento agora.', inProgress: 'em tratamento', critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa', others: 'Outros', empty: 'Nenhum incidente em aberto.' },
      contracts: { title: 'Contratos a vencer', desc: 'Próximos vencimentos nos próximos 90 dias.', more: 'Ver todos os contratos', inDays: 'Em {{count}} dias', today: 'Hoje', empty: 'Nenhum contrato vence nos próximos 90 dias.' },
    },
  },
  en: {
    bento: {
      subtitle: 'Overview of your organization governance, risk and compliance.',
      hello: 'Hello, {{name}}', helloTeam: 'Hello, team', search: 'Search the system…',
      period: { label: 'Period', last: 'Last {{count}} days' },
      compliance: { title: 'Compliance', desc: 'Progress by framework.', more: 'See compliance details', empty: 'No frameworks under assessment.' },
      activity: { title: 'Recent activity', desc: 'Latest changes in the system.', empty: 'No activity in this period.' },

      seeAll: 'See all',
      index: { title: 'Operational index', desc: 'Measures your organization GRC maturity.', of100: 'of 100', vsLastMonth: 'vs. last month', empty: 'Not enough data to calculate yet.' },
      risks: { title: 'Risks', desc: 'Distribution by likelihood and impact.', prob: 'Likelihood', impact: 'Impact', empty: 'Add your first risk to see the map.', cell: '{{count}} risks (L{{p}} × I{{i}})', levels: { vlow: 'Very low', low: 'Low', mid: 'Medium', high: 'High', vhigh: 'Very high' }, sev: { baixo: 'Low', medio: 'Medium', alto: 'High', critico: 'Critical' } },
      plans: { title: 'Action plans', desc: 'Action plan execution status.', onTime: 'On time', late: 'Overdue', done: 'Completed', total: 'plans', empty: 'No action plans yet.' },
      incidents: { title: 'Open incidents', desc: 'Currently being handled.', inProgress: 'in progress', critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', others: 'Others', empty: 'No open incidents.' },
      contracts: { title: 'Expiring contracts', desc: 'Upcoming expirations in the next 90 days.', more: 'See all contracts', inDays: 'In {{count}} days', today: 'Today', empty: 'No contracts expire in the next 90 days.' },
    },
  },
};
