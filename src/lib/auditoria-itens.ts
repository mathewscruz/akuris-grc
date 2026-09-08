/** A missing link alone can be intentional. Only confirmed deletions are history. */
export function isHistoricalAuditItem(item: { controle_excluido_em?: string | null }): boolean {
  return Boolean(item.controle_excluido_em);
}

export function auditItemSummary<T extends { status: string; controle_excluido_em?: string | null }>(items: T[]) {
  const operational = items.filter(item => !isHistoricalAuditItem(item));
  return {
    total: operational.length,
    pendente: operational.filter(item => item.status === 'pendente').length,
    em_andamento: operational.filter(item => item.status === 'em_andamento').length,
    concluido: operational.filter(item => item.status === 'concluido').length,
  };
}
