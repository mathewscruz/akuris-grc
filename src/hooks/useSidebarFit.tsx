import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type SidebarFit = 'comfortable' | 'compact' | 'dense' | 'icons';
const LEVELS: SidebarFit[] = ['comfortable', 'compact', 'dense', 'icons'];
/** Altura mínima por item (px) para cada nível; abaixo do último, só ícones. */
const LIMITES = [64, 54, 40];

/**
 * Fallback síncrono baseado em altura do viewport, usado antes da primeira medição.
 */
function initialGuess(): SidebarFit {
  if (typeof window === 'undefined') return 'comfortable';
  const h = window.innerHeight;
  if (h >= 1000) return 'comfortable';
  if (h >= 820) return 'compact';
  if (h >= 640) return 'dense';
  return 'icons';
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
/**
 * Escolhe a densidade com histerese: só sobe com folga acima do limite e só
 * desce abaixo dele, para não oscilar quando a altura está no limite.
 */
export function escolherDensidade(per: number, atual: SidebarFit, folga = 4): SidebarFit {
  const nivel = (p: number) => { const k = LIMITES.findIndex((l) => p >= l); return k === -1 ? LIMITES.length : k; };
  const iAtual = LEVELS.indexOf(atual);
  const iAlvo = nivel(per);
  if (iAlvo === iAtual) return atual;
  // subir exige folga acima do limite; descer exige ficar abaixo do limite menos a folga
  const iNovo = iAlvo < iAtual ? nivel(per - folga) : nivel(per + folga);
  return iNovo === iAtual ? atual : LEVELS[iNovo];
}

export function useAutoFit(contentRef: RefObject<HTMLElement>): SidebarFit {
  const [fit, setFit] = useState<SidebarFit>(() => initialGuess());
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastH = useRef<number | null>(null);

  const measure = () => {
    const el = contentRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const h = el.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
    if (lastH.current !== null && Math.abs(h - lastH.current) < 8) return;
    lastH.current = h;
    const items = el.querySelectorAll(':scope > ul > li').length || 1;
    setFit((atual) => escolherDensidade((h / items) * (16 / (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)), atual));
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
