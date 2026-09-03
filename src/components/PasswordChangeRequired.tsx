import React, { useState, useMemo } from 'react';
import { IconClose, IconView, IconCheck, IconWarning, IconHide } from '@/components/icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { Progress } from '@/components/ui/progress';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { exigirEscrita } from '@/lib/supabase-write';
import { REGRAS_SENHA, avaliarSenha, primeiraFalha, senhaValida } from '@/lib/politica-senha';

interface PasswordChangeRequiredProps {
  open: boolean;
  onPasswordChanged: () => void;
}

// Função para calcular força da senha
const calculatePasswordStrength = (password: string, t: (k: string) => string): { score: number; label: string; color: string } => {
  let score = 0;
  
  if (password.length >= 6) score += 20;
  if (password.length >= 8) score += 20;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score <= 20) return { score, label: t('passwordChange.strengthVeryWeak'), color: 'bg-destructive' };
  if (score <= 40) return { score, label: t('passwordChange.strengthWeak'), color: 'bg-warning' };
  if (score <= 60) return { score, label: t('passwordChange.strengthFair'), color: 'bg-warning' };
  if (score <= 80) return { score, label: t('passwordChange.strengthGood'), color: 'bg-info' };
  return { score, label: t('passwordChange.strengthStrong'), color: 'bg-success' };
};

const PasswordChangeRequired: React.FC<PasswordChangeRequiredProps> = ({ open, onPasswordChanged }) => {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cálculo de força da senha
  const passwordStrength = useMemo(() => calculatePasswordStrength(newPassword, t), [newPassword, t]);

  // Requisitos da senha. As quatro primeiras vêm da política única do produto
  // (`lib/politica-senha`): este ecrã pedia só 6 caracteres, enquanto a
  // redefinição por link pedia 8 com maiúscula, minúscula e número — mesma
  // senha, mesma conta, duas exigências diferentes conforme o caminho.
  const daPolitica = useMemo(() => avaliarSenha(newPassword), [newPassword]);
  const requirements = useMemo(() => ({
    ...daPolitica,
    differentFromCurrent: newPassword !== currentPassword && currentPassword.length > 0,
    passwordsMatch: newPassword === confirmPassword && confirmPassword.length > 0,
  }), [daPolitica, newPassword, confirmPassword, currentPassword]);

  const allRequirementsMet =
    senhaValida(newPassword) && requirements.differentFromCurrent && requirements.passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('passwordChange.fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('passwordChange.passwordsDontMatch'));
      return;
    }

    const falha = primeiraFalha(newPassword, t);
    if (falha) {
      toast.error(falha);
      return;
    }

    if (newPassword === currentPassword) {
      toast.error(t('passwordChange.mustBeDifferent'));
      return;
    }

    try {
      setLoading(true);

      // Validar senha atual via re-autenticação
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) throw new Error('Não foi possível obter o email do usuário');

      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (reAuthError) {
        toast.error(t('passwordChange.incorrectCurrent'));
        return;
      }

      // Atualizar senha no Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Atualizar status da senha temporária
      const user = await supabase.auth.getUser();
      if (user.data.user) {
        await exigirEscrita(supabase
          .from('temporary_passwords')
          .update({ is_temporary: false })
          .eq('user_id', user.data.user.id));
      }

      toast.success(t('passwordChange.success'));
      onPasswordChanged();
    } catch (error: any) {
      logger.error('Erro ao alterar senha', { module: 'Auth', action: 'change-password' });
      toast.error(error.message || t('passwordChange.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <IconWarning className="mx-auto mb-4 h-7 w-7 text-warning" />
          <DialogTitle className="text-xl">{t('passwordChange.title')}</DialogTitle>
          <DialogDescription>
            {t('passwordChange.description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <Alert>
            <IconWarning className="h-4 w-4" />
            <AlertDescription>
              {t('passwordChange.alertMessage')}
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('passwordChange.currentPassword')}</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('passwordChange.currentPasswordPlaceholder')}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <IconHide className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconView className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('passwordChange.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('passwordChange.newPasswordPlaceholder')}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <IconHide className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconView className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              
              {/* Indicador de força da senha */}
              {newPassword.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Progress value={passwordStrength.score} className="h-2 flex-1" />
                    <span className={`text-xs font-medium ${
                      passwordStrength.score <= 40 ? 'text-destructive' :
                      passwordStrength.score <= 60 ? 'text-warning' :
                      passwordStrength.score <= 80 ? 'text-info' : 'text-success'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('passwordChange.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('passwordChange.confirmPasswordPlaceholder')}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <IconHide className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconView className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Lista de requisitos */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t('passwordChange.requirements')}</p>
              <ul className="space-y-1">
                {REGRAS_SENHA.map((regra) => (
                  <li key={regra.chave} className="flex items-center gap-2 text-sm">
                    {daPolitica[regra.chave] ? (
                      <IconCheck className="h-4 w-4 text-success" />
                    ) : (
                      <IconClose className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={daPolitica[regra.chave] ? 'text-success' : 'text-muted-foreground'}>
                      {t(`politicaSenha.${regra.chave}`)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-sm">
                  {requirements.differentFromCurrent ? (
                    <IconCheck className="h-4 w-4 text-success" />
                  ) : (
                    <IconClose className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={requirements.differentFromCurrent ? 'text-success' : 'text-muted-foreground'}>
                    {t('passwordChange.reqDifferent')}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {requirements.passwordsMatch ? (
                    <IconCheck className="h-4 w-4 text-success" />
                  ) : (
                    <IconClose className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={requirements.passwordsMatch ? 'text-success' : 'text-muted-foreground'}>
                    {t('passwordChange.reqMatch')}
                  </span>
                </li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !allRequirementsMet}
            >
              {loading ? t('passwordChange.saving') : t('passwordChange.save')}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordChangeRequired;
