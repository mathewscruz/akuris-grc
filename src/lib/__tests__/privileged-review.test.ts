import { describe, expect, it } from 'vitest';
import { accountReviewContext, privilegedAccountStatus, type AccessCampaign } from '../privileged-review';
const account = { id: 'account', sistema_id: 's' };
const campaign: AccessCampaign = { id: 'r', sistema_id: 's', status: 'em_andamento', nome_revisao: 'Q3', data_limite: '2026-09-20', created_at: '2026-09-01' };
describe('account review evidence', () => {
  it('selects the earliest open deadline, not a cancelled/completed or foreign-system campaign', () => {
    const result = accountReviewContext(account, [campaign, { ...campaign, id: 'later', data_limite: '2026-10-01' }, { ...campaign, id: 'cancel', status: 'cancelada', data_limite: '2020-01-01' }, { ...campaign, id: 'other', sistema_id: 'other', data_limite: '2020-01-01' }], []);
    expect(result.campaign?.id).toBe('r'); expect(result.lastDecision).toBeNull();
  });
  it('does not infer review from the system campaign or another account decision', () => {
    expect(accountReviewContext(account, [campaign], [{ conta_id: 'other', review_id: 'r', decisao: 'aprovar', data_revisao: '2026-09-05' }]).lastDecision).toBeNull();
  });
  it('uses the latest actual decision, including completed campaigns, but never pending/cancelled decisions', () => {
    const decisions = [
      { conta_id: 'account', review_id: 'r', decisao: 'aprovar', data_revisao: '2026-09-02' },
      { conta_id: 'account', review_id: 'done', decisao: 'modificar', data_revisao: '2026-09-03' },
      { conta_id: 'account', review_id: 'cancel', decisao: 'aprovar', data_revisao: '2026-09-04' },
      { conta_id: 'account', review_id: 'r', decisao: 'pendente', data_revisao: '2026-09-05' },
    ];
    expect(accountReviewContext(account, [campaign, { ...campaign, id: 'done', status: 'concluida' }, { ...campaign, id: 'cancel', status: 'cancelada' }], decisions).lastDecision?.review_id).toBe('done');
  });
  it.each([
    ['ativo', '2026-09-04', 'expirado'], ['ativo', '2026-09-05', 'ativo'], ['ativo', null, 'ativo'], ['revogado', '2026-09-04', 'revogado'],
  ])('normalizes %s/%s consistently in filter, detail and counter', (status, data_expiracao, expected) => {
    expect(privilegedAccountStatus({ status: status!, data_expiracao }, '2026-09-05')).toBe(expected);
  });
});
