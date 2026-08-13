import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { pt } from '@/i18n/pt';
import { en } from '@/i18n/en';
import { modulesPt, modulesEn } from '@/i18n/modules';
import { supabase } from '@/integrations/supabase/client';

export type Locale = 'pt' | 'en';
type Dictionary = Record<string, any>;

const dictionaries: Record<Locale, Dictionary> = {
  pt: { ...pt, ...modulesPt },
  en: { ...en, ...modulesEn },
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
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'pt') return saved;
    const browserLang = navigator.language || '';
    return browserLang.startsWith('pt') ? 'pt' : 'en';
  } catch {
    return 'pt';
  }
}

function hasRecentManualChoice(): boolean {
  try {
    const ts = Number(localStorage.getItem(MANUAL_KEY) || '0');
    return ts > 0 && Date.now() - ts < MANUAL_PRIORITY_MS;
  } catch {
    return false;
  }
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

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
        try { localStorage.setItem(STORAGE_KEY, pref); } catch {}
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
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
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
      if (result === undefined) return key;
    }
    if (typeof result !== 'string') return key;
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
    const dict = dictionaries[(typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Locale)) || 'pt'];
    const keys = key.split('.');
    let result: any = dict;
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) return key;
    }
    if (typeof result !== 'string') return key;
    return interpolate(result, params);
  },
  tList: (key: string) =>
    resolveList(dictionaries[(typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Locale)) || 'pt'], key),
};


export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? fallbackContext;
}
