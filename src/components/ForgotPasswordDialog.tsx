import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { IconMail } from '@/components/icons';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const { t } = useLanguage();

  const emailSchema = z.string().min(1, t('forgotPassword.validationEmailRequired')).email(t('forgotPassword.validationEmailInvalid'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    
    const validation = emailSchema.safeParse(email.trim());
    if (!validation.success) {
      setEmailError(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    try {
      logger.info('Iniciando processo de recuperação de senha', { email: email.trim(), module: 'Auth', action: 'password-reset' });
      
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: email.trim() }
      });

      if (error) {
        logger.error('Erro ao invocar send-password-reset', { 
          email: email.trim(), error: error.message, module: 'Auth', action: 'password-reset' 
        });
      } else {
        logger.info('Reset de senha processado', { 
          email: email.trim(), module: 'Auth', action: 'password-reset' 
        });
      }

      toast.success(t('forgotPassword.successMessage'), { duration: 8000 });
      setEmail('');
      onOpenChange(false);
    } catch (error: any) {
      logger.error('Erro no processo de recuperação de senha', { 
        error: error.message, module: 'Auth', action: 'password-reset' 
      });
      toast.success(t('forgotPassword.successMessage'));
      setEmail('');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconMail className="h-5 w-5" />
            {t('forgotPassword.title')}
          </DialogTitle>
          <DialogDescription>
            {t('forgotPassword.description')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">{t('forgotPassword.email')}</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder={t('forgotPassword.emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              autoFocus
              className={emailError ? 'border-destructive' : ''}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              {t('forgotPassword.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? t('forgotPassword.sending') : t('forgotPassword.send')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
