import * as React from 'react';
import { toast as sonnerToast } from 'sonner';
import { Icon } from '@/components/icons/Icon';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Bell } from 'lucide-react';
import {
  getModuleMetaByKey,
  type NotificationModuleKey,
} from '@/lib/notification-icons';

export type AkurisToastTone = 'success' | 'warning' | 'destructive' | 'info' | 'reminder';

export interface AkurisToastOptions {
  /** Módulo de origem — define o ícone proprietário no chip. */
  module?: NotificationModuleKey;
  /** Tom semântico — define cor do acento vertical e do chip. Default: 'info'. */
  tone?: AkurisToastTone;
  /** Eyebrow opcional acima do título (uppercase, tracking-[0.18em]). */
  eyebrow?: string;
  /** Título principal. */
  title: string;
  /** Texto secundário. */
  description?: string;
  /** Ação opcional (label + onClick). */
  action?: { label: string; onClick: () => void };
  /** Duração em ms. Default 4500. Use Infinity para persistente. */
  duration?: number;
}

const TONE_CLASSES: Record<AkurisToastTone, { chipBg: string; accent: string }> = {
  success:     { chipBg: 'bg-success',     accent: 'bg-success' },
  warning:     { chipBg: 'bg-warning',     accent: 'bg-warning' },
  destructive: { chipBg: 'bg-destructive', accent: 'bg-destructive' },
  info:        { chipBg: 'bg-info',        accent: 'bg-info' },
  reminder:    { chipBg: 'bg-primary',     accent: 'bg-primary' },
};

const FALLBACK_TONE_ICON: Record<AkurisToastTone, React.ComponentType<any>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
  info: Info,
  reminder: Bell,
};

/**
 * akurisToast — Toast Editorial Precision:
 * - Surface bg-card sólida, borda fina, sombra profunda
 * - Acento vertical 3px à esquerda na cor do tom
 * - Chip 32px circular sólido com glyph branco (ícone proprietário do módulo)
 * - Action como link inline em text-primary
 */
export function akurisToast({
  module,
  tone = 'info',
  eyebrow,
  title,
  description,
  action,
  duration = 4500,
}: AkurisToastOptions) {
  const toneCls = TONE_CLASSES[tone];
  const moduleMeta = module ? getModuleMetaByKey(module) : null;
  const IconComp = moduleMeta?.Icon ?? FALLBACK_TONE_ICON[tone];

  return sonnerToast.custom(
    (id) => (
      <div
        role="status"
        aria-live="polite"
        className="relative w-[380px] max-w-[92vw] overflow-hidden rounded-lg border border-border bg-card pl-5 p-4 shadow-[0_18px_40px_-16px_hsl(0_0%_0%/0.55),0_2px_6px_-2px_hsl(0_0%_0%/0.25)]"
      >
        {/* Acento vertical 3px */}
        <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${toneCls.accent}`} />

        <div className="flex items-start gap-3">
          {/* Chip 32px sólido */}
          <span
            aria-hidden
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${toneCls.chipBg}`}
          >
            <IconComp className="h-4 w-4" strokeWidth={2.25} />
          </span>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1 pt-0.5">
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground leading-none mb-1.5">
                {eyebrow}
              </p>
            )}
            <p className="text-[14px] font-semibold text-foreground leading-tight">
              {title}
            </p>
            {description && (
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-1 break-words">
                {description}
              </p>
            )}
            {action && (
              <button
                type="button"
                onClick={() => {
                  action.onClick();
                  sonnerToast.dismiss(id);
                }}
                className="mt-3 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {action.label}
              </button>
            )}
          </div>

          {/* Fechar */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => sonnerToast.dismiss(id)}
            className="shrink-0 -mt-1 -mr-1 p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    ),
    { duration }
  );
}

export { Icon };
