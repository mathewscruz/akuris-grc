import { publico } from '@/i18n/modules/publico';
import { site } from '@/i18n/modules/site';
import { localizePtDictionary } from '@/lib/pt-variants';
import type { AppLocale } from '@/lib/i18n-locale';

type Dictionary = Record<string, any>;
const publicDictionaries = {
  pt: { ...publico.pt, ...site.pt, language: { selector: 'Idioma' }, common: { close: 'Fechar', loading: 'Carregando...', retry: 'Tentar novamente' }, cardsKpi: { sweep: { sistema: { carregandoReticencias: 'Carregando...' } } } },
  en: { ...publico.en, ...site.en, language: { selector: 'Language' }, common: { close: 'Close', loading: 'Loading...', retry: 'Try again' }, cardsKpi: { sweep: { sistema: { carregandoReticencias: 'Loading...' } } } },
};
let full: { pt: Dictionary; en: Dictionary } | undefined;
let pending: Promise<void> | undefined;
let failed: unknown;
const cache = new Map<AppLocale, Dictionary>();
export function dictionaryFor(locale: AppLocale): Dictionary {
  const cached = cache.get(locale);
  if (cached) return cached;
  const source = full || publicDictionaries;
  const result = locale === 'en' ? source.en : localizePtDictionary(source.pt, locale);
  cache.set(locale, result);
  return result;
}
export function loadFullDictionaries(): Promise<void> {
  return pending ??= import('@/i18n/full-dictionaries').then(module => {
    full = module.fullDictionaries; cache.clear();
  }).catch(error => { failed = error; throw error; });
}
/** Called inside a Suspense boundary, before any operational route renders. */
export function requireFullDictionaries() {
  if (failed) throw failed;
  if (!full) throw loadFullDictionaries();
}
export function isMarketingPath(path: string) {
  return ['/', '/planos', '/blog', '/frameworks', '/migracao', '/seguranca', '/politica-privacidade', '/solucoes/canal-de-denuncias'].includes(path)
    || /^\/(blog|frameworks)\/[a-z0-9-]+\/?$/.test(path);
}
