import * as React from 'react';
import { toast as sonnerToast } from 'sonner';
import { Icon } from '@/components/icons/Icon';
import { type NotificationModuleKey } from '@/lib/notification-icons';

export type AkurisToastTone = 'success' | 'warning' | 'destructive' | 'info' | 'reminder';

export interface AkurisToastOptions {
  /** Módulo de origem (mantido por compatibilidade; não altera o visual). */
  module?: NotificationModuleKey;
  /** Tom semântico. Default: 'info'. */
  tone?: AkurisToastTone;
  /** Eyebrow opcional — prefixa o título. */
  eyebrow?: string;
  /** Título principal. */
  title: string;
  /** Texto secundário. */
  description?: string;
  /** Ação opcional (label + onClick). */
  action?: { label: string; onClick: () => void };
  /** Duração em ms. Por omissão herda a do Toaster (2s). */
  duration?: number;
  /** Id estável — reutiliza (substitui) o mesmo toast em vez de empilhar. */
  id?: string | number;
}

/**
 * akurisToast — MODELO ÚNICO de notificação da ferramenta.
 *
 * Todo o visual vive em `src/components/ui/sonner.tsx` (Toaster Akuris):
 * surface bg-card, acento vertical, chip do tom e action inline. Esta função
 * apenas mapeia o tom semântico para o tipo nativo do Sonner, garantindo que
 * chamadas `toast()`, `toast.success()` e `akurisToast()` produzam exatamente
 * o mesmo cartão. Passe `id` para atualizar um aviso existente (sem empilhar).
 */
export function akurisToast({
  tone = 'info',
  eyebrow,
  title,
  description,
  action,
  duration,
  id,
}: AkurisToastOptions) {
  const label = eyebrow ? `${eyebrow} · ${title}` : title;
  const opts = {
    description,
    duration,
    ...(id !== undefined ? { id } : {}),
    ...(action ? { action: { label: action.label, onClick: action.onClick } } : {}),
  };

  switch (tone) {
    case 'success':
      return sonnerToast.success(label, opts);
    case 'warning':
    case 'reminder':
      return sonnerToast.warning(label, opts);
    case 'destructive':
      return sonnerToast.error(label, opts);
    default:
      return sonnerToast.info(label, opts);
  }
}

export { Icon };

