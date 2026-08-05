import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Save, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWizardShortcuts } from '@/hooks/useWizardShortcuts';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useLanguage } from '@/contexts/LanguageContext';

export type DialogShellSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Renderiza a descrição apenas para leitores de tela (mantém o header compacto) */
  descriptionSrOnly?: boolean;
  icon?: LucideIcon;
  /** Main content; will be wrapped in a ScrollArea */
  children: ReactNode;
  /** Optional custom footer (replaces default Cancel/Save) */
  footer?: ReactNode;
  /** Default footer: Save handler */
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  /** Whether form is dirty (drives unsaved changes guard) */
  isDirty?: boolean;
  /** Width preset */
  size?: DialogShellSize;
  /** Disable Ctrl+S shortcut (e.g. read-only dialogs) */
  disableShortcuts?: boolean;
  /** Extra class on DialogContent */
  className?: string;
  /** If true, removes default ScrollArea (caller handles scroll) */
  noScroll?: boolean;
  /** Hide the default footer entirely (e.g. read-only) */
  hideFooter?: boolean;
}

/**
 * Descrição acessível de reserva (AKURIS QA-002).
 * O Radix exige que todo `DialogContent` tenha `DialogDescription` ou
 * `aria-describedby`; sem isso emite
 * "Missing `Description` or `aria-describedby={undefined}` for {DialogContent}"
 * e o leitor de tela anuncia o diálogo sem contexto. Consumidores que não
 * informam `description` recebem este texto de forma visualmente oculta.
 */
function fallbackDialogDescription(title: string): string {
  return `Janela de diálogo ${title}.`;
}

const SIZE_CLASSES: Record<DialogShellSize, string> = {
  sm: 'sm:max-w-lg',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
  '2xl': 'sm:max-w-7xl',
};

/**
 * Lightweight standardized dialog shell for forms and views without tabs.
 * Provides:
 *  - Branded header with icon
 *  - Scrollable body
 *  - Sticky footer (default Cancel + Save)
 *  - Ctrl+S shortcut to save
 *  - Unsaved changes guard with confirm
 */
export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  descriptionSrOnly = false,
  icon: Icon,
  children,
  footer,
  onSubmit,
  submitLabel,
  cancelLabel,
  isSubmitting = false,
  submitDisabled = false,
  isDirty = false,
  size = 'lg',
  disableShortcuts = false,
  className,
  noScroll = false,
  hideFooter = false,
}: DialogShellProps) {
  const { t } = useLanguage();
  const _submitLabel = submitLabel ?? t('common.save');
  const _cancelLabel = cancelLabel ?? t('common.cancel');
  const { showConfirm, confirmCloseIfDirty, confirmDiscard, cancelDiscard } =
    useUnsavedChangesGuard({ isDirty });

  useWizardShortcuts({
    enabled: open && !disableShortcuts,
    onSave: onSubmit,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      confirmCloseIfDirty(() => onOpenChange(false));
    } else {
      onOpenChange(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            'p-0 gap-0 overflow-hidden flex flex-col',
            'max-w-full max-h-[100dvh] sm:max-h-[92vh]',
            SIZE_CLASSES[size],
            className
          )}
        >
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3 text-xl">
              {Icon && (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              {title}
            </DialogTitle>
            {/*
              Sempre exatamente uma DialogDescription: o Radix a associa ao
              DialogContent via aria-describedby, sem duplicidade/conflito.
            */}
            <DialogDescription className={cn((!description || descriptionSrOnly) && 'sr-only')}>
              {description || fallbackDialogDescription(title)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden">
            {noScroll ? (
              <div className="h-full flex flex-col min-h-0">{children}</div>
            ) : (
              <ScrollArea className="h-full">
                <div className="px-6 py-6">{children}</div>
              </ScrollArea>
            )}
          </div>

          {!hideFooter && (
            <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur-sm px-6 py-3">
              {footer ?? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                  >
                    {_cancelLabel}
                  </Button>
                  {onSubmit && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={onSubmit}
                      disabled={submitDisabled || isSubmitting}
                      className="gap-1"
                    >
                      <Save className="h-4 w-4" />
                      {isSubmitting ? t('common.saving') : _submitLabel}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={(o) => !o && cancelDiscard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.unsavedChanges')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.unsavedChangesDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDiscard}>{t('dialogs.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('dialogs.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
