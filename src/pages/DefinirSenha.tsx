import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import logoImage from '@/assets/akuris-logo.png';
import { z } from 'zod';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
const buildPasswordSchema = (t: (k: string) => string) => z.object({
  password: z.string()
    .min(8, t('defineSenhaPage.reqMinChars'))
    .regex(/[A-Z]/, t('defineSenhaPage.reqUppercase'))
    .regex(/[a-z]/, t('defineSenhaPage.reqLowercase'))
    .regex(/[0-9]/, t('defineSenhaPage.reqNumber')),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: t('passwordChange.passwordsDontMatch'),
  path: ['confirmPassword'],
});

const DefinirSenha = () => {
  const { t } = useLanguage();
  const passwordSchema = useMemo(() => buildPasswordSchema(t), [t]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // O Supabase redireciona com um hash fragment contendo access_token
        // ou com query params token_hash e type
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        const tokenHash = searchParams.get('token_hash');

        if (accessToken && refreshToken) {
          // Token já processado pelo Supabase, sessão ativa
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            logger.error('Erro ao definir sessão', { error: error.message, module: 'auth' });
            setIsTokenValid(false);
          } else {
            setIsTokenValid(true);
          }
        } else if (tokenHash && type) {
          // Verificar token via OTP
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });

          if (error) {
            logger.error('Erro ao verificar token', { error: error.message, module: 'auth' });
            setIsTokenValid(false);
          } else {
            setIsTokenValid(true);
          }
        } else {
          // Verificar se já existe sessão ativa (caso de redirect)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setIsTokenValid(true);
          } else {
            setIsTokenValid(false);
          }
        }
      } catch (e) {
        logger.error('Erro na verificação do token', { error: (e as Error)?.message, module: 'auth' });
        setIsTokenValid(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const fieldErrors: typeof errors = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'password') fieldErrors.password = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      // Limpar flag de senha temporária se existir
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('temporary_passwords')
          .update({ is_temporary: false, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
      }

      setSuccess(true);
      toast.success(t('defineSenhaPage.success'));

      // Fazer signOut e redirecionar para login
      await supabase.auth.signOut();
      setTimeout(() => navigate('/auth'), 2000);
    } catch (error: any) {
      toast.error(error.message || t('passwordChange.error'));
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(216,60%,8%)] via-[hsl(216,45%,12%)] to-[hsl(216,60%,8%)]">
        <div className="text-center">
          <AkurisPulse size={48} className="text-primary mx-auto" />
          <p className="mt-4 text-white/60">{t('defineSenhaPage.verifying')}</p>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(216,60%,8%)] via-[hsl(216,45%,12%)] to-[hsl(216,60%,8%)] px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <img src={logoImage} alt="Akuris" className="h-16 mx-auto" />
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold text-white">{t('defineSenhaPage.invalidLinkTitle')}</h2>
            <p className="text-white/50 text-sm">
              {t('defineSenhaPage.invalidLinkDesc')}
            </p>
            <Button onClick={() => navigate('/auth')} variant="gradient" className="w-full">
              {t('defineSenhaPage.goToLogin')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(216,60%,8%)] via-[hsl(216,45%,12%)] to-[hsl(216,60%,8%)] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <img src={logoImage} alt="Akuris" className="h-16 mx-auto" />
          <p className="text-white/40 text-xs mt-2">Governança, Risco e Compliance</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-8 space-y-6">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">{t('defineSenhaPage.successTitle')}</h2>
              <p className="text-white/50 text-sm">{t('defineSenhaPage.successDesc')}</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-white">{t('defineSenhaPage.title')}</h2>
                <p className="text-sm text-white/50">{t('defineSenhaPage.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">{t('defineSenhaPage.newPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                      placeholder={t('defineSenhaPage.newPasswordPlaceholder')}
                      className={`h-11 pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary ${errors.password ? 'border-destructive' : ''}`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">{t('defineSenhaPage.confirmPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: undefined })); }}
                      placeholder={t('defineSenhaPage.confirmPasswordPlaceholder')}
                      className={`h-11 pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary ${errors.confirmPassword ? 'border-destructive' : ''}`}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>

                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
                  <p className="text-xs text-white/40 font-medium">{t('defineSenhaPage.requirements')}</p>
                  <p className={`text-xs ${password.length >= 8 ? 'text-green-400' : 'text-white/30'}`}>✓ {t('defineSenhaPage.reqMinChars')}</p>
                  <p className={`text-xs ${/[A-Z]/.test(password) ? 'text-green-400' : 'text-white/30'}`}>✓ {t('defineSenhaPage.reqUppercase')}</p>
                  <p className={`text-xs ${/[a-z]/.test(password) ? 'text-green-400' : 'text-white/30'}`}>✓ {t('defineSenhaPage.reqLowercase')}</p>
                  <p className={`text-xs ${/[0-9]/.test(password) ? 'text-green-400' : 'text-white/30'}`}>✓ {t('defineSenhaPage.reqNumber')}</p>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-11 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? <><AkurisPulse size={16} className="mr-2" />{t('defineSenhaPage.saving')}</> : t('defineSenhaPage.submit')}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-white/20 text-xs text-center">© {new Date().getFullYear()} Akuris — {t('mfaScreen.allRightsReserved')}</p>
      </div>
    </div>
  );
};

export default DefinirSenha;
