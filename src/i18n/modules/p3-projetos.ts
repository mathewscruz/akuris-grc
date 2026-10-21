/**
 * Chaves do envio P3 (p3-projetos). Estrutura: { pt: {...}, en: {...} }.
 * O dicionário pt-BR é derivado automaticamente do pt (ver lib/pt-variants.ts).
 */
export const p3Projetos = {
  pt: {
    p3Projetos: {
      papel: {
        owner: 'Dono',
        admin: 'Administrador',
        membro: 'Membro',
        viewer: 'Visualizador',
      },
      dependencia: {
        FS: 'Término → Início',
        SS: 'Início → Início',
        FF: 'Término → Término',
        SF: 'Início → Término',
      },
      lista: {
        filterStatusLabel: 'Status',
        filterPriorityLabel: 'Prioridade',
        filterColumnLabel: 'Coluna',
        filterGroupLabel: 'Agrupar por',
        filterResponsibleLabel: 'Responsável',
        filterTypeLabel: 'Tipo',
        responsibleAll: 'Todos os responsáveis',
        typeAll: 'Todos os tipos',
        groupMonth: 'Plano mensal (mês de início)',
        groupType: 'Agrupar por tipo',
        colResponsavel: 'Responsável',
        colTipo: 'Tipo / referência',
        colPeriodo: 'Início → fim',
        colProgresso: '% concl.',
        milestone: 'Marco',
      },
      painel: {
        progressoGeral: 'Progresso geral',
        planejadoHoje: 'Planejado até hoje: {value}%',
        concluidas: 'Atividades concluídas',
        deTotal: 'de {total} atividades',
        atrasadas: 'Atrasadas',
        atrasadasHint: 'prazo vencido e < 100%',
        proximoMarco: 'Próximo marco',
        semMarco: 'Sem marcos pendentes',
        porFase: 'Progresso por fase',
      },
    },
  },
  en: {
    p3Projetos: {
      papel: {
        owner: 'Owner',
        admin: 'Admin',
        membro: 'Member',
        viewer: 'Viewer',
      },
      dependencia: {
        FS: 'Finish → Start',
        SS: 'Start → Start',
        FF: 'Finish → Finish',
        SF: 'Start → Finish',
      },
      lista: {
        filterStatusLabel: 'Status',
        filterPriorityLabel: 'Priority',
        filterColumnLabel: 'Column',
        filterGroupLabel: 'Group by',
        filterResponsibleLabel: 'Owner',
        filterTypeLabel: 'Type',
        responsibleAll: 'All owners',
        typeAll: 'All types',
        groupMonth: 'Monthly plan (start month)',
        groupType: 'Group by type',
        colResponsavel: 'Owner',
        colTipo: 'Type / reference',
        colPeriodo: 'Start → end',
        colProgresso: '% done',
        milestone: 'Milestone',
      },
      painel: {
        progressoGeral: 'Overall progress',
        planejadoHoje: 'Planned to date: {value}%',
        concluidas: 'Completed activities',
        deTotal: 'of {total} activities',
        atrasadas: 'Overdue',
        atrasadasHint: 'past due and < 100%',
        proximoMarco: 'Next milestone',
        semMarco: 'No pending milestones',
        porFase: 'Progress by phase',
      },
    },
  },
};
