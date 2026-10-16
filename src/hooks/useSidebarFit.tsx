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
 * Escolhe a densidade pela altura disponível por item (nos dois sentidos),
 * recalculando em resize, rotação e mudanças do contêiner.
 */
export function useAutoFit(contentRef: RefObject<HTMLElement>): SidebarFit {
  const [fit, setFit] = useState<SidebarFit>(() => initialGuess());
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = () => {
    const el = contentRef.current;
    if (!el) return;
    const items = el.querySelectorAll(':scope > ul > li').length || 1;
    const per = (el.clientHeight - 16) / items;
    setFit(per >= 64 ? 'comfortable' : per >= 54 ? 'compact' : 'dense');
  };
  const schedule = () => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(measure, 60);
  };

  useLayoutEffect(() => { measure(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return fit;
}
