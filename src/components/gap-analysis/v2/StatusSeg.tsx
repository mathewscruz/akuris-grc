/**
 * StatusSeg — segmented control de 4 estados de conformidade,
 * com indicação visual de "IA sugere" via pulse-dot.
 * Atalhos de teclado: C / P / N / A (consumidos pelo container via prop onSelect).
 */
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ConformityStatus } from '@/lib/gap-analysis-tokens';

interface Option {
  id: ConformityStatus;
  label: string;
  shortcut: string;
  activeBg: string;
}

const OPTIONS: Option[] = [
  { id: 'conforme', label: 'Conforme', shortcut: 'C', activeBg: 'bg-success text-success-foreground' },
  { id: 'parcial', label: 'Parcial', shortcut: 'P', activeBg: 'bg-warning text-warning-foreground' },
  { id: 'nao_conforme', label: 'Não Conforme', shortcut: 'N', activeBg: 'bg-destructive text-destructive-foreground' },
  { id: 'nao_aplicavel', label: 'N/A', shortcut: 'A', activeBg: 'bg-muted-foreground text-background' },
];

interface StatusSegProps {
  value: ConformityStatus;
  onChange: (status: ConformityStatus) => void;
  /** Sugestão IA — exibe pulse-dot no botão correspondente quando != value. */
  aiSuggestion?: ConformityStatus;
  /** Ativa atalhos de teclado globais (C/P/N/A). */
  enableShortcuts?: boolean;
  className?: string;
}

export function StatusSeg({
  value,
  onChange,
  aiSuggestion,
  enableShortcuts = false,
  className,
}: StatusSegProps) {
  useEffect(() => {
    if (!enableShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      // Ignora se foco está em input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const found = OPTIONS.find((o) => o.shortcut === k);
      if (found) {
        e.preventDefault();
        onChange(found.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enableShortcuts, onChange]);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5',
        className
      )}
      role="radiogroup"
      aria-label="Status de conformidade"
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        const showAiPip = aiSuggestion === opt.id && !isActive;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.id)}
            className={cn(
              'relative inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all',
              isActive
                ? opt.activeBg
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                'inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-sm border px-1 font-mono text-[9px] leading-none',
                isActive
                  ? 'border-current/40 text-current/90 bg-transparent'
                  : 'border-border bg-background text-muted-foreground/70'
              )}
            >
              {opt.shortcut}
            </span>
            {showAiPip && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                aria-label="Sugestão da IA"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
