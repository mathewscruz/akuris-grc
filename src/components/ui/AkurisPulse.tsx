import { tGlobal } from '@/lib/i18n-global';

/**
 * AkurisPulse — loader único e oficial do sistema Akuris.
 *
 * O contorno do "A" é desenhado em traço roxo, preenche-se, esvazia e
 * recomeça (keyframes `akuris-draw`/`akuris-fill` em index.css). Em tamanhos
 * pequenos (<= 20px) um segmento orbita o contorno, para ficar legível em
 * botões. Com "reduzir movimento", o "A" fica cheio e só respira.
 * Cor vem de `--primary`. Para overlays de tela cheia, use <LoadingOverlay />.
 */
export interface AkurisPulseProps {
  size?: number;
  className?: string;
}

export const AKURIS_PATH =
  "M43.7,13.1 L72.3,66.9 Q76,74 68,74 L61,74 Q56,74 53.4,69.7 L42.6,52.3 Q40,48 37.4,52.3 L26.6,69.7 Q24,74 19,74 L12,74 Q4,74 7.7,66.9 L36.3,13.1 Q40,6 43.7,13.1 Z";

export function AkurisPulse({ size = 80, className }: AkurisPulseProps) {
  const compacto = size <= 20;
  const traco = compacto ? 7 : Math.max(2.5, 160 / size);
  return (
    <div
      className={['akuris-loader', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-flex', color: 'hsl(var(--primary))' }}
      role="status"
      aria-label={tGlobal('common.loading')}
    >
      <svg viewBox="0 0 80 80" width={size} height={size} overflow="visible" aria-hidden="true">
        {compacto ? (
          <>
            <path d={AKURIS_PATH} fill="currentColor" fillOpacity={0.25} />
            <path
              d={AKURIS_PATH} pathLength={1} fill="none" stroke="currentColor"
              strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round"
              className="akuris-loader-orbit"
            />
          </>
        ) : (
          <>
            <path d={AKURIS_PATH} fill="currentColor" className="akuris-loader-fill" />
            <path
              d={AKURIS_PATH} pathLength={1} fill="none" stroke="currentColor"
              strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round"
              className="akuris-loader-stroke"
            />
          </>
        )}
      </svg>
    </div>
  );
}
