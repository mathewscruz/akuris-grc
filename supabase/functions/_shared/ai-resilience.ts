export interface FallbackResult<T> {
  value: T;
  usedFallback: boolean;
}

export interface FallbackOptions<T> {
  primary: () => Promise<T>;
  fallback: () => Promise<T>;
  isTransient: (error: unknown) => boolean;
  onFallback?: (error: unknown) => void;
}

/** Executa um único fallback apenas para falhas transitórias do provedor. */
export async function withTransientFallback<T>(options: FallbackOptions<T>): Promise<FallbackResult<T>> {
  try {
    return { value: await options.primary(), usedFallback: false };
  } catch (error) {
    if (!options.isTransient(error)) throw error;
    options.onFallback?.(error);
    return { value: await options.fallback(), usedFallback: true };
  }
}

/** Combina cancelamento do pedido com um limite menor para cada tentativa. */
export function createAttemptSignal(parent: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([parent, AbortSignal.timeout(Math.max(1, timeoutMs))]);
}