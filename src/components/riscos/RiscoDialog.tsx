import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { RiscoFormWizard } from './RiscoFormWizard';
import { useLanguage } from '@/contexts/LanguageContext';

interface RiscoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risco?: any;
  onSuccess: () => void;
}

export function RiscoDialog({ open, onOpenChange, risco, onSuccess }: RiscoDialogProps) {
  const { t } = useLanguage();
  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-6xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t('riscosDetalhe.dialog.headerEyebrow')}
              </span>
              <span className="text-base font-semibold leading-tight">{risco ? t('riscosDetalhe.dialog.titleEdit') : t('riscosDetalhe.dialog.titleNew')}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="pl-12">
            {risco
              ? t('riscosDetalhe.dialog.descEdit')
              : t('riscosDetalhe.dialog.descNew')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <RiscoFormWizard risco={risco} onSuccess={handleSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
