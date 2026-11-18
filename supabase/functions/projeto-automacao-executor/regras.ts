// Regras puras do executor de automações (testáveis sem rede).

/** O painel grava `mudar_prioridade`; versões antigas usam `definir_prioridade`. */
export function normalizarTipo(tipo: string): string {
  return tipo === 'mudar_prioridade' ? 'definir_prioridade' : tipo;
}

/** Condições simples campo == valor; vazio significa "qualquer". */
export function passaCondicoes(cond: Record<string, unknown>, tarefa: Record<string, unknown>): boolean {
  return Object.entries(cond ?? {}).every(([k, v]) => v === '' || v === null || v === undefined || tarefa[k] === v);
}

export function montarMensagem(modelo: string | undefined | null, titulo: string): string {
  const base = modelo?.trim() || 'A atividade "{titulo}" disparou a automação.';
  return base.split('{titulo}').join(titulo);
}

/** Ação sem o dado de que precisa nunca é aplicada. */
export function acaoCompleta(a: Record<string, any>): boolean {
  switch (normalizarTipo(a?.tipo)) {
    case 'mover_para_coluna': return !!a.coluna_id;
    case 'definir_prioridade': return !!a.prioridade;
    case 'atribuir_responsavel':
    case 'notificar_usuario': return !!a.user_id;
    case 'adicionar_checklist': return Array.isArray(a.itens) && a.itens.length > 0;
    default: return false;
  }
}
