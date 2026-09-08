/** Evidence is opaque data: any extension (including none) is accepted. */
export const EVIDENCE_UPLOAD_OPTIONS = { contentType: 'application/octet-stream', upsert: false } as const;

/** Keep the tenant/item prefix at the call site; never put a raw filename in an object key. */
export function evidenceObjectName(fileName: string): string {
  const safeName = fileName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-160) || 'evidence';
  return `${crypto.randomUUID()}-${safeName}`;
}
