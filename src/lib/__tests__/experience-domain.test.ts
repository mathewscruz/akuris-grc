import { describe, expect, it } from 'vitest';
import { actionPlanOrigin } from '../action-plan-origin';
import { environmentLabel } from '../environment-label';
import { experience } from '@/i18n/modules/experience';
import { readCachedBlogEntries } from '../../../scripts/sitemap-cache';

describe('exact action-plan origins', () => {
  it('native plans point to their linked record, never to the plan itself', () => {
    expect(actionPlanOrigin({ id: 'plan', modulo_origem: 'controles', registro_origem_id: 'control' })).toEqual({ key: 'controle', id: 'control' });
  });
  it('external audit rows point to the audit item', () => {
    expect(actionPlanOrigin({ id: 'item', modulo_origem: 'auditorias', _isExternal: true })).toEqual({ key: 'auditoria_item', id: 'item' });
  });
  it('does not fabricate a destination for manual or unavailable origins', () => {
    expect(actionPlanOrigin({ id: 'plan', modulo_origem: 'manual' })).toBeNull();
    expect(actionPlanOrigin({ id: 'plan', modulo_origem: 'riscos' })).toBeNull();
    expect(actionPlanOrigin({ id: 'plan', modulo_origem: 'unknown', registro_origem_id: 'x' })).toBeNull();
  });
});

describe('plain, localized environment names', () => {
  const translate = (language: 'pt' | 'en') => (key: string) => experience[language].experience.environments[key.split('.').at(-1) as 'production'];
  it('preserves familiar Portuguese accents and translates persisted values', () => {
    expect(environmentLabel('produção', translate('pt'))).toBe('Produção');
    expect(environmentLabel('HOMOLOGAÇÃO', translate('en'))).toBe('Staging');
    expect(environmentLabel('development', translate('pt'))).toBe('Desenvolvimento');
  });
  it('does not assign a fictitious environment to missing data', () => {
    expect(environmentLabel(null, translate('pt'))).toBe('—');
    expect(environmentLabel('', translate('en'))).toBe('—');
  });
});

describe('safe sitemap fallback', () => {
  it('keeps each date with its own URL even when the previous URL has no date', () => {
    const result = readCachedBlogEntries('<urlset><url><loc>https://akuris.pt/blog/first</loc></url><url><loc>https://akuris.pt/blog/second</loc><lastmod>2026-09-05</lastmod></url></urlset>');
    expect(result.map(({ path, lastmod }) => ({ path, lastmod }))).toEqual([{ path: '/blog/first', lastmod: undefined }, { path: '/blog/second', lastmod: '2026-09-05' }]);
  });
  it('ignores other domains and non-blog routes', () => {
    expect(readCachedBlogEntries('<url><loc>https://elsewhere.test/blog/x</loc></url><url><loc>https://akuris.pt/contact</loc></url>')).toEqual([]);
  });
});
