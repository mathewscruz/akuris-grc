/**
 * Fonte única do idioma ativo para helpers puros (fora do React).
 *
 * O `LanguageProvider` empurra o idioma para cá sempre que ele muda, permitindo
 * que utilitários como `formatStatus` e `formatDateTime` — usados em centenas de
 * tabelas e cards — respeitem o idioma sem precisar de hook em cada componente.
 */
export type AppLocale = 'pt' | 'pt-BR' | 'en';

/** Escolha manual do usuário (toggle) ou preferência do perfil autenticado. */
export const LOCALE_STORAGE_KEY = 'governaii-locale';
/** Marca que a chave acima veio de uma escolha explícita, não de autodetecção. */
export const LOCALE_EXPLICIT_KEY = 'governaii-locale-explicit';

const BR_TIMEZONES = new Set([
  'America/Sao_Paulo', 'America/Bahia', 'America/Manaus', 'America/Fortaleza',
  'America/Recife', 'America/Belem', 'America/Cuiaba', 'America/Campo_Grande',
  'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Maceio',
  'America/Araguaina', 'America/Santarem', 'America/Eirunepe', 'America/Noronha',
  'Brazil/East', 'Brazil/West', 'Brazil/Acre', 'Brazil/DeNoronha',
]);

const PT_TIMEZONES = new Set([
  'Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores', 'Portugal',
]);

/**
 * Idioma inicial pelo país de acesso: visitantes no Brasil e em Portugal recebem
 * português, qualquer outro país recebe inglês. Usa o fuso horário do dispositivo
 * — sem requisição externa. Fallback: idioma do navegador.
 */
export function detectLocaleByRegion(): AppLocale {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (BR_TIMEZONES.has(tz)) return 'pt-BR';
    if (PT_TIMEZONES.has(tz)) return 'pt';
    if (tz) return localeFromNavigator() ?? 'en';
  } catch {
    // Intl indisponível: cai no idioma do navegador
  }
  return localeFromNavigator() ?? 'en';
}

/** Idioma do navegador convertido para as variantes suportadas. */
function localeFromNavigator(): AppLocale | null {
  try {
    const lang = (navigator.language || '').toLowerCase();
    if (lang.startsWith('pt')) return lang === 'pt-br' || lang.startsWith('pt-br') ? 'pt-BR' : 'pt';
    return null;
  } catch {
    return null;
  }
}

/** Todas as variantes suportadas, na ordem em que aparecem no seletor. */
export const SUPPORTED_LOCALES: AppLocale[] = ['pt', 'pt-BR', 'en'];

export const isSupportedLocale = (value: unknown): value is AppLocale =>
  value === 'pt' || value === 'pt-BR' || value === 'en';

/**
 * Só respeita o valor gravado quando ele veio de escolha explícita (toggle ou
 * perfil). Idiomas apenas autodetectados em visitas anteriores são descartados,
 * evitando que um usuário fique "preso" no idioma errado.
 */
function readInitial(): AppLocale {
  try {
    const explicit = localStorage.getItem(LOCALE_EXPLICIT_KEY) === '1';
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (explicit && isSupportedLocale(saved)) return saved;
    if (!explicit && saved) {
      // Migração única da chave legada gravada por autodetecção.
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    }
  } catch {
    // localStorage indisponível
  }
  return detectLocaleByRegion();
}

let current: AppLocale = typeof window !== 'undefined' ? readInitial() : 'pt';

export const getAppLocale = (): AppLocale => current;

export const setAppLocale = (locale: AppLocale): void => {
  current = locale;
};

/** Idioma inicial da aplicação (autodetecção + escolha explícita persistida). */
export const getInitialLocale = (): AppLocale =>
  typeof window === 'undefined' ? 'pt' : readInitial();

/** Persiste uma escolha explícita de idioma (toggle manual ou perfil). */
export const persistExplicitLocale = (locale: AppLocale): void => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    localStorage.setItem(LOCALE_EXPLICIT_KEY, '1');
  } catch {
    // localStorage indisponível
  }
};
