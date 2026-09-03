import { describe, expect, it } from 'vitest';
import { getRequirementCompletionCriteria } from '../gap-requirement-completion';

const base = {
  diagnosticAnswered: 4,
  diagnosticTotal: 4,
  evidenceCount: 0,
  hasPlan: false,
  hasOwner: false,
  hasDeadline: false,
  hasJustification: false,
};

describe('critérios de conclusão de um requisito', () => {
  it('exige diagnóstico, status e evidência para declarar conformidade', () => {
    expect(getRequirementCompletionCriteria({ ...base, status: 'conforme' })).toEqual([
      { key: 'diagnostic', done: true },
      { key: 'status', done: true },
      { key: 'evidence', done: false },
    ]);
  });

  it('exige plano, responsável e prazo quando há gap', () => {
    expect(getRequirementCompletionCriteria({
      ...base,
      status: 'nao_conforme',
      hasPlan: true,
      hasOwner: true,
      hasDeadline: true,
    }).every((criterion) => criterion.done)).toBe(true);
  });

  it('exige justificativa para não aplicável', () => {
    const criteria = getRequirementCompletionCriteria({ ...base, status: 'nao_aplicavel' });
    expect(criteria.at(-1)).toEqual({ key: 'justification', done: false });
  });

  it('não conclui diagnóstico com perguntas sem resposta', () => {
    const criteria = getRequirementCompletionCriteria({
      ...base,
      diagnosticAnswered: 3,
      status: 'conforme',
      evidenceCount: 1,
    });
    expect(criteria[0]).toEqual({ key: 'diagnostic', done: false });
  });
});

