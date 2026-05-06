
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger, measurePerformance } from '@/lib/logger';

interface Profile {
  id: string;
  user_id: string;
  empresa_id: string | null;
  nome: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user' | 'readonly';
  ativo: boolean;
}

interface Company {
  id: string;
  nome: string;
  logo_url: string | null;
  cnpj: string | null;
  contato: string | null;
  ativo: boolean;
  status_licenca: 'trial' | 'em_operacao';
  data_inicio_trial: string | null;
  plano_id: string | null;
  creditos_consumidos: number;
  plano?: {
    nome: string;
    codigo: string;
    creditos_franquia: number;
    icone: string;
    cor_primaria: string;
  };
}

// =============================================================================
// MFA gate global
// =============================================================================
// O MFA é exigido para QUALQUER sessão Supabase exposta ao app — não apenas no
// fluxo de login. Toda sessão (login novo, restaurada do localStorage ou
// refrescada automaticamente pelo SDK) é validada via Edge Function
// `check-mfa-session`. Enquanto a checagem não confirmar uma sessão MFA válida
// nas últimas 24h, o provider mantém user/session = null e sinaliza pending.
//
// MFA_PENDING_KEY (sessionStorage): usado pela tela /auth para reabrir o MFA
// imediatamente quando a sessão ainda está aguardando o segundo fator.
// =============================================================================
export const MFA_PENDING_KEY = 'akuris_mfa_pending';

const MFA_VERIFIED_CACHE_KEY = 'akuris_mfa_verified_until';

const setMfaPendingFlag = (pending: boolean) => {
  try {
    if (typeof window === 'undefined') return;
    if (pending) sessionStorage.setItem(MFA_PENDING_KEY, '1');
    else sessionStorage.removeItem(MFA_PENDING_KEY);
  } catch {
    /* ignore */
  }
};

const getCachedMfaUntil = (): number => {
  try {
    if (typeof window === 'undefined') return 0;
    const raw = sessionStorage.getItem(MFA_VERIFIED_CACHE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const setCachedMfaUntil = (timestampMs: number) => {
  try {
    if (typeof window === 'undefined') return;
    if (timestampMs > 0) sessionStorage.setItem(MFA_VERIFIED_CACHE_KEY, String(timestampMs));
    else sessionStorage.removeItem(MFA_VERIFIED_CACHE_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Consulta a Edge Function de verificação MFA.
 * Retorna `true` somente quando o backend confirma sessão MFA válida.
 * Em caso de falha de rede, devolve `false` (fail-closed) para não liberar acesso.
 */
const checkMfaSessionRemote = async (): Promise<{ verified: boolean; expiresAt?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('check-mfa-session', { body: {} });
    if (error) {
      logger.warn('check-mfa-session falhou', { module: 'auth', error: String(error) });
      return { verified: false };
    }
    if (data?.verified === true) {
      return { verified: true, expiresAt: data.expires_at };
    }
    return { verified: false };
  } catch (err) {
    logger.warn('Exceção em check-mfa-session', { module: 'auth', error: String(err) });
    return { verified: false };
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
  hasTemporaryPassword: boolean;
  checkTemporaryPassword: () => Promise<void>;
  logoUpdateKey: number;
  forceLogoUpdate: () => void;
  initializeUserPermissions: () => Promise<void>;
  debugAuthState: () => void;
  /** Marca uma sessão MFA como válida localmente (chamado após verify-mfa-code). */
  markMfaVerified: (expiresAt?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTemporaryPassword, setHasTemporaryPassword] = useState(false);
  const [logoUpdateKey, setLogoUpdateKey] = useState(0);
  // Versão monotônica usada para descartar resultados de evaluateSession
  // antigos que cheguem após um novo (evita "loga e desloga" por corrida).
  const evalSeqRef = React.useRef(0);

  const fetchProfile = async (userId: string) => {
    try {
      logger.debug('Fetching profile for user', { userId, module: 'auth' });

      const { data, error } = await measurePerformance(
        'fetchProfile',
        () => supabase
          .from('profiles')
          .select(`
            *,
            empresas:empresa_id (
              id,
              nome,
              logo_url,
              cnpj,
              contato,
              ativo,
              status_licenca,
              data_inicio_trial,
              plano_id,
              creditos_consumidos,
              plano:planos (
                nome,
                codigo,
                creditos_franquia,
                icone,
                cor_primaria
              )
            )
          `)
          .eq('user_id', userId)
          .single(),
        { userId, module: 'auth' }
      );

      if (error) throw error;

      logger.info('Profile fetched successfully', {
        userId,
        profileId: data.id,
        empresaId: data.empresa_id,
        role: data.role
      });
      setProfile(data);

      const newCompany = data.empresas ? {
        ...data.empresas,
        status_licenca: (data.empresas.status_licenca || 'em_operacao') as 'trial' | 'em_operacao',
        data_inicio_trial: data.empresas.data_inicio_trial || null,
      } : null;
      logger.debug('Company updated', {
        empresaId: newCompany?.id,
        empresaNome: newCompany?.nome
      });
      setCompany(newCompany);

      setLogoUpdateKey(prev => prev + 1);
      logger.debug('Logo update key incremented');
    } catch (error) {
      logger.error('Error fetching profile', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      setProfile(null);
      setCompany(null);
    }
  };

  const forceLogoUpdate = () => {
    setLogoUpdateKey(prev => prev + 1);
  };

  const initializeUserPermissions = async () => {
    if (!user) return;

    try {
      logger.info('Initializing permissions for user', { userId: user.id, module: 'auth' });
      const { error } = await supabase.rpc('apply_default_permissions_for_user', {
        user_id_param: user.id
      });

      if (error) {
        logger.error('Error initializing user permissions', {
          error: error.message,
          userId: user.id
        });
      } else {
        logger.info('User permissions initialized successfully', { userId: user.id });
      }
    } catch (error) {
      logger.error('Error calling apply_default_permissions_for_user', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id
      });
    }
  };

  const debugAuthState = () => {
    logger.debug('Current auth state', {
      userId: user?.id,
      sessionExists: !!session,
      profileExists: !!profile,
      companyExists: !!company,
      profileRole: profile?.role,
      profileEmpresaId: profile?.empresa_id,
      module: 'auth'
    });
  };

  const checkTemporaryPassword = async () => {
    if (!user) {
      setHasTemporaryPassword(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('temporary_passwords')
        .select('is_temporary, created_at, expires_at')
        .eq('user_id', user.id)
        .eq('is_temporary', true)
        .maybeSingle();

      if (error) {
        setHasTemporaryPassword(false);
        return;
      }
      setHasTemporaryPassword(!!data?.is_temporary);
    } catch {
      setHasTemporaryPassword(false);
    }
  };

  const refetchProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const markMfaVerified = (expiresAt?: string) => {
    const expMs = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 24 * 60 * 60 * 1000;
    setCachedMfaUntil(expMs);
    setMfaPendingFlag(false);
    // Reavalia a sessão Supabase atual para expor user/session ao app sem
    // depender de refreshSession (evita disparar eventos auth duplicados).
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      evaluateSession(current);
    });
  };

  /**
   * Decide o que expor como sessão "efetiva" para o app.
   * - Se não há sessão Supabase → expõe null (deslogado).
   * - Se há sessão e o cache local diz MFA válido → expõe imediatamente.
   * - Senão chama o backend; se confirmar MFA → expõe; caso contrário marca pending e expõe null.
   */
  const evaluateSession = async (rawSession: Session | null) => {
    const seq = ++evalSeqRef.current;
    const isLatest = () => seq === evalSeqRef.current;

    if (!rawSession?.user) {
      if (!isLatest()) return;
      setMfaPendingFlag(false);
      setCachedMfaUntil(0);
      setSession(null);
      setUser(null);
      setProfile(null);
      setCompany(null);
      setHasTemporaryPassword(false);
      return;
    }

    // Cache local (sessionStorage) — evita refazer a chamada toda hora.
    const cachedUntil = getCachedMfaUntil();
    if (cachedUntil > Date.now()) {
      if (!isLatest()) return;
      setMfaPendingFlag(false);
      setSession(rawSession);
      setUser(rawSession.user);
      setTimeout(() => {
        Promise.all([
          fetchProfileSafe(rawSession.user.id),
          checkTemporaryPasswordForUser(rawSession.user.id),
        ]);
      }, 0);
      return;
    }

    // Sem cache válido → consulta o backend.
    const { verified, expiresAt } = await checkMfaSessionRemote();
    if (!isLatest()) return; // descarta resposta antiga

    if (!verified) {
      // Bloqueia a exposição da sessão até o MFA ser concluído.
      setMfaPendingFlag(true);
      setSession(null);
      setUser(null);
      setProfile(null);
      setCompany(null);
      setHasTemporaryPassword(false);
      return;
    }

    // MFA confirmado pelo backend.
    if (expiresAt) setCachedMfaUntil(new Date(expiresAt).getTime());
    setMfaPendingFlag(false);
    setSession(rawSession);
    setUser(rawSession.user);
    setTimeout(() => {
      Promise.all([
        fetchProfileSafe(rawSession.user.id),
        checkTemporaryPasswordForUser(rawSession.user.id),
      ]);
    }, 0);
  };

  // Wrappers para uso interno (necessários antes de declarados acima).
  const fetchProfileSafe = async (userId: string) => fetchProfile(userId);
  const checkTemporaryPasswordForUser = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('temporary_passwords')
        .select('is_temporary')
        .eq('user_id', userId)
        .eq('is_temporary', true)
        .maybeSingle();
      setHasTemporaryPassword(!!data?.is_temporary);
    } catch {
      setHasTemporaryPassword(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, sess) => {
        if (!isSubscribed) return;
        logger.info('Auth state changed', { event, userId: sess?.user?.id, module: 'auth' });

        // SIGNED_OUT limpa tudo, inclusive cache de MFA.
        if (event === 'SIGNED_OUT') {
          setCachedMfaUntil(0);
          setMfaPendingFlag(false);
        }

        // Avalia de forma assíncrona para não bloquear o callback.
        setTimeout(() => {
          if (isSubscribed) evaluateSession(sess).finally(() => setLoading(false));
        }, 0);
      }
    );

    // Sessão inicial (refresh, navegação direta etc.).
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isSubscribed) return;
      logger.debug('Initial session check', { userId: initialSession?.user?.id, module: 'auth' });
      evaluateSession(initialSession).finally(() => {
        if (isSubscribed) setLoading(false);
      });
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  // initializeUserPermissions roda quando user fica disponível.
  useEffect(() => {
    if (user) {
      setTimeout(() => {
        initializeUserPermissions();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signOut = async () => {
    setCachedMfaUntil(0);
    setMfaPendingFlag(false);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    session,
    profile,
    company,
    loading,
    signOut,
    refetchProfile,
    hasTemporaryPassword,
    checkTemporaryPassword,
    logoUpdateKey,
    forceLogoUpdate,
    initializeUserPermissions,
    debugAuthState,
    markMfaVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
