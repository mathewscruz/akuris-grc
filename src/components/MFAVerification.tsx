import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { IconArrowLeft, IconRefresh, IconShieldCheck } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AuthShell } from '@/components/auth/AuthShell';
import { logger } from '@/lib/logger';

interface MFAVerificationProps {
  email: string;
  codeExpiresAt?: string;
  onVerified: (expiresAt?: string) => void;
  onCancel: () => void;
  envioFalhou?: boolean;
}

const secondsUntil = (iso?: string) => {
  if (!iso) return 5 * 60;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
};

const formatTimer = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export const MFAVerification = ({
  email,
  codeExpiresAt,
  onVerified,
  onCancel,
  envioFalhou = false,
}: MFAVerificationProps) => {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [semCodigo, setSemCodigo] = useState(envioFalhou);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendCountdown, setResendCountdown] = useState(60);
  const [expiresAt, setExpiresAt] = useState(codeExpiresAt);
  const [expiryCountdown, setExpiryCountdown] = useState(() => secondsUntil(codeExpiresAt));

  useEffect(() => setSemCodigo(envioFalhou), [envioFalhou]);
  useEffect(() => {
    if (codeExpiresAt) {
      setExpiresAt(codeExpiresAt);
      setExpiryCountdown(secondsUntil(codeExpiresAt));
    }
  }, [codeExpiresAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
      setExpiryCountdown(secondsUntil(expiresAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const maskedEmail = useMemo(() => {
    const [local = '', domain = ''] = email.split('@');
    const visible = local.slice(0, Math.min(2, local.length));
    return domain ? `${visible}${'•'.repeat(Math.max(3, local.length - visible.length))}@${domain}` : email;
  }, [email]);

  const messageForCode = useCallback((errorCode?: string, remaining?: number) => {
    if (errorCode === 'invalid_code') {
      return t('mfaScreen.invalidWithAttempts', { attempts: String(Math.max(0, remaining ?? 0)) });
    }
    if (errorCode === 'expired_code') return t('mfaScreen.expiredCode');
    if (errorCode === 'too_many_attempts') return t('mfaScreen.tooManyAttempts');
    if (errorCode === 'session_context_missing') return t('mfaScreen.sessionExpired');
    return t('mfaScreen.verifyError');
  }, [t]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || isVerifying || semCodigo || expiryCountdown <= 0) return;
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const response = await supabase.functions.invoke('verify-mfa-code', { body: { code } });
      if (response.error) throw response.error;

      if (response.data?.success === true) {
        onVerified(response.data.expires_at);
        return;
      }

      setErrorMessage(messageForCode(response.data?.error_code, response.data?.remaining_attempts));
      setCode('');
      if (response.data?.error_code === 'expired_code' || response.data?.error_code === 'too_many_attempts') {
        setExpiryCountdown(0);
      }
    } catch (error) {
      logger.warn('Não foi possível verificar o MFA', {
        module: 'Auth',
        action: 'verify-mfa',
        reason: error instanceof Error ? error.name : 'unknown',
      });
      setErrorMessage(t('mfaScreen.verifyError'));
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  }, [code, expiryCountdown, isVerifying, messageForCode, onVerified, semCodigo, t]);

  useEffect(() => {
    if (code.length === 6 && !isVerifying) void handleVerify();
  }, [code, handleVerify, isVerifying]);

  const handleResend = async () => {
    if (resendCountdown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage('');
    try {
      const response = await supabase.functions.invoke('send-mfa-code', {
        body: { force: true, context: 'session_restore' },
      });
      if (response.error) throw response.error;

      if (response.data?.success === true) {
        setSemCodigo(false);
        setCode('');
        setResendCountdown(Number(response.data.resend_after ?? 60));
        const nextExpiry = response.data.expires_at as string | undefined;
        setExpiresAt(nextExpiry);
        setExpiryCountdown(secondsUntil(nextExpiry));
        return;
      }

      if (response.data?.error_code === 'cooldown') {
        setResendCountdown(Number(response.data.retry_after ?? 60));
        setErrorMessage(t('mfaScreen.waitBeforeResend'));
      } else if (response.data?.error_code === 'rate_limited') {
        setErrorMessage(t('mfaScreen.rateLimited'));
      } else {
        setErrorMessage(t('mfaScreen.resendError'));
        setSemCodigo(true);
      }
    } catch (error) {
      logger.warn('Não foi possível reenviar o MFA', {
        module: 'Auth',
        action: 'resend-mfa',
        reason: error instanceof Error ? error.name : 'unknown',
      });
      setErrorMessage(t('mfaScreen.resendError'));
      setSemCodigo(true);
    } finally {
      setIsResending(false);
    }
  };

  const codeExpired = expiryCountdown <= 0;

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{t('mfaScreen.eyebrow')}</span>
            <span className="text-xs tabular-nums text-white/35">{t('mfaScreen.step')}</span>
          </div>
          <h1 className="text-[1.75rem] font-medium tracking-[-0.02em] text-white">{t('mfaScreen.heading')}</h1>
          <p className={semCodigo ? 'text-sm leading-6 text-warning' : 'text-sm leading-6 text-white/50'}>
            {semCodigo
              ? t('mfaScreen.envioFalhouDescricao', { email: maskedEmail })
              : t('mfaScreen.descriptionWithEmail', { email: maskedEmail })}
          </p>
        </div>

        {!semCodigo && (
          <>
            <div className="flex items-center justify-between border-y border-white/[0.08] py-3 text-xs">
              <span className="flex items-center gap-2 text-white/45">
                <IconShieldCheck className="h-4 w-4 text-primary" />
                {t('mfaScreen.codeValidity')}
              </span>
              <span className={codeExpired ? 'font-semibold tabular-nums text-destructive' : 'font-semibold tabular-nums text-white/80'}>
                {formatTimer(expiryCountdown)}
              </span>
            </div>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => {
                  if (/^\d*$/.test(value)) {
                    setCode(value);
                    setErrorMessage('');
                  }
                }}
                disabled={isVerifying || codeExpired}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={t('mfaScreen.codeInputLabel')}
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="h-14 w-11 rounded-md border-white/[0.10] bg-white/[0.025] text-lg font-semibold text-white transition-ui data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/20"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </>
        )}

        {(errorMessage || codeExpired) && (
          <p role="alert" aria-live="assertive" className="border-l-2 border-destructive pl-3 text-sm leading-5 text-destructive">
            {errorMessage || t('mfaScreen.expiredCode')}
          </p>
        )}

        <div className="space-y-3">
          {!semCodigo && (
            <Button
              onClick={handleVerify}
              className="h-11 w-full rounded-md text-sm font-medium"
              disabled={isVerifying || code.length !== 6 || codeExpired}
            >
              {isVerifying ? <><AkurisPulse size={16} className="mr-2" />{t('mfaScreen.verifying')}</> : t('mfaScreen.verify')}
            </Button>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCountdown > 0 || isResending}
            className="flex min-h-11 w-full items-center justify-center gap-2 text-xs text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:text-white/30"
          >
            {isResending
              ? <><AkurisPulse size={13} />{t('mfaScreen.resending')}</>
              : resendCountdown > 0
                ? t('mfaScreen.resendIn', { seconds: String(resendCountdown) })
                : <><IconRefresh className="h-3.5 w-3.5" />{t('mfaScreen.resendCode')}</>}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-11 w-full items-center justify-center gap-2 text-xs text-white/45 transition-colors hover:text-white/75"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            {t('mfaScreen.backToLogin')}
          </button>
        </div>
      </div>
    </AuthShell>
  );
};
