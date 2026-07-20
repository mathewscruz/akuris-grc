/**
 * FormModal — envelope padrão para popups de formulário (criar/editar).
 * Renderiza um Dialog (centralizado) OU um Sheet (lateral) com o mesmo
 * cabeçalho/rodapé do kit e CENTRALIZA o comportamento de salvar:
 *   - estado de loading no botão
 *   - fecha automaticamente ao salvar com sucesso (onSubmit sem lançar erro)
 *   - mantém aberto se onSubmit lançar (o chamador mostra o toast de erro)
 *
 * Assim, "salvar e não fechar" deixa de ser possível de esquecer — está no
 * componente, não em cada tela.
 */
import * as React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { ModalHeader, ModalBody, ModalFooter } from './ModalPrimitives';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAX_W: Record<Size, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'dialog' = centralizado (padrão p/ formulários); 'sheet' = painel lateral. */
  variant?: 'dialog' | 'sheet';
  size?: Size;
  eyebrow?: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Ação de salvar. Faça o supabase + toast de sucesso aqui.
   * Lance (throw) em caso de erro para manter o popup aberto.
   * Retorne `false` para impedir o fechamento mesmo sem erro.
   */
  onSubmit: () => void | boolean | Promise<void | boolean>;
  submitLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  /** Nó auxiliar à esquerda do rodapé. */
  footerInfo?: React.ReactNode;
  children: React.ReactNode;
}

export function FormModal({
  open,
  onOpenChange,
  variant = 'dialog',
  size = 'md',
  eyebrow,
  title,
  icon,
  description,
  onSubmit,
  submitLabel = 'Salvar',
  busyLabel = 'Salvando…',
  cancelLabel = 'Cancelar',
  submitDisabled,
  footerInfo,
  children,
}: FormModalProps) {
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit();
      if (result !== false) onOpenChange(false);
    } catch (err) {
      // Mantém o popup aberto — o chamador é responsável pelo toast de erro.
      logger.error('FormModal onSubmit falhou', { data: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const inner = (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
      <ModalHeader eyebrow={eyebrow} title={title} icon={icon} onClose={() => onOpenChange(false)} />
      <ModalBody>
        {description && <p className="text-sm text-muted-foreground mb-4 -mt-1">{description}</p>}
        {children}
      </ModalBody>
      <ModalFooter info={footerInfo}>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          {cancelLabel}
        </Button>
        <Button type="submit" disabled={submitting || submitDisabled}>
          {submitting ? busyLabel : submitLabel}
        </Button>
      </ModalFooter>
    </form>
  );

  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 flex flex-col gap-0 [&>button.absolute]:hidden">
          {inner}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 gap-0 flex flex-col max-h-[92vh] overflow-hidden [&>button.absolute]:hidden',
          SIZE_MAX_W[size],
        )}
      >
        {inner}
      </DialogContent>
    </Dialog>
  );
}
