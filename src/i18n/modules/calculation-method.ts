export const calculationMethod = {
  pt: { calculationMethod: {
    initial: 'Inicial', low: 'Baixa', developing: 'Em desenvolvimento', intermediate: 'Intermediária', high: 'Elevada',
    adherenceBand: 'Faixa de aderência',
    applicableCount: '{{count}} requisitos aplicáveis', noApplicable: 'Sem requisitos aplicáveis',
    milestoneGap: 'Faltam {{pts}} pontos para a meta do framework, prevista para {{date}}. O prazo não representa uma projeção automática.',
    assets: 'Ativos: índice de cobertura da classificação do valor de negócio. Criticidade alta indica importância; não reduz a nota nem comprova vulnerabilidade.',
    recovery: 'Use horas iguais ou maiores que zero; são permitidas frações. O RTO não pode superar o período máximo tolerável de interrupção (MTPD). RPO é a janela de perda de dados, não o tempo de recuperação.',
    recoveryChecklist: 'Completude do planejamento: processos com metas coerentes, estratégia, ativação, comunicação, runbook e equipe com nome, papel e contato. Não comprova recuperação testada.',
    gap: 'Aderência ponderada: conforme = 100, parcial = 50 e não conforme ou não avaliado = 0. Itens não aplicáveis ficam fora. Pesos vêm dos requisitos; o índice não é uma certificação nem um Tier de maturidade NIST.',
  } },
  en: { calculationMethod: {
    initial: 'Initial', low: 'Low', developing: 'Developing', intermediate: 'Intermediate', high: 'High',
    adherenceBand: 'Adherence band',
    applicableCount: '{{count}} applicable requirements', noApplicable: 'No applicable requirements',
    milestoneGap: '{{pts}} points remain to reach the framework target set for {{date}}. The deadline is not an automatic forecast.',
    assets: 'Assets: coverage of business-value classification. High criticality indicates importance; it neither lowers the score nor proves a vulnerability.',
    recovery: 'Use non-negative hours; fractions are allowed. RTO cannot exceed the maximum tolerable period of disruption (MTPD). RPO is the data-loss window, not the recovery duration.',
    recoveryChecklist: 'Planning completeness: processes with coherent targets, strategy, activation, communication, runbook and a team with names, roles and contacts. It does not demonstrate tested recovery.',
    gap: 'Weighted adherence: compliant = 100, partial = 50, non-compliant or unassessed = 0. Non-applicable items are excluded. Weights come from requirements; the index is not a certification or a NIST maturity Tier.',
  } },
};
