import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useVisibleMotion } from '../useVisibleMotion';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('compartilha o observador e pausa medidores fora da área visível', () => {
  let callback: IntersectionObserverCallback;
  const observe = vi.fn(); const unobserve = vi.fn(); const disconnect = vi.fn();
  const Observer = vi.fn(function (cb: IntersectionObserverCallback) { callback = cb; return { observe, unobserve, disconnect }; });
  vi.stubGlobal('IntersectionObserver', Observer);
  function Meter() { const ref = useVisibleMotion<HTMLSpanElement>(); return <span ref={ref} data-testid="meter" data-motion-visible="false" />; }
  const view = render(<><Meter /><Meter /></>);
  const meters = view.getAllByTestId('meter');
  expect(Observer).toHaveBeenCalledTimes(1);
  expect(observe).toHaveBeenCalledTimes(2);
  const entry = { target: meters[0], isIntersecting: true, boundingClientRect: new DOMRect(), intersectionRect: new DOMRect(), rootBounds: null, intersectionRatio: 1, time: 0 };
  callback!([entry], {} as IntersectionObserver);
  expect(meters[0]).toHaveAttribute('data-motion-visible', 'true');
  expect(meters[1]).toHaveAttribute('data-motion-visible', 'false');
  callback!([{ ...entry, isIntersecting: false, intersectionRatio: 0 }], {} as IntersectionObserver);
  expect(meters[0]).toHaveAttribute('data-motion-visible', 'false');
  view.unmount();
  expect(unobserve).toHaveBeenCalledTimes(2);
  expect(disconnect).toHaveBeenCalledOnce();
});
