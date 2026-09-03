export type RequirementCompletionKey =
  | 'diagnostic'
  | 'status'
  | 'evidence'
  | 'plan'
  | 'ownerDeadline'
  | 'justification';

export interface RequirementCompletionInput {
  diagnosticAnswered: number;
  diagnosticTotal: number;
  status?: string | null;
  evidenceCount: number;
  hasPlan: boolean;
  hasOwner: boolean;
  hasDeadline: boolean;
  hasJustification: boolean;
}

export interface RequirementCompletionCriterion {
  key: RequirementCompletionKey;
  done: boolean;
}

/**
 * Definition of done shared by the requirement workspace.
 *
 * A compliant answer needs proof. A gap needs a treatment plan, owner and
 * deadline. N/A needs a written reason so it remains defensible in an audit.
 */
export function getRequirementCompletionCriteria({
  diagnosticAnswered,
  diagnosticTotal,
  status,
  evidenceCount,
  hasPlan,
  hasOwner,
  hasDeadline,
  hasJustification,
}: RequirementCompletionInput): RequirementCompletionCriterion[] {
  const statusDefined = !!status && status !== 'nao_avaliado' && status !== 'pendente';
  const criteria: RequirementCompletionCriterion[] = [
    {
      key: 'diagnostic',
      done: diagnosticTotal > 0 && diagnosticAnswered >= diagnosticTotal,
    },
    { key: 'status', done: statusDefined },
  ];

  if (status === 'conforme') {
    criteria.push({ key: 'evidence', done: evidenceCount > 0 });
  }

  if (status === 'parcial' || status === 'nao_conforme') {
    criteria.push(
      { key: 'plan', done: hasPlan },
      { key: 'ownerDeadline', done: hasOwner && hasDeadline },
    );
  }

  if (status === 'nao_aplicavel') {
    criteria.push({ key: 'justification', done: hasJustification });
  }

  return criteria;
}

