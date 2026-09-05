import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, MFA_PENDING_KEY, isLocalDataPreview } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/lib/toast';
import { PasswordRecoveryPanel } from '@/components/auth/PasswordRecoveryPanel';
import { AuthShell } from '@/components/auth/AuthShell';
import { MFAVerification } from '@/components/MFAVerification';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { IconView, IconHide } from '@/components/icons';

type AuthPhase = 'idle' | 'authenticating' | 'mfa_required' | 'finalizing';

const Auth = () => {
  const { user, loading, markMfaVerified } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState('');
  const [phase, setPhase] = useState<AuthPhase>('idle');
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaEnvioFalhou, setMfaEnvioFalhou] = useState(false);
  const [mfaCodeExpiresAt, setMfaCodeExpiresAt] = useState<string>();

  const recoveryMode = searchParams.get('recovery') === '1';
  const showOverlay = phase === 'authenticating' || phase === 'finalizing';
  const isBusy = phase !== 'idle';
  const loginSchema = useMemo(() => z.object({
    email: z.string().min(1, t('auth.validationEmailRequired')).email(t('auth.validationEmailInvalid')),
    // Login valida presença, não a política de criação. Isso mantém contas
    // antigas utilizáveis e não revela regras antes da autenticação.
    password: z.string().min(1, t('auth.validationPasswordRequired')),
  }), [t]);

  const getErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message.includes('Invalid login credentials') || message.includes('User not found')) {
      return t('auth.errorInvalidCredentials');
    }
    if (message.includes('Email not confirmed')) return t('auth.errorInvalidCredentials');
    if (message.includes('Too many requests')) return t('auth.errorTooManyRequests');
    if (message.includes('Network') || message.includes('fetch')) return t('auth.errorNetwork');
    return t('auth.errorGeneric');
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('akuris_remember_email');
    const savedRemember = localStorage.getItem('akuris_remember_me') === 'true';
    if (savedEmail && savedRemember) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Reabre o segundo fator quando uma sessão do Supabase foi restaurada, mas
  // ainda não existe confiança MFA para o session_id atual.
  useEffect(() => {
    if (loading || phase !== 'idle' || recoveryMode) return;
    if (isLocalDataPreview()) {
      try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
      return;
    }

    let mfaPending = false;
    try { mfaPending = sessionStorage.getItem(MFA_PENDING_KEY) === '1'; } catch { /* storage indisponível */ }
    if (!mfaPending) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
        return;
      }

      setMfaEmail(session.user.email ?? '');
      try {
        const response = await supabase.functions.invoke('send-mfa-code', {
          body: { context: 'session_restore' },
        });
        if (response.error || !response.data?.success) {
          logger.error('Falha ao enviar MFA em sessão restaurada', {
            module: 'Auth',
            errorCode: response.data?.error_code ?? 'request_failed',
          });
          setMfaEnvioFalhou(true);
        } else if (response.data.skipped && response.data.expires_at) {
          markMfaVerified(response.data.expires_at);
          try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
          return;
        } else {
          setMfaEnvioFalhou(false);
          setMfaCodeExpiresAt(response.data.expires_at);
        }
      } catch (error) {
        logger.error('Exceção ao enviar MFA em sessão restaurada', {
          module: 'Auth',
          error: error instanceof Error ? error.message : String(error),
        });
        setMfaEnvioFalhou(true);
      }
      setPhase('mfa_required');
    });
  }, [loading, phase, recoveryMode, markMfaVerified]);

  if (!loading && user && phase !== 'mfa_required') {
    return <Navigate to="/dashboard" replace />;
  }

  if (showOverlay) return <LoadingOverlay />;

  if (loading) {
    return (
      <AuthShell>
        <div className="flex min-h-56 flex-col items-center justify-center">
          <AkurisPulse size={40} />
          <p className="mt-4 text-sm text-white/70">{t('common.loading')}</p>
        </div>
      </AuthShell>
    );
  }

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setAuthError('');

    const validation = loginSchema.safeParse({ email: email.trim(), password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((error) => {
        if (error.path[0] === 'email') fieldErrors.email = error.message;
        if (error.path[0] === 'password') fieldErrors.password = error.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // O pending é gravado antes do SIGNED_IN. Assim o AuthProvider nunca usa
    // um cache MFA anterior durante a troca para uma nova sessão.
    try { sessionStorage.setItem(MFA_PENDING_KEY, '1'); } catch { /* storage indisponível */ }
    setPhase('authenticating');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('authenticated_user_missing');

      if (rememberMe) {
        localStorage.setItem('akuris_remember_email', email.trim());
        localStorage.setItem('akuris_remember_me', 'true');
      } else {
        localStorage.removeItem('akuris_remember_email');
        localStorage.removeItem('akuris_remember_me');
      }

      if (isLocalDataPreview()) {
        markMfaVerified();
        try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
        setPhase('finalizing');
        return;
      }

      const response = await supabase.functions.invoke('send-mfa-code', {
        body: { context: 'fresh_login' },
      });

      setMfaEmail(email.trim());

      if (response.error || response.data?.success !== true) {
        logger.error('Falha ao iniciar verificação MFA', {
          module: 'Auth',
          errorCode: response.data?.error_code ?? 'request_failed',
        });
        setMfaEnvioFalhou(true);
        setPhase('mfa_required');
        return;
      }

      if (response.data.skipped && response.data.expires_at) {
        markMfaVerified(response.data.expires_at);
        try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
        setPhase('finalizing');
        return;
      }

      setMfaEnvioFalhou(false);
      setMfaCodeExpiresAt(response.data.expires_at);
      setPhase('mfa_required');
    } catch (error) {
      try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
      logger.warn('Login failed', {
        module: 'Auth',
        action: 'login',
        reason: error instanceof Error ? error.name : 'unknown',
      });
      setAuthError(getErrorMessage(error));
      setPhase('idle');
    }
  };

  const handleMFAVerified = (expiresAt?: string) => {
    setPhase('finalizing');
    markMfaVerified(expiresAt);
    try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
    toast.success(t('auth.loginSuccess'));
  };

  const handleMFACancel = async () => {
    try { await supabase.auth.signOut(); } catch { /* sessão já pode ter expirado */ }
    try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* storage indisponível */ }
    setMfaEmail('');
    setPassword('');
    setPhase('idle');
  };

  if (phase === 'mfa_required') {
    return (
      <MFAVerification
        email={mfaEmail}
        codeExpiresAt={mfaCodeExpiresAt}
        onVerified={handleMFAVerified}
        onCancel={handleMFACancel}
        envioFalhou={mfaEnvioFalhou}
      />
    );
  }

  if (recoveryMode) {
    return (
      <AuthShell>
        <PasswordRecoveryPanel
          initialEmail={email}
          onBack={() => setSearchParams({}, { replace: true })}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-1.5 text-center lg:text-left">
          <h1 className="text-[1.75rem] font-medium tracking-[-0.02em] text-white">{t('auth.welcomeBack')}</h1>
          <p className="text-sm text-white/70">{t('auth.signInToContinue')}</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-white/85">{t('auth.emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
                setAuthError('');
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'auth-email-error' : undefined}
              className="h-11 rounded-md border-white/[0.09] bg-white/[0.03] text-white placeholder:text-white/60 focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
              disabled={isBusy}
              autoComplete="username"
            />
            {errors.email && <p id="auth-email-error" role="alert" className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-white/85">{t('auth.passwordLabel')}</Label>
              <button
                type="button"
                onClick={() => setSearchParams({ recovery: '1' }, { replace: true })}
                className="flex min-h-11 items-center px-1 text-xs text-white/85 underline decoration-primary underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((current) => ({ ...current, password: undefined }));
                  setAuthError('');
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'auth-password-error' : undefined}
                className="h-11 rounded-md border-white/[0.09] bg-white/[0.03] pr-12 text-white placeholder:text-white/60 focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
                disabled={isBusy}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/70 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <IconHide className="h-5 w-5" /> : <IconView className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p id="auth-password-error" role="alert" className="text-xs text-destructive">{errors.password}</p>}
          </div>

          {authError && (
            <p role="alert" aria-live="assertive" className="border-l-2 border-destructive pl-3 text-sm leading-5 text-destructive">
              {authError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              disabled={isBusy}
            />
            <Label htmlFor="remember" className="cursor-pointer text-xs text-white/70">{t('auth.rememberEmail')}</Label>
          </div>

          <Button type="submit" className="h-11 w-full rounded-md text-sm font-medium" disabled={isBusy}>
            {isBusy ? <><AkurisPulse size={16} className="mr-2" />{t('auth.signingIn')}</> : t('auth.signIn')}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
};

export default Auth;
