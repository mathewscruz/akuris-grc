/**
 * Fonte única do idioma ativo para helpers puros (fora do React).
 *
 * O `LanguageProvider` empurra o idioma para cá sempre que ele muda, permitindo
 * que utilitários como `formatStatus` e `formatDateTime` — usados em centenas de
 * tabelas e cards — respeitem o idioma sem precisar de hook em cada componente.
 */
export type AppLocale = 'pt' | 'en';

const STORAGE_KEY = 'governaii-locale';

const BR_TIMEZONES = new Set([
  'America/Sao_Paulo', 'America/Bahia', 'America/Manaus', 'America/Fortaleza',
  'America/Recife', 'America/Belem', 'America/Cuiaba', 'America/Campo_Grande',
  'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Maceio',
  'America/Araguaina', 'America/Santarem', 'America/Eirunepe', 'America/Noronha',
]);

/**
 * Idioma inicial pelo país de acesso: visitantes no Brasil recebem português,
 * qualquer outro país recebe inglês. Usa o fuso horário do dispositivo — sem
 * requisição externa. Fallback: idioma do navegador.
 */
export function detectLocaleByRegion(): AppLocale {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (BR_TIMEZONES.has(tz)) return 'pt';
    if (tz) return 'en';
  } catch {
    // Intl indisponível: cai no idioma do navegador
  }
  try {
    return (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  } catch {
    return 'en';
  }
}

function readInitial(): AppLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'pt') return saved;
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
