import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Mail, RefreshCw, Lock, ArrowLeft } from 'lucide-react';
import logoImage from '@/assets/akuris-logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AkurisMarkPattern } from '@/components/identity/AkurisMarkPattern';
import { CornerAccent } from '@/components/identity/CornerAccent';

interface MFAVerificationProps {
  userId: string;
  email: string;
  onVerified: (expiresAt?: string) => void;
  onCancel: () => void;
}

/**
 * Símbolo Akuris (mesmo path do AkurisPulse) — usado como identidade
 * visual no topo do card MFA, substituindo ícones genéricos do Lucide.
 */
const AKURIS_PATH =
  'M43.7,13.1 L72.3,66.9 Q76,74 68,74 L61,74 Q56,74 53.4,69.7 L42.6,52.3 Q40,48 37.4,52.3 L26.6,69.7 Q24,74 19,74 L12,74 Q4,74 7.7,66.9 L36.3,13.1 Q40,6 43.7,13.1 Z';

const AkurisMark = ({ size = 28 }: { size?: number }) => (
  <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
    <path d={AKURIS_PATH} fill="currentColor" />
  </svg>
);

export const MFAVerification: React.FC<MFAVerificationProps> = ({
  userId,
  email,
  onVerified,
  onCancel,
}) => {
  const { t } = useLanguage();
  const { markMfaVerified } = useAuth();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error(t('mfaScreen.enterFullCode'));
      return;
    }

    setIsVerifying(true);
    try {
      const response = await supabase.functions.invoke('verify-mfa-code', {
        body: { code },
      });

      if (response.error) throw response.error;

      const data = response.data;
      if (data.success) {
        // Marca a sessão MFA como válida no AuthProvider (cache local + libera flag).
        markMfaVerified(data.expires_at);
        onVerified(data.expires_at);
      } else {
        toast.error(data.error || t('mfaScreen.invalidCode'));
        setCode('');
      }
    } catch (error: any) {
      toast.error(t('mfaScreen.verifyError'));
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const response = await supabase.functions.invoke('send-mfa-code', {
        body: { force: true },
      });

      if (response.error) throw response.error;

      const data = response.data;
      if (data.success) {
        toast.success(t('mfaScreen.newCodeSent'));
        setCountdown(60);
        setCanResend(false);
        setCode('');
      } else {
        toast.error(data.error || t('mfaScreen.resendError'));
      }
    } catch (error: any) {
      toast.error(t('mfaScreen.resendError'));
    } finally {
      setIsResending(false);
    }
  };

  // Auto-submit quando 6 dígitos
  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[hsl(230,25%,7%)] to-[hsl(228,20%,9%)] px-6 py-12 relative overflow-hidden">
      <AkurisMarkPattern opacity={0.04} />
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-8">
        <div className="text-center landing-fade-in-1">
          <img src={logoImage} alt="Akuris" className="h-12 mx-auto object-contain" />
        </div>

        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-8 space-y-7 landing-fade-in-2 overflow-hidden">
          <CornerAccent />

          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <AkurisMark size={28} />
            </div>
            <div className="space-y-2">
              <span className="block text-primary/70 text-[10px] tracking-[0.22em] font-medium uppercase">
                {t('mfaScreen.eyebrow')}
              </span>
              <h2 className="text-2xl font-semibold text-white tracking-tight">
                {t('mfaScreen.heading')}
              </h2>
              <p className="text-sm text-white/50">{t('mfaScreen.description')}</p>
            </div>

            <div className="flex justify-center pt-1">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02]">
                <Mail className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-xs text-white/80 font-medium tracking-wide">{maskedEmail}</span>
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => setCode(value)}
              disabled={isVerifying}
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="contents">
                    {index === 3 && (
                      <span className="self-center w-2 h-px bg-white/15" aria-hidden="true" />
                    )}
                    <InputOTPSlot
                      index={index}
                      className="w-11 h-14 text-lg font-semibold bg-[hsl(230,25%,9%)] border-white/[0.10] text-white rounded-lg transition-all data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/20"
                    />
                  </div>
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerify}
            className="w-full h-12 font-semibold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.5)] hover:shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.6)] transition-all rounded-lg"
            disabled={isVerifying || code.length !== 6}
          >
            {isVerifying ? (
              <><AkurisPulse size={16} className="mr-2" />{t('mfaScreen.verifying')}</>
            ) : (
              t('mfaScreen.verify')
            )}
          </Button>

          {/* Selo de segurança */}
          <div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mb-3" />
            <p className="flex items-center justify-center gap-1.5 text-white/35 text-[11px]">
              <Lock className="w-3 h-3" />
              {t('mfaScreen.securityFootnote')}
            </p>
          </div>

          <div className="text-center space-y-3">
            <button
              onClick={handleResend}
              disabled={!canResend || isResending}
              className="text-sm text-primary hover:text-primary/80 disabled:text-white/30 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
            >
              {isResending ? (
                <><AkurisPulse size={12} /> {t('mfaScreen.resending')}</>
              ) : canResend ? (
                <><RefreshCw className="w-3 h-3" /> {t('mfaScreen.resendCode')}</>
              ) : (
                <>{t('mfaScreen.resendIn', { seconds: String(countdown) })}</>
              )}
            </button>

            <button
              onClick={onCancel}
              className="block w-full text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3 h-3" />
                {t('mfaScreen.backToLogin')}
              </span>
            </button>
          </div>
        </div>

        <p className="text-white/20 text-xs text-center">© {new Date().getFullYear()} Akuris — {t('mfaScreen.allRightsReserved')}</p>
      </div>
    </div>
  );
};
