import { describe, expect, it } from 'vitest';
import { accessReviewErrorKey } from '../access-review-error';
import { spreadsheetText } from '../csv-utils';
describe('review export and recovery messages', () => {
  it.each(['=HYPERLINK("bad")', '+1+1', '-1+1', '@SUM(A1)', '  =1+1', '\tformula', '\rformula'])('neutralizes formula-like text %s', value => {
    expect(spreadsheetText(value)).toBe("'" + value);
  });
  it('keeps ordinary names, dates and empty values as text', () => {
    expect(spreadsheetText('QA-012')).toBe('QA-012'); expect(spreadsheetText('05/09/2026')).toBe('05/09/2026'); expect(spreadsheetText(null)).toBe('');
  });
  it('distinguishes empty scope, pending items and lost permission', () => {
    expect(accessReviewErrorKey(new Error('REVIEW_EMPTY_SCOPE'))).toBe('experience.reviewEmptyScope');
    expect(accessReviewErrorKey(new Error('REVIEW_PENDING_ITEMS'))).toBe('experience.reviewPendingItems');
    expect(accessReviewErrorKey(new Error('REVIEW_NOT_AVAILABLE'))).toBe('experience.reviewUnavailable');
  });
});
