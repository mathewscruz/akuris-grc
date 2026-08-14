import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { pt } from '@/i18n/pt';
import { en } from '@/i18n/en';
import { modulesPt, modulesEn, mergeDictionaries } from '@/i18n/modules';
import { supabase } from '@/integrations/supabase/client';
import { setAppLocale, getInitialLocale, persistExplicitLocale } from '@/lib/i18n-locale';

export type Locale = 'pt' | 'en';
type Dictionary = Record<string, any>;

const dictionaries: Record<Locale, Dictionary> = {
  pt: mergeDictionaries(pt, modulesPt),
  en: mergeDictionaries(en, modulesEn),
};


interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Resolve chaves cujo valor é uma lista de strings (ex.: exemplos de documentos). */
  tList: (key: string) => string[];
}

function resolveList(dict: Dictionary, key: string): string[] {
  let result: any = dict;
  for (const k of key.split('.')) {
    result = result?.[k];
    if (result === undefined) return [];
  }
  return Array.isArray(result) ? result.filter((v) => typeof v === 'string') : [];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'governaii-locale';
const MANUAL_KEY = 'governaii-locale-manual-ts';
// Janela em que a escolha manual do usuário tem prioridade sobre o profile (10 min)
const MANUAL_PRIORITY_MS = 10 * 60 * 1000;

function detectInitialLocale(): Locale {
  return getInitialLocale();
}

function hasRecentManualChoice(): boolean {
  try {
    const ts = Number(localStorage.getItem(MANUAL_KEY) || '0');
    return ts > 0 && Date.now() - ts < MANUAL_PRIORITY_MS;
  } catch {
    return false;
  }
}

/**
 * Salvaguarda de i18n: quando uma chave não existe no dicionário, mostramos um
 * texto legível de recurso (último segmento da chave "humanizado") em vez da
 * chave crua, e avisamos na consola em desenvolvimento.
 */
const missingKeysWarned = new Set<string>();
export function fallbackForKey(key: string, locale: Locale): string {
  if (import.meta.env.DEV && !missingKeysWarned.has(`${locale}:${key}`)) {
    missingKeysWarned.add(`${locale}:${key}`);
    // eslint-disable-next-line no-console
    console.warn(`[i18n] Chave de tradução ausente (${locale}): ${key}`);
  }
  const last = key.split('.').pop() || key;
  const spaced = last
    .replace(/[_-]+/g, ' ')
    .replace(/([a-zçãáéíóúâêô])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  // Mantém helpers puros (formatStatus, formatDateTime...) alinhados ao idioma.
  // Setado durante o render para valer já na primeira pintura após a troca.
  setAppLocale(locale);

  // Sync with profile.preferred_locale on auth changes
  useEffect(() => {
    let mounted = true;

    const syncFromProfile = async (userId: string) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_locale')
          .eq('user_id', userId)
          .maybeSingle();
        if (!mounted) return;
        const pref = (data as any)?.preferred_locale;
        if (pref !== 'pt' && pref !== 'en') return;

        // Se o usuário escolheu o idioma manualmente há pouco tempo (ex: na tela de login),
        // respeitamos essa escolha e atualizamos o profile para refletir a preferência.
        const currentLocal = (localStorage.getItem(STORAGE_KEY) as Locale | null);
        if (hasRecentManualChoice() && currentLocal && currentLocal !== pref) {
          supabase
            .from('profiles')
            .update({ preferred_locale: currentLocal } as any)
            .eq('user_id', userId)
            .then(() => {});
          return;
        }

        setLocaleState(pref);
        persistExplicitLocale(pref);
      } catch {
        // silent: keep local locale
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) syncFromProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) syncFromProfile(session.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    persistExplicitLocale(newLocale);
    try {
      localStorage.setItem(MANUAL_KEY, String(Date.now()));
    } catch {}

    // Persist to profile if logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .update({ preferred_locale: newLocale } as any)
        .eq('user_id', user.id)
        .then(() => {});
    });
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = dictionaries[locale];
    const keys = key.split('.');
    let result: any = dict;
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) return fallbackForKey(key, locale);
    }
    if (typeof result !== 'string') return fallbackForKey(key, locale);
    return interpolate(result, params);
  }, [locale]);

  const tList = useCallback((key: string): string[] => resolveList(dictionaries[locale], key), [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, tList }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Fallback seguro caso o contexto não esteja disponível (ex.: durante HMR ou
// remontagem após hot reload). Evita tela branca e mantém a aplicação funcional.
const fallbackContext: LanguageContextType = {
  locale: (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Locale)) || 'pt',
  setLocale: () => {},
  t: (key: string, params?: Record<string, string | number>) => {
    const loc: Locale = (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Locale)) || 'pt';
    const dict = dictionaries[loc];
    const keys = key.split('.');
    let result: any = dict;
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) return fallbackForKey(key, loc);
    }
    if (typeof result !== 'string') return fallbackForKey(key, loc);
    return interpolate(result, params);
  },
  tList: (key: string) =>
    resolveList(dictionaries[(typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Locale)) || 'pt'], key),
};


export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? fallbackContext;
}
