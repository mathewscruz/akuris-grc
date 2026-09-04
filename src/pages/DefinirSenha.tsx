import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { IconCheck, IconClose, IconHide, IconSuccess, IconView, IconWarning } from '@/components/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { REGRAS_SENHA, esquemaSenha } from '@/lib/politica-senha';

type LinkType = 'recovery' | 'invite';

const buildPasswordSchema = (t: (key: string) => string) => z.object({
  password: esquemaSenha(t),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: t('passwordChange.passwordsDontMatch'),
  path: ['confirmPassword'],
});

const isSupportedLinkType = (value: string | null): value is LinkType =>
  value === 'recovery' || value === 'invite';

const DefinirSenha = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const passwordSchema = useMemo(() => buildPasswordSchema(t), [t]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirectIn, setRedirectIn] = useState(5);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; request?: string }>({});
  const [pendingToken, setPendingToken] = useState<{ token_hash: string; type: LinkType } | null>(null);
  const [hasVerifiedLinkSession, setHasVerifiedLinkSession] = useState(false);

  useEffect(() => {
    const checkPresence = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        const tokenHash = searchParams.get('token_hash');

        // Uma sessão autenticada comum não transforma esta rota numa troca de
        // senha. Só aceitamos sessão criada por invite/recovery ou token ainda
        // não consumido desses dois tipos.
        if (accessToken && refreshToken && isSupportedLinkType(type)) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            logger.warn('Link de senha não criou sessão válida', { module: 'auth', reason: error.name });
            setIsTokenValid(false);
          } else {
            setHasVerifiedLinkSession(true);
            setIsTokenValid(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (tokenHash && isSupportedLinkType(type)) {
          // O token é consumido só no submit para que scanners de links de
          // e-mail não o queimem antes de a pessoa abrir a página.
          setPendingToken({ token_hash: tokenHash, type });
          setIsTokenValid(true);
        } else {
          setIsTokenValid(false);
        }
      } catch (error) {
        logger.warn('Não foi possível validar o link de senha', {
          module: 'auth',
          reason: error instanceof Error ? error.name : 'unknown',
        });
        setIsTokenValid(false);
      } finally {
        setIsVerifying(false);
      }
    };

    void checkPresence();
  }, [searchParams]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setInterval(() => {
      setRedirectIn((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          navigate('/auth', { replace: true });
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [navigate, success]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const fieldErrors: typeof errors = {};
      validation.error.errors.forEach((error) => {
        if (error.path[0] === 'password') fieldErrors.password = error.message;
        if (error.path[0] === 'confirmPassword') fieldErrors.confirmPassword = error.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      if (pendingToken && !hasVerifiedLinkSession) {
        const { error: otpError } = await supabase.auth.verifyOtp(pendingToken);
        if (otpError) {
          logger.warn('Token de definição de senha recusado', { module: 'auth', reason: otpError.name });
          setIsTokenValid(false);
          return;
        }
        setHasVerifiedLinkSession(true);
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // A troca de senha encerra tanto a confiança MFA própria quanto as
      // demais sessões de autenticação. Um token roubado deixa de continuar
      // útil depois da recuperação.
      const { error: revokeError } = await supabase.rpc('revoke_my_mfa_sessions');
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (revokeError || signOutError) {
        logger.warn('Senha redefinida com revogação parcial de sessão', {
          module: 'auth',
          revokeMfaFailed: Boolean(revokeError),
          signOutFailed: Boolean(signOutError),
        });
      }

      setSuccess(true);
      setRedirectIn(5);
    } catch (error) {
      logger.error('Erro ao definir senha', {
        module: 'auth',
        action: 'set-password',
        reason: error instanceof Error ? error.name : 'unknown',
      });
      setErrors({ request: t('defineSenhaPage.error') });
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <AuthShell>
        <div className="flex min-h-56 flex-col items-center justify-center">
          <AkurisPulse size={40} />
          <p className="mt-4 text-sm text-white/45">{t('defineSenhaPage.verifying')}</p>
        </div>
      </AuthShell>
    );
  }

  if (!isTokenValid) {
    return (
      <AuthShell>
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-destructive">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-destructive/25 bg-destructive/10">
                <IconWarning className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.16em]">{t('defineSenhaPage.linkStatus')}</span>
            </div>
            <h1 className="text-[1.75rem] font-medium tracking-[-0.02em]">{t('defineSenhaPage.invalidLinkTitle')}</h1>
            <p className="text-sm leading-6 text-white/50">{t('defineSenhaPage.invalidLinkDesc')}</p>
          </div>

          <div className="space-y-3">
            <Button onClick={() => navigate('/auth?recovery=1', { replace: true })} className="h-11 w-full rounded-md font-medium">
              {t('defineSenhaPage.requestNewLink')}
            </Button>
            <button
              type="button"
              onClick={() => navigate('/auth', { replace: true })}
              className="min-h-11 w-full text-xs text-white/45 transition-colors hover:text-white/75"
            >
              {t('defineSenhaPage.goToLogin')}
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell>
        <div className="space-y-8" aria-live="polite">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-success">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-success/25 bg-success/10">
                <IconSuccess className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.16em]">{t('defineSenhaPage.completed')}</span>
            </div>
            <h1 className="text-[1.75rem] font-medium tracking-[-0.02em]">{t('defineSenhaPage.successTitle')}</h1>
            <p className="text-sm leading-6 text-white/50">
              {t('defineSenhaPage.successDesc', { seconds: String(redirectIn) })}
            </p>
          </div>
          <Button onClick={() => navigate('/auth', { replace: true })} className="h-11 w-full rounded-md font-medium">
            {t('defineSenhaPage.signInNow')}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{t('defineSenhaPage.eyebrow')}</span>
            <span className="text-xs text-white/35">{t('defineSenhaPage.secureSession')}</span>
          </div>
          <h1 className="text-[1.75rem] font-medium tracking-[-0.02em]">{t('defineSenhaPage.title')}</h1>
          <p className="text-sm leading-6 text-white/50">{t('defineSenhaPage.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-medium tracking-wide text-white/65">{t('defineSenhaPage.newPassword')}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((current) => ({ ...current, password: undefined, request: undefined }));
                }}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'new-password-error' : 'password-requirements'}
                placeholder={t('defineSenhaPage.newPasswordPlaceholder')}
                className="h-11 rounded-md border-white/[0.09] bg-white/[0.03] pr-12 text-white placeholder:text-white/25 focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/40 hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <IconHide className="h-5 w-5" /> : <IconView className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p id="new-password-error" role="alert" className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-xs font-medium tracking-wide text-white/65">{t('defineSenhaPage.confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrors((current) => ({ ...current, confirmPassword: undefined, request: undefined }));
                }}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                placeholder={t('defineSenhaPage.confirmPasswordPlaceholder')}
                className="h-11 rounded-md border-white/[0.09] bg-white/[0.03] pr-12 text-white placeholder:text-white/25 focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((current) => !current)}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/40 hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showConfirm ? <IconHide className="h-5 w-5" /> : <IconView className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p id="confirm-password-error" role="alert" className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>

          <div id="password-requirements" className="border-y border-white/[0.08] py-3">
            <p className="mb-2 text-xs font-medium text-white/45">{t('defineSenhaPage.requirements')}</p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {REGRAS_SENHA.map((rule) => {
                const valid = rule.testa(password);
                return (
                  <li key={rule.chave} className={valid ? 'flex items-center gap-2 text-xs text-success' : 'flex items-center gap-2 text-xs text-white/35'}>
                    {valid ? <IconCheck className="h-3.5 w-3.5" /> : <IconClose className="h-3.5 w-3.5" />}
                    {t(`politicaSenha.${rule.chave}`)}
                  </li>
                );
              })}
            </ul>
          </div>

          {errors.request && (
            <p role="alert" aria-live="assertive" className="border-l-2 border-destructive pl-3 text-sm text-destructive">
              {errors.request}
            </p>
          )}

          <Button type="submit" className="h-11 w-full rounded-md font-medium" disabled={isLoading}>
            {isLoading ? <><AkurisPulse size={16} className="mr-2" />{t('defineSenhaPage.saving')}</> : t('defineSenhaPage.submit')}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
};

export default DefinirSenha;
