/**
 * AkurisComplete — selo oficial de "Concluído" do sistema Akuris.
 *
 * Usado no lugar do <AkurisPulse/> quando um processo longo termina com
 * sucesso (ex.: geração de documento no DocGen), imediatamente antes de
 * revelar o resultado. Anel de progresso completo + visto desenhado.
 */
export interface AkurisCompleteProps {
  size?: number;
  className?: string;
  label?: string;
}

const BRAND_COLOR = '#8B78E8';

export function AkurisComplete({ size = 44, className, label }: AkurisCompleteProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size, display: 'inline-flex' }}
      role="status"
      aria-label={label}
    >
      <svg
        viewBox="0 0 80 80"
        width={size}
        height={size}
        overflow="visible"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Halo suave */}
        <circle
          cx="40"
          cy="40"
          r="34"
          fill={BRAND_COLOR}
          opacity={0.12}
          style={{
            transformOrigin: '40px 40px',
            animation: 'akuris-complete-pop 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        />
        {/* Anel completo */}
        <circle
          cx="40"
          cy="40"
          r="30"
          fill="none"
          stroke={BRAND_COLOR}
          strokeWidth={3}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100 100"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '40px 40px',
            animation: 'akuris-complete-ring 520ms ease-out both',
          }}
        />
        {/* Visto */}
        <path
          d="M27 41.5 L36.5 51 L54 32"
          fill="none"
          stroke={BRAND_COLOR}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray="100 100"
          style={{
            animation: 'akuris-complete-check 380ms 380ms ease-out both',
          }}
        />
      </svg>
    </div>
  );
}

export default AkurisComplete;
