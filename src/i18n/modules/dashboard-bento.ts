/** Dashboard em blocos. Raiz: `bento.*` */
export const dashboardBento = {
  pt: {
    bento: {
      subtitle: 'Visão geral da governança, riscos e conformidade da sua empresa.',
      seeAll: 'Ver todos',
      index: { title: 'Índice operacional', desc: 'Maturidade de GRC nos módulos com dados.', empty: 'Ainda sem dados suficientes para calcular.' },
      risks: { title: 'Riscos', desc: 'Distribuição por probabilidade e impacto.', prob: 'Probabilidade', impact: 'Impacto', empty: 'Cadastre o primeiro risco para ver o mapa.', cell: '{{count}} riscos (P{{p}} × I{{i}})' },
      plans: { title: 'Planos de ação', desc: 'Situação da execução.', onTime: 'No prazo', late: 'Em atraso', done: 'Concluídos', total: 'planos', empty: 'Nenhum plano de ação cadastrado.' },
      incidents: { title: 'Incidentes abertos', desc: 'Em tratamento agora.', inProgress: 'em tratamento', critical: 'Crítico', high: 'Alto', others: 'Outros', empty: 'Nenhum incidente em aberto.' },
      contracts: { title: 'Contratos a vencer', desc: 'Próximos 90 dias.', inDays: 'Em {{count}} dias', today: 'Hoje', empty: 'Nenhum contrato vence nos próximos 90 dias.' },
    },
  },
  en: {
    bento: {
      subtitle: 'Overview of your company governance, risk and compliance.',
      seeAll: 'See all',
      index: { title: 'Operational index', desc: 'GRC maturity across modules with data.', empty: 'Not enough data to calculate yet.' },
      risks: { title: 'Risks', desc: 'Distribution by likelihood and impact.', prob: 'Likelihood', impact: 'Impact', empty: 'Add your first risk to see the map.', cell: '{{count}} risks (L{{p}} × I{{i}})' },
      plans: { title: 'Action plans', desc: 'Execution status.', onTime: 'On time', late: 'Overdue', done: 'Completed', total: 'plans', empty: 'No action plans yet.' },
      incidents: { title: 'Open incidents', desc: 'Currently being handled.', inProgress: 'in progress', critical: 'Critical', high: 'High', others: 'Others', empty: 'No open incidents.' },
      contracts: { title: 'Expiring contracts', desc: 'Next 90 days.', inDays: 'In {{count}} days', today: 'Today', empty: 'No contracts expire in the next 90 days.' },
    },
  },
};
