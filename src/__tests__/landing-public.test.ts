import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { deliverContact } from '../../supabase/functions/_shared/contact-delivery';
import { validar } from '../../supabase/functions/_shared/contact-input';
import { publicPlanPrice, planFeatureLabel } from '@/lib/public-plan';
import { demoInterest, emitDemoEvent } from '@/lib/public-demo';
import { PUBLIC_MODULES } from '@/lib/public-modules';
import { MODULE_ICON } from '@/lib/module-icons';
import { site } from '@/i18n/modules/site';
import { isMarketingPath } from '@/lib/dictionary-registry';
import { publicPages, escapePublicHtml } from '../../scripts/public-prerender';

describe('commercial contact delivery', () => {
  it('does not treat a resolved provider error as acceptance', async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { name: 'validation_error', statusCode: 422 } });
    expect(await deliverContact(send)).toMatchObject({ accepted: false, attempts: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('retries transient errors and checks the provider id', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ error: { statusCode: 429 } }).mockResolvedValue({ data: { id: 'mail-1' } });
    expect(await deliverContact(send, async () => {})).toMatchObject({ accepted: true, providerId: 'mail-1', attempts: 3 });
  });
  it('stops after three ambiguous responses', async () => {
    const send = vi.fn().mockResolvedValue({ data: {} });
    expect(await deliverContact(send, async () => {})).toMatchObject({ accepted: false, attempts: 3 });
    expect(send).toHaveBeenCalledTimes(3);
  });
  it('rejects malformed anonymous input instead of throwing', () => {
    for (const input of [null, [], { name: 4 }, { email: {} }]) expect(validar(input as never)).toBeTruthy();
  });
  it('accepts bounded contact context and rejects query strings, wrong locale and oversized messages', () => {
    const valid = { name: 'Demo', company: 'Fictitious', email: 'demo@example.test', companySize: '1-50', locale: 'en', source: '/frameworks/iso-27001', interest: 'guides' };
    expect(validar(valid)).toBeNull();
    for (const extra of [{ source: '/?email=someone@example.test' }, { locale: 'xx' }, { message: 'x'.repeat(1001) }, { requestId: 'bad-id' }]) expect(validar({ ...valid, ...extra })).toBeTruthy();
  });
});
describe('public UX contracts', () => {
  it('covers every module family with truthful localized copy and valid contact context', () => {
    expect(PUBLIC_MODULES).toHaveLength(22);
    const covered = PUBLIC_MODULES.map(module => module.route);
    for (const route of Object.keys(MODULE_ICON).filter(route => !['/governanca', '/gap-analysis/frameworks'].includes(route))) expect(covered).toContain(route);
    for (const module of PUBLIC_MODULES) {
      for (const locale of ['pt', 'en'] as const) {
        expect(site[locale].site[module.title || module.key]).toBeTruthy();
        expect(site[locale].site[module.body || module.key + 'Body']).toBeTruthy();
      }
      expect(validar({ name: 'Demo', company: 'Fictitious', email: 'demo@example.test', companySize: '1-50', interest: module.key })).toBeNull();
    }
  });
  it('preserves prices without assuming a discount or rounding whole units', () => {
    expect(publicPlanPrice({ preco_anual: 1069, preco_mensal: 590 }, true)).toEqual({ monthly: 1069 / 12, annualTotal: 1069 });
    expect(publicPlanPrice({ preco_anual: 0, preco_mensal: 590 }, true).monthly).toBeNull();
    expect(planFeatureLabel('Tudo do Compliance Start')).toBe('Tudo do Akuris Start');
  });
  it('does not put arbitrary strings or PII in funnel events', () => {
    expect(demoInterest('name@example.test')).toBe('general');
    const listener = vi.fn(); window.addEventListener('akuris:public-funnel', listener);
    emitDemoEvent('demo_open', 'privacy');
    expect(listener.mock.calls[0][0].detail).toEqual({ name: 'demo_open', interest: 'privacy' });
    window.removeEventListener('akuris:public-funnel', listener);
  });
  it('loads full dictionaries for auth, protected routes and reporting portals', () => {
    for (const path of ['/auth', '/riscos', '/dashboard', '/acme/denuncia', '/solicitacao-privacidade/acme']) expect(isMarketingPath(path)).toBe(false);
    for (const path of ['/', '/planos', '/frameworks/iso-27001', '/solucoes/canal-de-denuncias']) expect(isMarketingPath(path)).toBe(true);
  });
  it('gives Helmet ownership of static metadata and removes incorrect language alternatives', () => {
    const index = readFileSync('index.html', 'utf8');
    expect(index).toContain('<link data-rh="true" rel="canonical"');
    expect(index).toContain('<meta data-rh="true" name="description"');
    expect(index).not.toContain('hreflang=');
  });
  it('prerenders only allowlisted public reading content', () => {
    const pages = publicPages();
    expect(pages.length).toBe(14);
    expect(pages.every(page => isMarketingPath(page.path) && page.content.includes('<h1>'))).toBe(true);
    expect(escapePublicHtml('<script>"&')).toBe('&lt;script&gt;&quot;&amp;');
  });
});
