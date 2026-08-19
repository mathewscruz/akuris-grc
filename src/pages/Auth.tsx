import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, MFA_PENDING_KEY } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import logoImage from '@/assets/akuris-logo.png';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { LanguageSelector } from '@/components/LanguageSelector';
import { MFAVerification } from '@/components/MFAVerification';
import { useLanguage } from '@/contexts/LanguageContext';
import { z } from 'zod';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { AuthProductPreview } from '@/components/auth/AuthProductPreview';
import { AkurisMarkPattern } from '@/components/identity/AkurisMarkPattern';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { RiscosIcon, ControlesIcon, GapAnalysisIcon, IconView, IconHide, IconMail, IconLock, IconArrowRight, IconArrowLeft } from '@/components/icons';

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
      {/*
        Painel de marca.
        --------------------------------------------------------------------
        Tinha seis blocos empilhados e três camadas de decoração ambiente: um
        gradiente roxo dentro do título, um halo de 420px desfocado a 120px, o
        padrão da marca por baixo, um fio com gradiente a esbater nas pontas e
        quatro tempos de entrada escalonada. Cada um desses é um marcador do
        que se produz em série — e juntos deixam de ser identidade para serem
        maneirismo.

        O que sobra: a marca, uma frase, três competências e o fio. A cor da
        casa continua a ser a mesma; só deixa de ser usada como enfeite dentro
        da tipografia, que é onde ela mais denuncia. O gradiente do fundo fica,
        porque é profundidade e não ornamento.
      */}
      {/*
        Painel de marca — mostra o PRODUTO, não palavras sobre ele.
        --------------------------------------------------------------------
        Antes eram três competências escritas ("Riscos", "Controles", "Gap
        Analysis"). Quem chega a um login de GRC já sabe o que é GRC; o que
        ainda não viu é como o trabalho fica quando está feito.

        O cartão é desenhado com o próprio sistema do produto — mesma
        tipografia, mesma escala de severidade, mesmo fio de 1px — e não um
        screenshot, portanto não envelhece em relação à aplicação.
      */}
      <div className="hidden lg:flex lg:w-[54%] relative flex-col justify-between sidebar-gradient overflow-hidden p-14">
        <AkurisMarkPattern opacity={0.03} />

        <div className="relative z-10 auth-entra">
          <img src={logoImage} alt="Akuris" className="h-9 object-contain" />
        </div>

        <div className="relative z-10 auth-entra">
          {/* Sem o subtítulo a explicar o que é GRC a quem trabalha com GRC.
              A segunda linha fica a meio tom: separa as duas partes da frase
              sem gradiente e sem outra cor. */}
          <h1 className="max-w-[14ch] text-[3.25rem] font-medium leading-[1.05] tracking-[-0.03em] text-white">
            {t('auth.platformTitle')}{' '}
            <span className="text-white/45">{t('auth.platformHighlight')}</span>
          </h1>

          {/* O cartão sangra para fora do painel: sugere que há mais produto
              do lado de lá do que cabe aqui. Sem isto ficavam 568px de deserto
              à direita — o cartão parecia uma nota de rodapé do título, e não
              o assunto. */}
          <div className="mt-12 ml-20 -mr-[13rem]">
            <AuthProductPreview />
          </div>
        </div>

        <div className="relative z-10 auth-entra">
          <p className="text-[0.6875rem] text-white/25">{t('auth.previewNote')}</p>
        </div>
      </div>

      {/* ===== FORM PANEL ===== */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 lg:px-14 relative">
        <div className="absolute top-6 right-6"><LanguageSelector /></div>

        <div className="lg:hidden mb-8">
          <img src={logoImage} alt="Akuris" className="h-10 mx-auto object-contain" />
        </div>

        <div className="w-full max-w-sm space-y-8 auth-entra">
          <div className="space-y-1.5 text-center lg:text-left">
            {/* "Bem-vindo de volta" era a saudação de um produto de consumo. O
                utilizador aqui é um profissional de compliance a entrar na
                ferramenta de trabalho: o título diz o que a página faz. */}
            <h1 className="text-[1.75rem] font-medium text-white tracking-[-0.02em]">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-sm text-white/45">{t('auth.signInToContinue')}</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-white/65 font-medium tracking-wide">
                {t('auth.emailLabel')}
              </Label>
              {/* Sem ícone dentro do campo: um envelope ao lado de uma
                  etiqueta que já diz "E-mail" não acrescenta nada e empurra o
                  texto do utilizador 10px para dentro. */}
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-white/[0.03] border-white/[0.09] text-white placeholder:text-white/25 rounded-md focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
                disabled={isBusy}
                autoComplete="email"
              />
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
                  className="flex min-h-[44px] items-center px-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                {/* O cadeado sai; o olho fica, porque tem função. */}
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12 h-11 bg-white/[0.03] border-white/[0.09] text-white placeholder:text-white/25 rounded-md focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
                  disabled={isBusy}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/40 hover:text-white/70"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <IconHide className="w-5 h-5" /> : <IconView className="w-5 h-5" />}
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
              /* Sem a sombra roxa projectada: um halo de 24px por baixo do
                 botão é brilho, não elevação — e num ecrã escuro lê-se como
                 néon. O botão já é o único elemento com a cor da casa. */
              className="w-full h-11 font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-ui"
              disabled={isBusy}
            >
              {isBusy ? (
                <><AkurisPulse size={16} className="mr-2" />{t('auth.signingIn')}</>
              ) : (
                /* A seta não leva a lado nenhum que o utilizador não saiba:
                   é o botão de submeter de um formulário de duas linhas. */
                <>{t('auth.signIn')}</>
              )}
            </Button>
          </form>

        </div>

        <div className="absolute bottom-6 left-0 right-0 text-center text-micro text-white/25">
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
