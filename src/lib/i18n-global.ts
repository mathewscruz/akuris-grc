/**
 * Tradução fora do React.
 *
 * Hooks utilitários e helpers puros (toasts em hooks de dados, exportadores,
 * timeouts de sessão) não têm acesso ao `useLanguage`. Este helper resolve a
 * chave no mesmo dicionário do provider, usando o idioma global mantido por
 * `i18n-locale.ts` — a mesma fonte usada por `formatStatus`.
 */
import { dictionaryFor } from '@/lib/dictionary-registry';
import { getAppLocale } from '@/lib/i18n-locale';

type Dictionary = Record<string, any>;



function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  // Aceita {chave} e {{chave}}.
  return str.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (full, k1, k2) => {
    const k = k1 ?? k2;
    return params[k] !== undefined ? String(params[k]) : full;
  });
}


/** Resolve uma chave de tradução usando o idioma ativo do app. */
export function tGlobal(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaryFor(getAppLocale());
  let result: any = dict;
  for (const k of key.split('.')) {
    result = result?.[k];
    if (result === undefined) return key;
  }
  if (typeof result !== 'string') return key;
  return interpolate(result, params);
}
