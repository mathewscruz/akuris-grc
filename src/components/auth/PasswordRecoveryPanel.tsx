import { useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconArrowLeft, IconMail, IconSuccess } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface PasswordRecoveryPanelProps {
  initialEmail?: string;
  onBack: () => void;
}

const functionStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) return context.status;
  return undefined;
};

export function PasswordRecoveryPanel({ initialEmail = '', onBack }: PasswordRecoveryPanelProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [requestError, setRequestError] = useState('');
  const emailSchema = useMemo(
    () => z.string().min(1, t('forgotPassword.validationEmailRequired')).email(t('forgotPassword.validationEmailInvalid')),
    [t],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError('');
    setRequestError('');

    const normalizedEmail = email.trim().toLowerCase();
    const validation = emailSchema.safeParse(normalizedEmail);
    if (!validation.success) {
      setFieldError(validation.error.errors[0].message);
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: normalizedEmail },
      });

      if (error) {
        const status = functionStatus(error);
        logger.warn('Recuperação de senha indisponível', {
          module: 'Auth',
          action: 'password-reset',
          status,
        });
        setRequestError(status === 429
          ? t('forgotPassword.rateLimited')
          : t('forgotPassword.unavailable'));
        return;
      }

      if (data?.success !== true) {
        setRequestError(t('forgotPassword.unavailable'));
        return;
      }

      setSentTo(normalizedEmail);
    } catch (error) {
      logger.warn('Falha inesperada na recuperação de senha', {
        module: 'Auth',
        action: 'password-reset',
        error: error instanceof Error ? error.message : String(error),
      });
      setRequestError(t('forgotPassword.unavailable'));
    } finally {
      setIsLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-8" aria-live="polite">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-success">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-success/25 bg-success/10">
              <IconSuccess className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.16em]">{t('forgotPassword.sentEyebrow')}</span>
          </div>
          <h1 className="text-[1.75rem] font-medium tracking-[-0.02em]">{t('forgotPassword.sentTitle')}</h1>
          <p className="text-sm leading-6 text-white/70">{t('forgotPassword.successMessage')}</p>
        </div>

        <div className="border-y border-white/[0.08] py-4">
          <p className="text-xs text-white/70">{t('forgotPassword.sentTo')}</p>
          <p className="mt-1 break-all text-sm font-medium text-white/80">{sentTo}</p>
        </div>

        <div className="space-y-3">
          <Button type="button" onClick={onBack} className="h-11 w-full rounded-md font-medium">
            {t('forgotPassword.backToLogin')}
          </Button>
          <button
            type="button"
            onClick={() => {
              setSentTo('');
              setRequestError('');
            }}
            className="flex min-h-11 w-full items-center justify-center text-xs text-white/70 transition-colors hover:text-white/75"
          >
            {t('forgotPassword.useAnotherEmail')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/25 bg-primary/10">
            <IconMail className="h-4 w-4" />
          </span>
          <span className="text-xs font-medium uppercase tracking-[0.16em]">{t('forgotPassword.eyebrow')}</span>
        </div>
        <h1 className="text-[1.75rem] font-medium tracking-[-0.02em]">{t('forgotPassword.title')}</h1>
        <p className="text-sm leading-6 text-white/70">{t('forgotPassword.description')}</p>
      </div>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="recovery-email" className="text-sm font-medium text-white/85">
            {t('forgotPassword.email')}
          </Label>
          <Input
            ref={inputRef}
            id="recovery-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            placeholder={t('forgotPassword.emailPlaceholder')}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError('');
              setRequestError('');
            }}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? 'recovery-email-error' : undefined}
            className="h-11 rounded-md border-white/[0.09] bg-white/[0.03] text-white placeholder:text-white/60 focus:border-primary/60 focus:ring-1 focus:ring-primary/25"
            disabled={isLoading}
          />
          {fieldError && <p id="recovery-email-error" role="alert" className="text-xs text-destructive">{fieldError}</p>}
        </div>

        {requestError && (
          <p role="alert" aria-live="assertive" className="border-l-2 border-destructive pl-3 text-sm leading-5 text-destructive">
            {requestError}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-md font-medium">
          {isLoading ? <><AkurisPulse size={16} className="mr-2" />{t('forgotPassword.sending')}</> : t('forgotPassword.send')}
        </Button>

        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="flex min-h-11 w-full items-center justify-center gap-2 text-xs text-white/70 transition-colors hover:text-white/75 disabled:opacity-50"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          {t('forgotPassword.backToLogin')}
        </button>
      </form>
    </div>
  );
}
