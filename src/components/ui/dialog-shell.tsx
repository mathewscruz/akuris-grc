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
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWizardShortcuts } from '@/hooks/useWizardShortcuts';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconSave } from '@/components/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type DialogShellSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Short context above the title, e.g. "Internal control · CTRL-001". */
  eyebrow?: string;
  description?: string;
  /** Renderiza a descrição apenas para leitores de tela (mantém o header compacto) */
  descriptionSrOnly?: boolean;
  icon?: LucideIcon;
  /** Main content; will be wrapped in a ScrollArea */
  children: ReactNode;
  /** Optional custom footer (replaces default Cancel/Save) */
  footer?: ReactNode;
  /** Default footer: IconSave handler */
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  /** Explain why the primary action is unavailable without forcing trial-and-error. */
  submitBlockedReason?: string;
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
  eyebrow,
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
  submitBlockedReason,
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
    // O aviso nativo do browser só faz sentido enquanto o diálogo está aberto;
    // caso contrário bloqueia recarga e navegação da aplicação inteira.
    useUnsavedChangesGuard({ isDirty, enabled: open });

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
          <DialogHeader className="flex-shrink-0 border-b border-border/70 bg-surface-1/55 px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
            <DialogTitle className="flex items-center gap-3 pr-10 text-xl">
              {Icon && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0">
                {eyebrow && (
                  <span className="mb-0.5 block text-micro font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                    {eyebrow}
                  </span>
                )}
                <span className="block break-words leading-tight">{title}</span>
              </span>
            </DialogTitle>
            {/*
              Sempre exatamente uma DialogDescription: o Radix a associa ao
              DialogContent via aria-describedby, sem duplicidade/conflito.
            */}
            <DialogDescription
              className={cn(
                (!description || descriptionSrOnly) && 'sr-only',
                description && !descriptionSrOnly && Icon && 'pl-[3.25rem]'
              )}
            >
              {description || fallbackDialogDescription(title)}
            </DialogDescription>
          </DialogHeader>

          {/* `flex flex-col` aqui e `flex-1 min-h-0` no filho, em vez de
              `h-full`. A altura deste contentor vem do flex do diálogo, e
              altura vinda do flex não conta como definida para resolver
              percentagem — o `height:100%` do filho caía para `auto` e crescia
              com o conteúdo, empurrando o rodapé para fora da moldura. Como
              item de flex o filho é medido, não estimado. */}
          {/* Tudo medido por flex, nada por percentagem — ver a nota no
              `scroll-area.tsx`, que é onde estava a raiz do rodapé cortado. */}
          <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
            {noScroll ? (
              <div className="flex flex-1 min-h-0 min-w-0 flex-col">{children}</div>
            ) : (
              <ScrollArea className="flex-1 min-h-0 min-w-0">
                <div className="min-w-0 max-w-full px-5 py-5 sm:px-7 sm:py-6">{children}</div>
              </ScrollArea>
            )}
          </div>

          {/* O rodapé não é uma superfície: é o mesmo casco do diálogo, separado
              por um fio. Levava `bg-card` -- o MESMO token dos campos (input,
              textarea, select) -- e no tema escuro ficava mais escuro que o
              casco (`bg-popover`), lendo-se como uma faixa recuada, um campo.
              Sem classe de fundo herda o casco, e acompanha-o nos dois temas. */}
          {!hideFooter && (
            <div className="flex-shrink-0 border-t px-4 sm:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
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
                  {onSubmit && (submitDisabled && submitBlockedReason ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              type="button"
                              size="sm"
                              onClick={onSubmit}
                              disabled
                              className="gap-1"
                            >
                              <IconSave className="h-4 w-4" />
                              {_submitLabel}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                          {submitBlockedReason}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={onSubmit}
                      disabled={submitDisabled || isSubmitting}
                      className="gap-1"
                    >
                      <IconSave className="h-4 w-4" />
                      {isSubmitting ? t('common.saving') : _submitLabel}
                    </Button>
                  ))}
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
