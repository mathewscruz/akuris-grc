import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
import {
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle2,
  AlertCircle,
  Circle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWizardShortcuts } from '@/hooks/useWizardShortcuts';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useLanguage } from '@/contexts/LanguageContext';

export type WizardTabState = 'pending' | 'partial' | 'complete' | 'error';

export interface WizardTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: ReactNode;
  state?: WizardTabState;
  /** Optional short hint shown under label on desktop sidebar */
  hint?: string;
}

interface WizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  tabs: WizardTab[];
  /** Sidebar summary (live values, calculated metrics, etc.) */
  summary?: ReactNode;
  /** Footer right-side actions (defaults to Cancel + Save) */
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  /** Disable save button (e.g. validation failing) */
  submitDisabled?: boolean;
  /** Whether form is dirty (drives unsaved changes guard) */
  isDirty?: boolean;
  /** Optional draft metadata shown in footer */
  draftLabel?: string;
  /** Force a controlled active tab id */
  activeTab?: string;
  onActiveTabChange?: (id: string) => void;
  /** Width preset */
  size?: 'md' | 'lg' | 'xl' | '2xl';
  /** Extra footer content on the left */
  footerExtra?: ReactNode;
  /**
   * Explicação mostrada quando o botão final está desativado (ex.: lista dos
   * campos obrigatórios em falta). Evita o botão "morto" sem justificação.
   * Também é usada como texto do tooltip (title) do botão desativado.
   */
  submitBlockedReason?: ReactNode;
  /**
   * DEFECT 5 — chamado antes de sair da etapa `fromId` (via "Próximo" ou
   * clique direto numa aba). Deve devolver `false` para bloquear a navegação
   * (o próprio chamador é responsável por assinalar o erro inline/estado da
   * etapa antes de devolver `false`). Sem isto, o utilizador conseguia avançar
   * com campos obrigatórios vazios.
   */
  canAdvance?: (fromId: string, toId: string) => boolean;
}

const SIZE_CLASSES: Record<NonNullable<WizardDialogProps['size']>, string> = {
  md: 'sm:max-w-3xl',
  lg: 'sm:max-w-5xl',
  xl: 'sm:max-w-6xl',
  '2xl': 'sm:max-w-7xl',
};

function StateIcon({ state }: { state?: WizardTabState }) {
  if (state === 'complete') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (state === 'error') return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  if (state === 'partial') return <Circle className="h-3.5 w-3.5 text-amber-500 fill-amber-500/30" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
}

/**
 * Standardized multi-tab dialog used across forms.
 * Provides:
 *  - Vertical sidebar (desktop) / horizontal scroll tabs (mobile)
 *  - Optional live summary card
 *  - Sticky footer with Prev / Next / Save
 *  - Keyboard shortcuts (Ctrl+S, Ctrl+←/→)
 *  - Unsaved changes guard with confirmation
 */
export function WizardDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  tabs,
  summary,
  onSubmit,
  submitLabel,
  cancelLabel,
  isSubmitting = false,
  submitDisabled = false,
  isDirty = false,
  draftLabel,
  activeTab: controlledTab,
  onActiveTabChange,
  size = 'xl',
  footerExtra,
  submitBlockedReason,
  canAdvance,
}: WizardDialogProps) {
  const { t } = useLanguage();
  const _submitLabel = submitLabel ?? t('common.save');
  const _cancelLabel = cancelLabel ?? t('common.cancel');
  const [internalTab, setInternalTab] = useState<string>(tabs[0]?.id ?? '');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (id: string) => {
    if (onActiveTabChange) onActiveTabChange(id);
    else setInternalTab(id);
  };

  /** DEFECT 5 — todas as trocas de etapa (aba, Próximo) passam por aqui. */
  const attemptSetActiveTab = (id: string) => {
    if (id === activeTab) return;
    if (canAdvance && !canAdvance(activeTab, id)) return;
    setActiveTab(id);
  };

  // Reset tab when reopening
  useEffect(() => {
    if (open && tabs[0]) {
      if (controlledTab === undefined) setInternalTab(tabs[0].id);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentIndex = useMemo(
    () => Math.max(0, tabs.findIndex((t) => t.id === activeTab)),
    [tabs, activeTab]
  );
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === tabs.length - 1;

  const goPrev = () => {
    if (!isFirst) setActiveTab(tabs[currentIndex - 1].id);
  };
  const goNext = () => {
    if (!isLast) attemptSetActiveTab(tabs[currentIndex + 1].id);
  };

  const { showConfirm, confirmCloseIfDirty, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard({
    isDirty,
    // Só avisa o browser enquanto o wizard está aberto.
    enabled: open,
  });


  useWizardShortcuts({
    enabled: open,
    onSave: onSubmit,
    onNext: goNext,
    onPrev: goPrev,
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
            SIZE_CLASSES[size]
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
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={attemptSetActiveTab}
            className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0"
          >
            {/* Sidebar (desktop) */}
            <aside className="hidden lg:flex flex-col w-72 border-r bg-muted/30 shrink-0">
              <ScrollArea className="flex-1">
                <TabsList className="flex flex-col h-auto w-full bg-transparent border-0 gap-1 p-3">
                  {tabs.map((tab, idx) => {
                    const TabIcon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={cn(
                          'w-full justify-start gap-3 px-3 py-2.5 h-auto text-left',
                          'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                          'data-[state=active]:border data-[state=active]:border-border',
                          tab.state === 'error' && 'text-destructive'
                        )}
                      >
                        <span className={cn(
                          'flex items-center justify-center h-6 w-6 rounded-md text-xs font-semibold shrink-0',
                          tab.state === 'error'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {TabIcon && <TabIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="text-sm font-medium truncate">{tab.label}</span>
                          </div>
                          {tab.hint && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {tab.hint}
                            </p>
                          )}
                        </div>
                        <StateIcon state={tab.state} />
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {summary && <div className="p-3 pt-2">{summary}</div>}
              </ScrollArea>
            </aside>

            {/* Mobile tab bar */}
            <div className="lg:hidden border-b bg-muted/30 shrink-0">
              <ScrollArea className="w-full">
                <TabsList className="inline-flex h-auto w-max bg-transparent p-2 gap-1">
                  {tabs.map((tab, idx) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={cn(
                        'gap-2 px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm',
                        tab.state === 'error' && 'text-destructive'
                      )}
                    >
                      <span className="text-xs font-semibold">{idx + 1}.</span>
                      <span className="text-xs whitespace-nowrap">{tab.label}</span>
                      <StateIcon state={tab.state} />
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="px-6 py-6">
                  {tabs.map((tab) => (
                    <TabsContent
                      key={tab.id}
                      value={tab.id}
                      className="mt-0 data-[state=inactive]:hidden focus-visible:outline-none"
                      forceMount
                    >
                      {tab.content}
                    </TabsContent>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </Tabs>

          {/* Sticky footer */}
          <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur-sm px-6 py-3">
            {submitDisabled && submitBlockedReason && (
              <p className="mb-2 flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                <span>{submitBlockedReason}</span>
              </p>
            )}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium">
                  {t('wizard.stepOf', { current: currentIndex + 1, total: tabs.length })}
                </span>
                {draftLabel && (
                  <>
                    <span className="text-border">•</span>
                    <span>{draftLabel}</span>
                  </>
                )}
                {footerExtra}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  {_cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={isFirst}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('common.previous')}
                </Button>
                {!isLast ? (
                  <Button type="button" size="sm" onClick={goNext} className="gap-1">
                    {t('common.next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : null}
                {onSubmit && (
                  submitDisabled && submitBlockedReason ? (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* span wrapper: Tooltip precisa de um alvo focável mesmo com o botão desativado */}
                          <span tabIndex={0} className="inline-flex">
                            <Button
                              type="button"
                              size="sm"
                              onClick={onSubmit}
                              disabled={submitDisabled || isSubmitting}
                              className="gap-1"
                              title={typeof submitBlockedReason === 'string' ? submitBlockedReason : undefined}
                            >
                              <Save className="h-4 w-4" />
                              {isSubmitting ? t('common.saving') : _submitLabel}
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
                      <Save className="h-4 w-4" />
                      {isSubmitting ? t('common.saving') : _submitLabel}
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
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
