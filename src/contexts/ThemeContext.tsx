import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';

type Theme = 'light' | 'dark';
const GLOBAL_KEY = 'akuris.theme';
const userKey = (uid: string) => `akuris.theme.${uid}`;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

const readStoredTheme = (uid: string | null): Theme => {
  if (typeof window === 'undefined') return 'light';
  try {
    if (uid) {
      const perUser = window.localStorage.getItem(userKey(uid)) as Theme | null;
      if (perUser === 'light' || perUser === 'dark') return perUser;
    }
    const stored = window.localStorage.getItem(GLOBAL_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  // Default app: light
  return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [theme, setThemeState] = React.useState<Theme>(() => readStoredTheme(null));

  // Sincroniza userId com a sessão Supabase para persistir tema por usuário
  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setThemeState(readStoredTheme(uid));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      setThemeState(readStoredTheme(uid));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Aplica o tema no <html> e persiste por usuário (ou global se anônimo)
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      if (userId) window.localStorage.setItem(userKey(userId), theme);
      // Sempre grava o global: o index.html lê-o antes do React arrancar.
      window.localStorage.setItem(GLOBAL_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, userId]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
};
