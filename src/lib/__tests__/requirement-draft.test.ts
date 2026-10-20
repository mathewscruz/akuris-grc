import { describe, expect, it } from 'vitest';
import { answerFingerprint, restoreRequirementDraft } from '../gap-analysis/requirement-draft';

const saved = { id: 'saved-id', conformity_status: 'conforme', observacoes: 'Saved', prazo_implementacao: null, responsavel_avaliacao: null };
describe('requirement draft safety', () => {
  it('restores only answer fields, never a draft record identifier', () => {
    const raw = JSON.stringify({ version: 1, base: answerFingerprint(saved), values: JSON.stringify({ ...saved, id: 'different-record', observacoes: 'Edit' }) });
    expect(restoreRequirementDraft(raw, saved)).toEqual({ ...saved, observacoes: 'Edit' });
  });
  it('rejects malformed drafts', () => {
    expect(restoreRequirementDraft('{', saved)).toEqual(saved);
    expect(restoreRequirementDraft(JSON.stringify({ version: 1, base: answerFingerprint(saved), values: '{}' }), saved)).toEqual(saved);
  });
});