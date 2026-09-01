import React from 'react';
import { IconAdd, IconClose, IconPhone, IconShare } from '@/components/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

/**
 * Diálogo com as instruções manuais (iOS/Safari não expõe evento de instalação).
 */
export const IosInstallDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const { t } = useLanguage();
  const { isIos } = usePwaInstall();

  const steps = isIos
    ? [t('pwa.iosStep1'), t('pwa.iosStep2'), t('pwa.iosStep3')]
    : [t('pwa.manualHint')];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconShare className="h-5 w-5" strokeWidth={1.5} />
            {isIos ? t('pwa.iosTitle') : t('pwa.manualTitle')}
          </DialogTitle>
          <DialogDescription>{t('pwa.settingsDescription')}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>
            <IconAdd className="mr-2 h-4 w-4" strokeWidth={1.5} />
            {t('pwa.iosUnderstood')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Faixa discreta em telemóvel a convidar o utilizador a criar o atalho.
 * Não aparece dentro de iframe (preview do editor) nem se já estiver instalado.
 */
export const InstallAppPrompt: React.FC = () => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { canInstall, canPromptNative, dismissed, inIframe, isIos, promptInstall, dismiss } = usePwaInstall();
  const [iosOpen, setIosOpen] = React.useState(false);

  const visible = isMobile && !inIframe && canInstall && !dismissed;

  const handleInstall = async () => {
    if (canPromptNative) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        toast.success(t('pwa.installed'));
        return;
      }
      if (outcome === 'dismissed') {
        dismiss();
        return;
      }
    }
    setIosOpen(true);
  };

  if (!visible) {
    return <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />;
  }

  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 md:hidden">
        <div className="relative flex gap-3 overflow-hidden rounded-lg border border-border bg-card p-3 shadow-lg dark:shadow-none">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" aria-hidden />
          <div className="ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center text-primary">
            <IconPhone className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {t('pwa.eyebrow')}
            </p>
            <p className="text-sm font-semibold text-foreground">{t('pwa.bannerTitle')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('pwa.bannerDescription')}</p>
            <div className="mt-2 flex items-center gap-3">
              <Button size="sm" onClick={handleInstall}>
                {isIos && !canPromptNative ? t('pwa.iosTitle') : t('pwa.install')}
              </Button>
              <button
                type="button"
                onClick={dismiss}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {t('pwa.later')}
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('pwa.close')}
            onClick={dismiss}
            className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <IconClose className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
};

