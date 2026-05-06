import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, MFA_PENDING_KEY } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import logoImage from '@/assets/akuris-logo.png';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { LanguageSelector } from '@/components/LanguageSelector';
import { MFAVerification } from '@/components/MFAVerification';
import { useLanguage } from '@/contexts/LanguageContext';
import { z } from 'zod';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { AkurisMarkPattern } from '@/components/identity/AkurisMarkPattern';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { RiscosIcon, ControlesIcon, GapAnalysisIcon } from '@/components/icons';

const Auth = () => {
  const { user, loading, markMfaVerified } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Máquina de estados:
  // - idle: form normal
  // - authenticating: validando credenciais e enviando código → overlay
  // - mfa_required: tela MFA visível
  // - finalizing: MFA validado, aguardando AuthProvider expor o user → overlay
  type AuthPhase = 'idle' | 'authenticating' | 'mfa_required' | 'finalizing';
  const [phase, setPhase] = useState<AuthPhase>('idle');
  const [mfaUserId, setMfaUserId] = useState('');
  const [mfaEmail, setMfaEmail] = useState('');

  const showOverlay = phase === 'authenticating' || phase === 'finalizing';
  const isBusy = phase !== 'idle';

  const loginSchema = z.object({
    email: z.string().min(1, t('auth.validationEmailRequired')).email(t('auth.validationEmailInvalid')),
    password: z.string().min(6, t('auth.validationPasswordMin'))
  });

  const getErrorMessage = (error: any): string => {
    const message = error?.message || '';
    if (message.includes('Invalid login credentials')) return t('auth.errorInvalidCredentials');
    if (message.includes('Email not confirmed')) return t('auth.errorEmailNotConfirmed');
    if (message.includes('User not found')) return t('auth.errorUserNotFound');
    if (message.includes('Too many requests')) return t('auth.errorTooManyRequests');
    if (message.includes('Network')) return t('auth.errorNetwork');
    return t('auth.errorGeneric');
  };

  const pillars = [
    { Icon: RiscosIcon, title: t('auth.pillarRiscos'), desc: t('auth.pillarRiscosDesc') },
    { Icon: ControlesIcon, title: t('auth.pillarControles'), desc: t('auth.pillarControlesDesc') },
    { Icon: GapAnalysisIcon, title: t('auth.pillarGapAnalysis'), desc: t('auth.pillarGapAnalysisDesc') },
  ];

  // Carrega lembrete de e-mail salvo.
  useEffect(() => {
    const savedEmail = localStorage.getItem('akuris_remember_email');
    const savedRemember = localStorage.getItem('akuris_remember_me') === 'true';
    if (savedEmail && savedRemember) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Detecta MFA pendente vindo de sessão restaurada (ex.: usuário ficou >24h
  // sem usar e voltou — Supabase tem sessão persistida, mas check-mfa-session
  // retornou false, então o AuthProvider marcou MFA_PENDING_KEY).
  useEffect(() => {
    if (loading) return;
    if (phase !== 'idle') return;
    let mfaPending = false;
    try { mfaPending = sessionStorage.getItem(MFA_PENDING_KEY) === '1'; } catch { /* ignore */ }
    if (!mfaPending) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* ignore */ }
        return;
      }
      setMfaUserId(session.user.id);
      setMfaEmail(session.user.email ?? '');
      // Pede o código (ou reutiliza o ativo). Não derruba a sessão em caso de erro:
      // o usuário continua na tela MFA e pode usar "Reenviar".
      try {
        const resp = await supabase.functions.invoke('send-mfa-code', {
          body: { context: 'session_restore' },
        });
        if (resp.error || !resp.data?.success) {
          logger.error('Falha ao enviar MFA em sessão restaurada', {
            module: 'Auth',
            error: String(resp.error || resp.data?.error || 'desconhecido'),
          });
          toast.error(t('mfaScreen.resendError'));
        } else if (resp.data?.skipped && resp.data?.expires_at) {
          // MFA já é válido (24h) — libera direto sem pedir código.
          markMfaVerified(resp.data.expires_at);
          try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* ignore */ }
          return;
        }
      } catch (err) {
        logger.error('Exceção ao enviar MFA em sessão restaurada', {
          module: 'Auth',
          error: String(err),
        });
        toast.error(t('mfaScreen.resendError'));
      }
      setPhase('mfa_required');
    });
  }, [loading, phase, t, markMfaVerified]);

  // Só navega quando NÃO está no fluxo MFA.
  if (!loading && user && phase !== 'mfa_required') {
    return <Navigate to="/dashboard" replace />;
  }

  if (showOverlay) {
    return <LoadingOverlay />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(230,25%,7%)]">
        <div className="text-center">
          <AkurisPulse size={48} />
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const validation = loginSchema.safeParse({ email: email.trim(), password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Marca pending ANTES do signInWithPassword para o AuthProvider não expor
    // a sessão entre o evento SIGNED_IN e a decisão final do MFA.
    try { sessionStorage.setItem(MFA_PENDING_KEY, '1'); } catch { /* ignore */ }
    setPhase('authenticating');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) {
        try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* ignore */ }
        toast.error(t('auth.errorAuth'));
        setPhase('idle');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('akuris_remember_email', email.trim());
        localStorage.setItem('akuris_remember_me', 'true');
      } else {
        localStorage.removeItem('akuris_remember_email');
        localStorage.removeItem('akuris_remember_me');
      }

      // Decide via send-mfa-code:
      // - skipped:true → existe sessão MFA válida (24h) → entra direto.
      // - success:true → código enviado → abre tela MFA.
      // - falha → mantém sessão Supabase (não faz signOut), mostra erro
      //   e abre a tela MFA com botão de reenviar.
      const mfaResponse = await supabase.functions.invoke('send-mfa-code', {
        body: { context: 'fresh_login' },
      });

      if (mfaResponse.error) {
        logger.error('Erro ao invocar send-mfa-code', { module: 'Auth', error: String(mfaResponse.error) });
        toast.error(t('mfaScreen.resendError'));
        setMfaUserId(userId);
        setMfaEmail(email.trim());
        setPhase('mfa_required');
        return;
      }

      const payload = mfaResponse.data || {};
      if (payload.skipped && payload.expires_at) {
        // Login direto (24h válida).
        markMfaVerified(payload.expires_at);
        try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* ignore */ }
        toast.success(t('auth.loginSuccess'));
        setPhase('finalizing');
        return;
      }

      if (!payload.success) {
        logger.error('send-mfa-code retornou erro controlado', {
          module: 'Auth',
          error: String(payload.error || 'desconhecido'),
        });
        toast.error(String(payload.error || t('mfaScreen.resendError')));
      }

      setMfaUserId(userId);
      setMfaEmail(email.trim());
      setPhase('mfa_required');
    } catch (error: any) {
      try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* ignore */ }
      logger.warn('Login failed', { module: 'Auth', action: 'login', details: error?.message });
      toast.error(getErrorMessage(error));
      setPhase('idle');
    }
  };

  const handleMFAVerified = async (expiresAt?: string) => {
    setPhase('finalizing');
    markMfaVerified(expiresAt);
    try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* ignore */ }
    toast.success(t('auth.loginSuccess'));
  };

  const handleMFACancel = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    try { sessionStorage.removeItem(MFA_PENDING_KEY); } catch { /* ignore */ }
    setMfaUserId('');
    setMfaEmail('');
    setPassword('');
    setPhase('idle');
    toast.info(t('auth.loginCancelled'));
  };

  if (phase === 'mfa_required') {
    return (
      <MFAVerification
        userId={mfaUserId}
        email={mfaEmail}
        onVerified={handleMFAVerified}
        onCancel={handleMFACancel}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[hsl(230,25%,7%)]">
      {/* ===== BRAND PANEL (desktop only) ===== */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col justify-between sidebar-gradient overflow-hidden p-14">
        <AkurisMarkPattern opacity={0.05} />
        <div className="absolute top-1/3 -left-24 w-[420px] h-[420px] bg-[hsl(252,100%,66%,0.08)] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 landing-fade-in-1">
          <img src={logoImage} alt="Akuris" className="h-9 object-contain" />
        </div>

        <div className="relative z-10 max-w-xl space-y-10 landing-fade-in-2">
          <div className="space-y-5">
            <h1 className="text-4xl lg:text-5xl font-semibold text-white leading-[1.05] tracking-tight">
              {t('auth.platformTitle')}{' '}
              <span className="text-gradient">{t('auth.platformHighlight')}</span>
            </h1>
            <p className="text-white/55 text-base max-w-md leading-relaxed">
              {t('auth.platformDesc')}
            </p>
          </div>

          <ul className="space-y-5 landing-fade-in-3">
            {pillars.map((p, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                  <p.Icon size={18} />
                </span>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-white tracking-tight">{p.title}</p>
                  <p className="text-xs text-white/45 mt-0.5">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 landing-fade-in-4">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
          <p className="text-white/35 text-[11px] tracking-[0.18em] uppercase font-medium">
            {t('auth.complianceBadges')}
          </p>
        </div>
      </div>

      {/* ===== FORM PANEL ===== */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 lg:px-14 relative">
        <div className="absolute top-6 right-6"><LanguageSelector /></div>

        <div className="lg:hidden mb-8">
          <img src={logoImage} alt="Akuris" className="h-10 mx-auto object-contain" />
        </div>

        <div className="w-full max-w-sm space-y-7 landing-fade-in-2">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-2xl lg:text-[28px] font-semibold text-white tracking-tight">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-sm text-white/55">{t('auth.signInToContinue')}</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-white/65 font-medium tracking-wide">
                {t('auth.emailLabel')}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  disabled={isBusy}
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs text-white/65 font-medium tracking-wide">
                  {t('auth.passwordLabel')}
                </Label>
                <button
                  type="button"
                  onClick={() => setForgotPasswordDialogOpen(true)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  disabled={isBusy}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                disabled={isBusy}
              />
              <Label htmlFor="remember" className="text-xs text-white/55 cursor-pointer">
                {t('auth.rememberEmail')}
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)] hover:shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.6)] transition-all"
              disabled={isBusy}
            >
              {isBusy ? (
                <><AkurisPulse size={16} className="mr-2" />{t('auth.signingIn')}</>
              ) : (
                <>{t('auth.signIn')} <ArrowRight className="w-4 h-4 ml-1.5" /></>
              )}
            </Button>
          </form>

          <div className="text-center text-xs text-white/45">
            {t('auth.noAccount')}{' '}
            <Link to="/registro" className="text-primary hover:text-primary/80 transition-colors">
              {t('auth.createAccount')}
            </Link>
          </div>
        </div>

        <div className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-white/25">
          © {new Date().getFullYear()} Akuris
        </div>
      </div>

      <ForgotPasswordDialog
        open={forgotPasswordDialogOpen}
        onOpenChange={setForgotPasswordDialogOpen}
      />
    </div>
  );
};

export default Auth;
