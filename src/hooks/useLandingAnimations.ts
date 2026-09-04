import { useEffect, useState } from "react";

/**
 * Aplica a classe `.lp-in` em todos os elementos `[data-reveal]` quando entram
 * na viewport. Os estilos do próprio CSS cuidam da animação (fade + slide-up
 * + stagger). Respeita prefers-reduced-motion.
 */
export function useLandingReveal() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (reduced) {
      els.forEach((el) => el.classList.add("lp-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("lp-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/**
 * Detecta se a página foi rolada além de `offset` px. Útil para reforçar a
 * sombra/blur do header sticky.
 */
export function useScrolled(offset = 80) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return scrolled;
}
