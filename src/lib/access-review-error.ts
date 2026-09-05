/** Public messages are mapped; SQL details and identifiers never become a toast. */
export function accessReviewErrorKey(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const keys: Record<string, string> = {
    REVIEW_EMPTY_SCOPE: 'reviewEmptyScope', REVIEW_PENDING_ITEMS: 'reviewPendingItems',
    REVIEW_EXPIRY_REQUIRED: 'reviewExpiryRequired', REVIEW_CLOSED: 'reviewClosed',
    REVIEW_IMMUTABLE_SCOPE: 'reviewImmutableScope', REVIEW_SOURCE_UNAVAILABLE: 'reviewSourceUnavailable',
    REVIEW_OWNER_UNAVAILABLE: 'reviewOwnerUnavailable', REVIEW_NOT_AVAILABLE: 'reviewUnavailable',
    REVIEW_INVALID_INPUT: 'reviewInvalidInput', REVIEW_INVALID_DECISION: 'reviewInvalidDecision',
  };
  return `experience.${keys[message] ?? 'reviewSaveFailed'}`;
}
