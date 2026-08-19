import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { IconWarning, IconMail, IconPhone } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';

interface CreditsExhaustedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string;
  creditsLimit?: number;
}

export function CreditsExhaustedDialog({ 
  open, 
  onOpenChange,
  planName,
  creditsLimit = 0
}: CreditsExhaustedDialogProps) {
  const { t } = useLanguage();
  const resolvedPlan = planName || t('creditsExhausted.currentPlan');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <IconWarning className="h-6 w-6 shrink-0 text-warning" />
            <AlertDialogTitle className="text-xl">
              {t('creditsExhausted.title')}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3 pt-2">
            <p className="text-base">
              {t('creditsExhausted.description', { limit: String(creditsLimit), plan: resolvedPlan })}
            </p>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium text-foreground">
                {t('creditsExhausted.toContinue')}
              </p>
              <ul className="space-y-1.5 text-sm">
                <li>• {t('creditsExhausted.contactItem')}</li>
                <li>• {t('creditsExhausted.upgradeItem')}</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <IconMail className="h-4 w-4 text-muted-foreground" />
                <a href="mailto:contato@akuris.com.br" className="text-primary hover:underline">
                  contato@akuris.com.br
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <IconPhone className="h-4 w-4 text-muted-foreground" />
                <a href="tel:+5511999999999" className="text-primary hover:underline">
                  (11) 99999-9999
                </a>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            {t('creditsExhausted.understood')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
