import DOMPurify from 'dompurify';

/** Campaign markup is editable content, never executable browser code. */
export function sanitizeCampaignHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}