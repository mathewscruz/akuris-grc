/**
 * Primitivos de popup Akuris — cascas reutilizáveis para padronizar TODOS os
 * diálogos/sheets (cabeçalho, corpo, rodapé) e o conteúdo de detalhe
 * (linha de campo, seção, sub-card). Compõe-se dentro de DialogContent ou
 * SheetContent — o container (centralizado vs lateral) é escolhido por quem usa.
 *
 * Objetivo: parar de remontar cabeçalho/rodapé/scroll à mão em cada popup.
 * Mudou o estilo do cabeçalho? Muda aqui, muda em todos.
 */
import * as React from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────────────────────────────────────────────
// Cabeçalho
// ─────────────────────────────────────────────────────────────────────────────
export interface RecordNav {
  current: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export interface ModalHeaderProps {
  /** Rótulo pequeno em CAIXA ALTA acima do título (ex.: "Gestão de Riscos"). */
  eyebrow?: string;
  title: React.ReactNode;
  /** Ícone à esquerda do título (bloco arredondado com bg-primary/10). */
  icon?: React.ReactNode;
  /** Linha de badges de status logo abaixo do título. */
  badges?: React.ReactNode;
  /** Navegação de registro "‹ N de M ›". */
  nav?: RecordNav;
  /** Ação "expandir" (ex.: abrir tela cheia). */
  onExpand?: () => void;
  /** Fechar. Se omitido, use <SheetClose>/<DialogClose> do container. */
  onClose?: () => void;
  /** Ações extras à direita (ex.: botão Editar). */
  actions?: React.ReactNode;
  className?: string;
}

export function ModalHeader({
  eyebrow,
  title,
  icon,
  badges,
  nav,
  onExpand,
  onClose,
  actions,
  className,
}: ModalHeaderProps) {
  return (
    <div className={cn('flex-shrink-0 px-6 py-5 border-b border-border', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {icon}
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            {eyebrow && (
              <span className="text-[10.5px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
                {eyebrow}
              </span>
            )}
            <div className="text-base font-semibold text-foreground leading-tight truncate">{title}</div>
            {badges && <div className="flex items-center gap-1.5 flex-wrap pt-0.5">{badges}</div>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
          {nav && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={nav.onPrev}
                disabled={!nav.onPrev || nav.current <= 1}
                aria-label="Registro anterior"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <span className="tabular-nums whitespace-nowrap">
                {nav.current} <span className="opacity-60">de</span> {nav.total}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={nav.onNext}
                disabled={!nav.onNext || nav.current >= nav.total}
                aria-label="Próximo registro"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          )}
          {onExpand && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onExpand} aria-label="Expandir">
              <Maximize2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Fechar">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corpo (área rolável)
// ─────────────────────────────────────────────────────────────────────────────
export function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rodapé fixo (ações)
// ─────────────────────────────────────────────────────────────────────────────
export function ModalFooter({
  info,
  children,
  className,
}: {
  /** Texto/nó auxiliar à esquerda (ex.: "Última revisão · …"). */
  info?: React.ReactNode;
  /** Ações à direita (botões). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex-shrink-0 border-t border-border bg-card px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3',
        className,
      )}
    >
      {info && <div className="text-[11px] text-muted-foreground min-w-0 leading-snug">{info}</div>}
      <div className="flex items-center gap-2 sm:ml-auto">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Linha de campo (ícone + rótulo + valor) — padrão dos metadados
// ─────────────────────────────────────────────────────────────────────────────
export function FieldRow({
  icon,
  label,
  children,
  className,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-[130px_1fr] items-start gap-3 py-1.5', className)}>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {label}
      </span>
      <span className="text-sm text-foreground min-w-0">{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seção (rótulo + ação opcional + conteúdo)
// ─────────────────────────────────────────────────────────────────────────────
export function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-card (card com borda de acento) — subitens / vínculos
// ─────────────────────────────────────────────────────────────────────────────
type AccentTone = 'primary' | 'success' | 'warning' | 'destructive' | 'muted';

const ACCENT: Record<AccentTone, string> = {
  primary: 'border-l-primary',
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  muted: 'border-l-border',
};

export function SubCard({
  accent = 'muted',
  children,
  className,
  onClick,
}: {
  accent?: AccentTone;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border border-border border-l-[3px] rounded-lg p-3',
        ACCENT[accent],
        onClick && 'cursor-pointer hover:bg-muted/40 transition-colors',
        className,
      )}
    >
      {children}
    </div>
  );
}
