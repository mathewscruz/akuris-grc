export interface AccessCampaign {
  id: string; sistema_id: string; nome_revisao: string; status: string;
  data_limite: string; created_at: string;
}
export interface AccountDecision {
  conta_id: string | null; review_id: string; data_revisao: string | null; decisao: string;
}

/** A campaign for a system is not evidence that each of its accounts was reviewed. */
export function accountReviewContext(account: { id: string; sistema_id: string }, campaigns: AccessCampaign[], decisions: AccountDecision[]) {
  const inScope = campaigns.filter(r => r.sistema_id === account.sistema_id && r.status !== 'cancelada');
  const open = inScope.filter(r => r.status !== 'concluida')
    .sort((a, b) => a.data_limite.localeCompare(b.data_limite) || a.id.localeCompare(b.id))[0];
  const ids = new Set(inScope.map(r => r.id));
  const lastDecision = decisions.filter(d => d.conta_id === account.id && ids.has(d.review_id)
    && d.decisao !== 'pendente' && d.data_revisao)
    .sort((a, b) => b.data_revisao!.localeCompare(a.data_revisao!))[0];
  return { campaign: open ?? null, lastDecision: lastDecision ?? null };
}

export function privilegedAccountStatus(account: { status: string; data_expiracao: string | null }, today: string) {
  return account.status === 'ativo' && account.data_expiracao && account.data_expiracao < today
    ? 'expirado' : account.status;
}
