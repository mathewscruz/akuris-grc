/**
 * Fonte única de verdade para todos os eventos de integração do sistema.
 * Importado por: SlackConfigDialog, TeamsConfigDialog, WebhooksConfigDialog, useIntegrationNotify
 */

export interface IntegrationEvent {
  id: string;
  label: string;
  modulo: string;
}

export const INTEGRATION_EVENTS: IntegrationEvent[] = [
  // Incidentes
  { id: 'incidente_criado', label: 'Incidente criado', modulo: 'Incidentes' },
  { id: 'incidente_atualizado', label: 'Incidente atualizado', modulo: 'Incidentes' },
  /* Não há `incidente_resolvido`: o produto não tem, hoje, um sítio onde um
     incidente seja dado por resolvido — o formulário não mexe no estado. Um
     evento sem ponto de disparo é uma caixa que promete o que não pode dar. */
  { id: 'incidente_critico', label: 'Incidente crítico detectado', modulo: 'Incidentes' },

  // Riscos
  { id: 'risco_identificado', label: 'Risco identificado', modulo: 'Riscos' },
  { id: 'risco_atualizado', label: 'Risco atualizado', modulo: 'Riscos' },
  { id: 'risco_nivel_alterado', label: 'Nível de risco alterado', modulo: 'Riscos' },

  // Controles
  { id: 'controle_criado', label: 'Controle criado', modulo: 'Controles' },
  { id: 'controle_atualizado', label: 'Controle atualizado', modulo: 'Controles' },
  { id: 'controle_vencendo', label: 'Controle próximo do vencimento', modulo: 'Controles' },

  // Documentos
  { id: 'documento_criado', label: 'Documento criado', modulo: 'Documentos' },
  { id: 'documento_aprovado', label: 'Documento aprovado', modulo: 'Documentos' },
  { id: 'documento_rejeitado', label: 'Documento rejeitado', modulo: 'Documentos' },

  // Auditorias
  { id: 'auditoria_criada', label: 'Auditoria criada', modulo: 'Auditorias' },
  { id: 'auditoria_item_atribuido', label: 'Item de auditoria atribuído', modulo: 'Auditorias' },

  // Denúncias
  { id: 'denuncia_recebida', label: 'Denúncia recebida', modulo: 'Denúncias' },

  // Contratos
  { id: 'contrato_criado', label: 'Contrato criado', modulo: 'Contratos' },
  { id: 'contrato_vencendo', label: 'Contrato próximo do vencimento', modulo: 'Contratos' },

  // Ativos
  { id: 'ativo_criado', label: 'Ativo cadastrado', modulo: 'Ativos' },
  { id: 'ativo_atualizado', label: 'Ativo atualizado', modulo: 'Ativos' },

  /*
    Não há eventos de «Políticas».

    Estavam declarados e ofereciam-se como caixas no Slack e no Teams — e não
    existe módulo de Políticas no produto, só a página pública de privacidade.
    Uma caixa que se liga para um módulo inexistente é pior do que uma caixa a
    menos: promete um aviso que nunca podia chegar.
  */

  // Planos de Ação
  { id: 'plano_acao_criado', label: 'Plano de ação criado', modulo: 'Planos de Ação' },
  { id: 'plano_acao_vencido', label: 'Plano de ação vencido', modulo: 'Planos de Ação' },
];

/** Tipo union de todos os IDs de eventos */
export type IntegrationEventType = typeof INTEGRATION_EVENTS[number]['id'];

/** Retorna a lista de eventos formatada para checkboxes nos dialogs de configuração */
export function getEventosDisponiveis() {
  return INTEGRATION_EVENTS;
}
