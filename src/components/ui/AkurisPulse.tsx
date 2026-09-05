import { tGlobal } from '@/lib/i18n-global';

/**
 * AkurisPulse — loader único e oficial do sistema Akuris.
 *
 * Renderiza o símbolo "A" da marca em #8B78E8 com 3 anéis pulsantes
 * (delays 0s, 0.8s, 1.6s) usando o keyframe global `akuris-ring-expand`.
 *
 * - O SVG usa overflow="visible" para que os anéis em escala 2.1 não sejam cortados.
 * - Sem dependências externas, apenas CSS puro.
 * - Para overlays de tela cheia, use <LoadingOverlay />.
 */
export interface AkurisPulseProps {
  size?: number;
  className?: string;
}

export const AKURIS_PATH =
  "M43.7,13.1 L72.3,66.9 Q76,74 68,74 L61,74 Q56,74 53.4,69.7 L42.6,52.3 Q40,48 37.4,52.3 L26.6,69.7 Q24,74 19,74 L12,74 Q4,74 7.7,66.9 L36.3,13.1 Q40,6 43.7,13.1 Z";

const BRAND_COLOR = "#8B78E8";
const RING_DELAYS = [0, 0.8, 1.6] as const;

export function AkurisPulse({ size = 80, className }: AkurisPulseProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size, display: "inline-flex" }}
      role="status"
      aria-label={tGlobal('cardsKpi.sweep.sistema.carregando')}
    >
      <svg
        viewBox="0 0 80 80"
        width={size}
        height={size}
        overflow="visible"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Símbolo Akuris */}
        <path d={AKURIS_PATH} fill={BRAND_COLOR} />

        {/* Anéis pulsantes */}
        {RING_DELAYS.map((delay, i) => (
          <path
            key={i}
            d={AKURIS_PATH}
            fill="none"
            stroke={BRAND_COLOR}
            strokeWidth={1.5}
            style={{
              transformOrigin: "40px 40px",
              animation: "akuris-ring-expand 2.4s ease-out infinite",
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
