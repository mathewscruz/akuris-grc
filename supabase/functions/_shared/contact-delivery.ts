/** Resend can resolve with { error } instead of rejecting. Acceptance is not delivery. */
export type ContactSendResult = { data?: { id?: string } | null; error?: { name?: string; statusCode?: number } | null };
export async function deliverContact(send: () => Promise<ContactSendResult>, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let errorCode = 'provider_unavailable';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await send();
      if (!result.error && result.data?.id) return { accepted: true, providerId: result.data.id, attempts: attempt, errorCode: null };
      errorCode = result.error?.name || 'provider_missing_id';
      const status = result.error?.statusCode;
      if (status && status >= 400 && status < 500 && status !== 429) return { accepted: false, providerId: null, attempts: attempt, errorCode };
    } catch { errorCode = 'provider_unavailable'; }
    if (attempt < 3) await wait(200 * attempt);
  }
  return { accepted: false, providerId: null, attempts: 3, errorCode };
}
