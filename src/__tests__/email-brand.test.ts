import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { EMAIL_BRAND, EMAIL_COPY, brandedEmailDocument, emailAction, emailDetails, notificationEmail, safeEmailUrl } from '../../supabase/functions/_shared/email-brand';
import { operationalEmail, type OperationalEmailKind } from '../../supabase/functions/_shared/operational-email';

describe('Akuris email presentation', () => {
  it('uses the approved dark wordmark at a new URL, preserving old messages', () => {
    expect(readFileSync('public/akuris-logo-email-dark-v2.png')).toEqual(readFileSync('src/assets/akuris-logo-light.png'));
    expect(EMAIL_BRAND.logoUrl).toBe('https://akuris.pt/akuris-logo-email-dark-v2.png');
    expect(readFileSync('public/akuris-logo-email.png')).not.toEqual(readFileSync('public/akuris-logo-email-dark-v2.png'));
  });
  it('shares a responsive, table-based shell and escapes titles and previews', () => {
    const html = brandedEmailDocument('<title>', '<p>Trusted body</p>', { preheader: '<secret>', eyebrow: '<module>' });
    expect(html).toContain('&lt;title&gt;');
    expect(html).toContain('&lt;secret&gt;');
    expect(html).toContain('&lt;module&gt;');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('max-width:620px');
    expect(html).toContain('email-logo-surface');
    expect(html).not.toContain('display:grid');
  });
  it('escapes every data field including names and preserves zero', () => {
    const html = notificationEmail({ title: 'Notice', module: 'Tests', name: '<img onerror=x>', intro: '<script>alert(1)</script>', item: '<item>', description: '<b>not markup</b>', fields: [['Count', 0], ['Empty', null]], action: { label: '<Open>', url: 'https://akuris.pt/?a=1&b=2' } });
    expect(html).not.toMatch(/<script>|<img onerror|<item>|<b>not/);
    expect(html).toContain('&lt;Open&gt;');
    expect(html).toContain('>0</td>');
    expect(html).not.toContain('Empty');
    expect(html).toContain('a=1&amp;b=2');
  });
  it('keeps accessible HTTPS actions and a copyable fallback; rejects executable URLs', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://akuris.pt', 'https://name:secret@akuris.pt', 'invalid']) {
      expect(safeEmailUrl(url)).toBe(''); expect(emailAction('Open', url)).toBe('');
    }
    const html = emailAction('Open', 'https://akuris.pt/review/token?key=example', 'en');
    expect(html.match(/href="https:\/\/akuris.pt\/review\/token\?key=example"/g)).toHaveLength(2);
    expect(html).toContain(EMAIL_COPY.en.fallback);
  });
  it('retains audit item context and next steps without decorative emoji', () => {
    const html = operationalEmail('audit', { name: 'Example', item: 'Authentication policy', code: 'CTRL-42', audit: 'Annual audit', deadline: '15/09/2026', url: 'https://akuris.pt/governanca/auditorias?focus=example' });
    for (const value of ['CTRL-42', 'Annual audit', '15/09/2026', 'Próximo passo', '?focus=example']) expect(html).toContain(value);
    expect(html).not.toContain('📋');
  });
  it('covers every operational category with the shared brand in PT and EN', () => {
    const kinds: OperationalEmailKind[] = ['audit', 'control', 'controlMention', 'risk', 'acceptance', 'review', 'approval', 'incident', 'contract', 'key', 'license', 'report', 'dueDiligence'];
    for (const kind of kinds) for (const locale of ['pt', 'en'] as const) {
      const html = operationalEmail(kind, { item: 'Example', url: 'https://akuris.pt', heading: 'Decision', action: 'Open' }, locale);
      expect(html).toContain(EMAIL_BRAND.logoUrl);
      expect(html).toContain(`lang="${locale === 'pt' ? 'pt-BR' : 'en'}"`);
      expect(html).toContain(EMAIL_COPY[locale].footer);
    }
    expect(Object.keys(EMAIL_COPY.pt)).toEqual(Object.keys(EMAIL_COPY.en));
  });
  it('does not give a completed questionnaire an invitation CTA', () => {
    const html = operationalEmail('dueDiligence', { item: 'Example', status: 'completed', url: 'https://akuris.pt/assessment/test' });
    expect(html).toContain('Recebemos suas respostas');
    expect(html).not.toContain('href="https://akuris.pt/assessment/test"');
  });
  it('keeps color meaning accompanied by text', () => {
    const html = emailDetails('Expired license', [['Status', 'Expired']], { tone: 'danger' });
    expect(html).toContain('#bb303d'); expect(html).toContain('Expired');
  });
  it('does not leave a white-wordmark URL in outgoing handlers or the campaign preview', () => {
    for (const dir of readdirSync('supabase/functions').filter(dir => /^(send-|avisar-|process-invitation)/.test(dir))) {
      const source = readFileSync(`supabase/functions/${dir}/index.ts`, 'utf8');
      expect(source, dir).not.toContain('/akuris-logo-email.png');
    }
    expect(readFileSync('src/components/configuracoes/EmailPreview.tsx', 'utf8')).toContain('brandedEmailDocument');
  });
});
