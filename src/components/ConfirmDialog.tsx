import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  loading?: boolean;
  /** Ícone opcional; por padrão AlertTriangle (destrutivo) ou HelpCircle (default). */
  icon?: React.ReactNode;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  loading = false,
  icon,
}) => {
  const { t } = useLanguage();
  const isDestructive = variant === 'destructive';
  const iconNode = icon ?? (isDestructive ? <AlertTriangle strokeWidth={1.5} /> : <HelpCircle strokeWidth={1.5} />);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5',
                isDestructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
              )}
            >
              {iconNode}
            </span>
            <div className="min-w-0 space-y-1.5 pt-0.5 text-left">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText || t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={isDestructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {loading && <AkurisPulse size={16} className="mr-2" />}
            {confirmText || t('common.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDialog;
