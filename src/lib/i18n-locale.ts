/**
 * Fonte única do idioma ativo para helpers puros (fora do React).
 *
 * O `LanguageProvider` empurra o idioma para cá sempre que ele muda, permitindo
 * que utilitários como `formatStatus` e `formatDateTime` — usados em centenas de
 * tabelas e cards — respeitem o idioma sem precisar de hook em cada componente.
 */
export type AppLocale = 'pt' | 'en';

const STORAGE_KEY = 'governaii-locale';

function readInitial(): AppLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'pt') return saved;
    return (navigator.language || '').startsWith('pt') ? 'pt' : 'en';
  } catch {
    return 'pt';
  }
}

let current: AppLocale = typeof window !== 'undefined' ? readInitial() : 'pt';

export const getAppLocale = (): AppLocale => current;

export const setAppLocale = (locale: AppLocale): void => {
  current = locale;
};
