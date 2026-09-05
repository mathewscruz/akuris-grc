import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const positions = new Map<string, number>();
export function useRouteScroll(ref: RefObject<HTMLElement>, ready: boolean) {
  const location = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef<string>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!ready || !element) return;
    const key = location.key;
    const samePage = previousPath.current === location.pathname;
    previousPath.current = location.pathname;
    const target = navigation === 'POP' ? positions.get(key) ?? 0 : samePage ? element.scrollTop : 0;
    let restoring = target > 0;
    const observer = new ResizeObserver(() => restore());
    const stop = () => { restoring = false; observer.disconnect(); };
    const restore = () => {
      element.scrollTo({ top: target, behavior: 'auto' });
      if (element.scrollHeight - element.clientHeight >= target) stop();
    };
    const record = () => { if (!restoring) positions.set(key, element.scrollTop); };
    restore();
    if (restoring) Array.from(element.children).forEach((child) => observer.observe(child));
    const timeout = window.setTimeout(stop, 3000);
    element.addEventListener('scroll', record, { passive: true });
    element.addEventListener('wheel', stop, { passive: true });
    element.addEventListener('touchstart', stop, { passive: true });
    element.addEventListener('keydown', stop);
    return () => {
      positions.set(key, element.scrollTop);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
      observer.disconnect();
      window.clearTimeout(timeout);
      element.removeEventListener('scroll', record);
      element.removeEventListener('wheel', stop);
      element.removeEventListener('touchstart', stop);
      element.removeEventListener('keydown', stop);
    };
  }, [location.key, location.pathname, navigation, ready, ref]);
}
