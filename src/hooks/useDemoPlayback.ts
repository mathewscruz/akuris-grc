import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useMotionAllowed } from '@/lib/motion-preferences';

/** A public demo never advances while off-screen, hidden, reduced-motion or being read. */
export function useDemoPlayback({ steps, interval = 2100, autoplay = true, loop = true }: { steps: number; interval?: number; autoplay?: boolean; loop?: boolean }) {
  const motion = useMotionAllowed();
  const root = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const running = playing && motion && visible && !hovered && (loop || tick < steps - 1);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? false), { threshold: .2 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setTick(value => (value + 1) % steps), interval);
    return () => window.clearTimeout(timer);
  }, [running, tick, steps, interval]);
  const select = (value: number) => { setPlaying(false); setTick(Math.max(0, Math.min(steps - 1, value))); };
  return {
    root, tick, setTick, playing, setPlaying, running, visible, motion, select,
    interaction: {
      onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false),
      onFocusCapture: (event: FocusEvent<HTMLDivElement>) => { if (!(event.target as HTMLElement).closest('[data-demo-play]')) setPlaying(false); },
    },
  };
}
