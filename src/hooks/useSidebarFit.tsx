import { useEffect, useState } from 'react';

export type SidebarFit = 'comfortable' | 'compact' | 'dense';

function compute(): SidebarFit {
  if (typeof window === 'undefined') return 'comfortable';
  const h = window.innerHeight;
  if (h >= 900) return 'comfortable';
  if (h >= 700) return 'compact';
  return 'dense';
}

/**
 * Retorna o nível de densidade ideal da sidebar conforme altura do viewport,
 * permitindo exibir todos os itens sem scroll.
 */
export function useSidebarFit(): SidebarFit {
  const [fit, setFit] = useState<SidebarFit>(() => compute());

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setFit(compute()), 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return fit;
}
