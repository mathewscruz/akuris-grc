import { toast as sonnerToast } from 'sonner';

/**
 * Política única de tempo por tom.
 *
 * Confirmações desaparecem rápido; erros ficam tempo suficiente para leitura e
 * interação. Uma chamada ainda pode passar `duration` explicitamente quando o
 * conteúdo realmente exigir outro tempo.
 */
const DURATION = {
  success: 2000,
  info: 3000,
  warning: 4500,
  error: 6000,
} as const;

const withDuration = <T extends Record<string, unknown> | undefined>(options: T, duration: number) => ({
  ...options,
  duration: options?.duration ?? duration,
});

const toast = ((message: Parameters<typeof sonnerToast>[0], options?: Parameters<typeof sonnerToast>[1]) =>
  sonnerToast(message, withDuration(options, DURATION.info))) as typeof sonnerToast;

Object.assign(toast, sonnerToast, {
  success: (message: Parameters<typeof sonnerToast.success>[0], options?: Parameters<typeof sonnerToast.success>[1]) =>
    sonnerToast.success(message, withDuration(options, DURATION.success)),
  info: (message: Parameters<typeof sonnerToast.info>[0], options?: Parameters<typeof sonnerToast.info>[1]) =>
    sonnerToast.info(message, withDuration(options, DURATION.info)),
  warning: (message: Parameters<typeof sonnerToast.warning>[0], options?: Parameters<typeof sonnerToast.warning>[1]) =>
    sonnerToast.warning(message, withDuration(options, DURATION.warning)),
  error: (message: Parameters<typeof sonnerToast.error>[0], options?: Parameters<typeof sonnerToast.error>[1]) =>
    sonnerToast.error(message, withDuration(options, DURATION.error)),
});

export { toast, DURATION as TOAST_DURATION };
