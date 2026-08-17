import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { IosInstallDialog } from '@/components/pwa/InstallAppPrompt';
import { toast } from 'sonner';

/**
 * Permite instalar o Akuris (atalho no ecrã inicial) a partir das Configurações,
 * mesmo depois de o utilizador ter dispensado a faixa em telemóvel.
 */
export function InstalarAppCard() {
  const { t } = useLanguage();
  const { installed, canPromptNative, promptInstall, resetDismiss } = usePwaInstall();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleClick = async () => {
    resetDismiss();
    if (canPromptNative) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        toast.success(t('pwa.installed'));
        return;
      }
      if (outcome === 'dismissed') return;
    }
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" strokeWidth={1.5} />
          {t('pwa.settingsTitle')}
        </CardTitle>
        <CardDescription>{t('pwa.settingsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {installed ? t('pwa.alreadyInstalled') : t('pwa.bannerDescription')}
          </p>
          <Button variant="outline" onClick={handleClick} disabled={installed}>
            <Smartphone className="mr-2 h-4 w-4" strokeWidth={1.5} />
            {t('pwa.settingsButton')}
          </Button>
        </div>
      </CardContent>

      <IosInstallDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
