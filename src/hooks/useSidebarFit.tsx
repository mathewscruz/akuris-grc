import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type SidebarFit = 'comfortable' | 'compact' | 'dense';
const LEVELS: SidebarFit[] = ['comfortable', 'compact', 'dense'];

/**
 * Fallback síncrono baseado em altura do viewport, usado antes da primeira medição.
 */
function initialGuess(): SidebarFit {
  if (typeof window === 'undefined') return 'comfortable';
  const h = window.innerHeight;
  if (h >= 1000) return 'comfortable';
  if (h >= 820) return 'compact';
  return 'dense';
}

export function useSidebarFit(): SidebarFit {
  const [fit, setFit] = useState<SidebarFit>(() => initialGuess());
  useEffect(() => {
    const onResize = () => setFit(initialGuess());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return fit;
}

/**
 * Mede o overflow real do contêiner da sidebar e escala a densidade até caber.
 * Reage a resize do viewport, do próprio contêiner e a mutações internas
 * (sub-grupos abrindo/fechando).
 */
export function useAutoFit(contentRef: RefObject<HTMLElement>): SidebarFit {
  const [fit, setFit] = useState<SidebarFit>(() => initialGuess());
  const measuring = useRef(false);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = () => {
    const el = contentRef.current;
    if (!el) return;
    if (measuring.current) return;
    measuring.current = true;

    // Pequeno atraso para o layout estabilizar após a transição (300ms no Sidebar).
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const node = contentRef.current;
      if (!node) { measuring.current = false; return; }
      const overflow = node.scrollHeight - node.clientHeight;
      setFit((current) => {
        const idx = LEVELS.indexOf(current);
        if (overflow > 1 && idx < LEVELS.length - 1) {
          return LEVELS[idx + 1];
        }
        // Tenta voltar a um nível mais confortável: se o nível anterior coubesse, sobrariam
        // ao menos ~80px de folga (aproximação do delta entre níveis).
        if (overflow < -120 && idx > 0) {
          return LEVELS[idx - 1];
        }
        return current;
      });
      measuring.current = false;
    });
  };

  const schedule = () => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(measure, 80);
  };

  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-medir sempre que `fit` mudar (o próximo render pode ainda ter overflow).
  useLayoutEffect(() => {
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => schedule());
    ro.observe(el);

    const mo = new MutationObserver(() => schedule());
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'class', 'style'] });

    const onWin = () => schedule();
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', onWin);
      if (tRef.current) clearTimeout(tRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return fit;
}
