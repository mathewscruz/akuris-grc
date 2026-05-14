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
  /** Tom semântico — define cor do chip e da listra. Default: 'info'. */
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

const TONE_CLASSES: Record<AkurisToastTone, { chipBg: string; stripes: string }> = {
  success:     { chipBg: 'bg-success',     stripes: 'akuris-stripes-success' },
  warning:     { chipBg: 'bg-warning',     stripes: 'akuris-stripes-warning' },
  destructive: { chipBg: 'bg-destructive', stripes: 'akuris-stripes-destructive' },
  info:        { chipBg: 'bg-info',        stripes: 'akuris-stripes-info' },
  reminder:    { chipBg: 'bg-primary',     stripes: 'akuris-stripes-reminder' },
};

const FALLBACK_TONE_ICON: Record<AkurisToastTone, React.ComponentType<any>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
  info: Info,
  reminder: Bell,
};

/**
 * akurisToast — Toast com identidade Akuris no estilo "pill listrado":
 * - Chip 24px circular sólido com glyph branco (ícone proprietário do módulo)
 * - Fundo com listras diagonais tingidas pelo tom (akuris-stripes-*)
 * - Botão "Action" branco à direita (opcional)
 *
 * Compatível com Sonner. Para toasts simples, continue usando `toast.success(...)` etc.
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
        className={`relative w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-border/50 shadow-[0_10px_28px_-12px_hsl(var(--foreground)/0.18)] animate-toast-slide-in ${toneCls.stripes}`}
      >
        <div className="flex items-center gap-3 pl-4 pr-3 py-3">
          {/* Chip ícone sólido 24px */}
          <span
            aria-hidden
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${toneCls.chipBg}`}
          >
            <IconComp className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70 leading-none mb-1">
                {eyebrow}
              </p>
            )}
            <p className="text-[13px] font-semibold text-foreground leading-tight">
              {title}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                {description}
              </p>
            )}
          </div>

          {/* Ação (pill branco) */}
          {action && (
            <button
              type="button"
              onClick={() => {
                action.onClick();
                sonnerToast.dismiss(id);
              }}
              className="akuris-pill-action shrink-0"
            >
              {action.label}
            </button>
          )}

          {/* Fechar */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => sonnerToast.dismiss(id)}
            className="shrink-0 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    ),
    { duration }
  );
}

export { Icon };
