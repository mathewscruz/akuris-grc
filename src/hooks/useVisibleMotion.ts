import { useEffect, useRef } from 'react';

let observer: IntersectionObserver | undefined;
const observed = new Set<Element>();

/** One observer for all decorative meters, including rows in nested scrollers. */
export function useVisibleMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      node.dataset.motionVisible = 'true';
      return;
    }
    observer ??= new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        (entry.target as HTMLElement).dataset.motionVisible = String(entry.isIntersecting);
      });
    });
    observed.add(node);
    observer.observe(node);
    return () => {
      observer?.unobserve(node);
      observed.delete(node);
      if (!observed.size) { observer?.disconnect(); observer = undefined; }
    };
  }, []);
  return ref;
}
