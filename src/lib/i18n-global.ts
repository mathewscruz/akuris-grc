/**
 * Tradução fora do React.
 *
 * Hooks utilitários e helpers puros (toasts em hooks de dados, exportadores,
 * timeouts de sessão) não têm acesso ao `useLanguage`. Este helper resolve a
 * chave no mesmo dicionário do provider, usando o idioma global mantido por
 * `i18n-locale.ts` — a mesma fonte usada por `formatStatus`.
 */
import { pt } from '@/i18n/pt';
import { en } from '@/i18n/en';
import { modulesPt, modulesEn } from '@/i18n/modules';
import { getAppLocale } from '@/lib/i18n-locale';

type Dictionary = Record<string, any>;

const dictionaries: Record<'pt' | 'en', Dictionary> = {
  pt: { ...pt, ...modulesPt },
  en: { ...en, ...modulesEn },
};

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

/** Resolve uma chave de tradução usando o idioma ativo do app. */
export function tGlobal(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[getAppLocale()] ?? dictionaries.pt;
  let result: any = dict;
  for (const k of key.split('.')) {
    result = result?.[k];
    if (result === undefined) return key;
  }
  if (typeof result !== 'string') return key;
  return interpolate(result, params);
}
