import { AkurisPulse } from "./AkurisPulse";
import { tGlobal } from '@/lib/i18n-global';

/**
 * LoadingOverlay — overlay de tela cheia com o AkurisPulse centralizado.
 *
 * Usado como fallback padrão de Suspense, em transições de página e
 * em qualquer estado de carregamento que ocupe o viewport.
 */
export interface LoadingOverlayProps {
  size?: number;
  /**
   * Quando `false`, o overlay ocupa apenas o container pai (absolute) ao invés
   * do viewport inteiro (fixed). Útil para áreas de conteúdo dentro do Layout.
   */
  fullScreen?: boolean;
}

export function LoadingOverlay({ size = 80, fullScreen = true }: LoadingOverlayProps) {
  return (
    <div
      className={`${fullScreen ? "fixed" : "absolute"} inset-0 z-50 flex items-center justify-center`}
      style={{ backgroundColor: "#06060e" }}
      role="status"
      aria-live="polite"
      aria-label={tGlobal('cardsKpi.sweep.sistema.carregando')}
    >
      <AkurisPulse size={size} />
    </div>
  );
}

export default LoadingOverlay;
